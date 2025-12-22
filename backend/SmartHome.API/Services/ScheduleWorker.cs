using Microsoft.EntityFrameworkCore;
using SmartHome.API.Models;

namespace SmartHome.API.Services
{
    public class ScheduleWorker : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<ScheduleWorker> _logger;

        public ScheduleWorker(IServiceScopeFactory scopeFactory, ILogger<ScheduleWorker> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("ScheduleWorker started.");
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessSchedules();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing schedules");
                }

                // Check every 10 seconds for more accurate scheduling
                await Task.Delay(10000, stoppingToken);
            }
        }

        private async Task ProcessSchedules()
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<SmartHomeContext>();

            var now = DateTime.Now;
            var currentDay = ((int)now.DayOfWeek).ToString(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

            // Fetch potential schedules matching current time (within last minute to catch missed schedules)
            var targetTime = new TimeSpan(now.Hour, now.Minute, 0);
            var schedules = await context.DeviceSchedules
                .Where(s => s.IsEnabled && s.Time.Hours == now.Hour && s.Time.Minutes == now.Minute)
                .ToListAsync();

            foreach (var schedule in schedules)
            {
                // Check Day of Week - days stored as "1,2,3" where 1=Monday, 2=Tuesday, ..., 6=Saturday, 0=Sunday
                var days = schedule.DaysOfWeek.Split(',', StringSplitOptions.RemoveEmptyEntries);
                if (!days.Contains(currentDay)) continue;

                var device = await context.Devices
                    .Include(d => d.DeviceSettings)
                    .FirstOrDefaultAsync(d => d.DeviceId == schedule.DeviceId);
                
                if (device == null) continue;

                // Определяем действие: если есть Action, используем его, иначе ActionOn
                var action = schedule.Action;
                DeviceStatus targetStatus;
                string? targetMode = null;

                if (!string.IsNullOrEmpty(action))
                {
                    // Для окон и других устройств с несколькими действиями
                    if (device.Type.ToLower() == "window")
                    {
                        targetMode = action; // "closed", "tilted", "opened"
                        targetStatus = action == "closed" ? DeviceStatus.inactive : DeviceStatus.active;
                    }
                    else
                    {
                        targetStatus = action == "on" ? DeviceStatus.active : DeviceStatus.inactive;
                    }
                }
                else
                {
                    // Legacy: используем ActionOn
                    targetStatus = schedule.ActionOn ? DeviceStatus.active : DeviceStatus.inactive;
                }

                // Check if this schedule was already executed in the last 2 minutes to avoid duplicate triggers
                var recentHistory = await context.DeviceStatusHistories
                    .Where(h => h.DeviceId == schedule.DeviceId && 
                                h.ChangeReason == "schedule" && 
                                h.Timestamp > DateTime.UtcNow.AddMinutes(-2))
                    .OrderByDescending(h => h.Timestamp)
                    .FirstOrDefaultAsync();
                
                if (recentHistory != null && recentHistory.Status == targetStatus)
                {
                    continue; // Already executed recently
                }

                bool shouldUpdate = device.Status != targetStatus;
                
                // Для окон также нужно обновить settings.mode
                if (device.Type.ToLower() == "window" && !string.IsNullOrEmpty(targetMode))
                {
                    var settings = device.DeviceSettings.FirstOrDefault();
                    if (settings != null)
                    {
                        // Обновляем JSONB settings
                        var settingsDict = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(settings.Settings.ToString() ?? "{}") ?? new Dictionary<string, object>();
                        var currentMode = settingsDict.ContainsKey("mode") ? settingsDict["mode"]?.ToString() : "closed";
                        
                        if (currentMode != targetMode)
                        {
                            settingsDict["mode"] = targetMode;
                            settings.Settings = System.Text.Json.JsonSerializer.Serialize(settingsDict);
                            shouldUpdate = true;
                        }
                    }
                }

                if (shouldUpdate)
                {
                    device.Status = targetStatus;
                    
                    // Записываем событие изменения статуса через расписание
                    var history = new DeviceStatusHistory
                    {
                        DeviceId = device.DeviceId,
                        Status = targetStatus,
                        Timestamp = DateTime.UtcNow,
                        ChangedByUserId = null, // Система
                        ChangeReason = "schedule"
                    };
                    context.DeviceStatusHistories.Add(history);
                    
                    var actionInfo = !string.IsNullOrEmpty(action) ? $"Action: {action}" : $"ActionOn: {schedule.ActionOn}";
                    _logger.LogInformation($"Schedule {schedule.Id} triggered: Device {device.DeviceId} ({device.Name}) -> {targetStatus} ({actionInfo})");
                }
            }

            await context.SaveChangesAsync();
        }
    }
}

