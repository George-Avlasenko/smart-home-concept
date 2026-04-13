using Microsoft.EntityFrameworkCore;
using SmartHome.API.Models;
using System.Text;
using System.Text.Json;

namespace SmartHome.API.Services
{
    public class ScheduleWorker : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<ScheduleWorker> _logger;
        private readonly TuyaServiceLocator _tuyaServiceLocator;
        private readonly IConfiguration _configuration;
        private readonly EventPublisher _eventPublisher;
        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

        public ScheduleWorker(
            IServiceScopeFactory scopeFactory,
            ILogger<ScheduleWorker> logger,
            TuyaServiceLocator tuyaServiceLocator,
            IConfiguration configuration,
            EventPublisher eventPublisher)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
            _tuyaServiceLocator = tuyaServiceLocator;
            _configuration = configuration;
            _eventPublisher = eventPublisher;
        }

        /// <summary>
        /// «Настенные часы» для расписаний: не зависит от перевода LINQ (time) в SQL у Npgsql.
        /// TimeZoneId из конфига (и docker Schedule__TimeZoneId), иначе DateTime.Now (учитывает TZ контейнера).
        /// </summary>
        private DateTime GetScheduleWallClockNow()
        {
            var id = _configuration["Schedule:TimeZoneId"]?.Trim();
            if (string.IsNullOrEmpty(id))
                return DateTime.Now;
            try
            {
                var tz = TimeZoneInfo.FindSystemTimeZoneById(id);
                return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
            }
            catch (TimeZoneNotFoundException)
            {
                _logger.LogWarning("Schedule:TimeZoneId \"{Tz}\" не найден, используем DateTime.Now", id);
                return DateTime.Now;
            }
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

                // Проверяем каждую секунду: срабатывание почти ровно в HH:mm:00, без случайных +30с.
                await Task.Delay(1000, stoppingToken);
            }
        }

        private async Task ProcessSchedules()
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<SmartHomeContext>();
            var httpClientFactory = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();
            var statusEvents = new Dictionary<int, DeviceStatus>();
            var refreshDeviceIds = new HashSet<int>();

            var now = GetScheduleWallClockNow();
            var currentDay = ((int)now.DayOfWeek).ToString(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            var wallHour = now.Hour;
            var wallMinute = now.Minute;

            // Фильтр по часу/минуте в памяти: надёжнее, чем s.Time.Hours в SQL (Npgsql time + EF).
            var schedules = (await context.DeviceSchedules
                    .Where(s => s.IsEnabled)
                    .ToListAsync())
                .Where(s => s.Time.Hours == wallHour && s.Time.Minutes == wallMinute)
                .ToList();

            if (schedules.Count > 0)
            {
                _logger.LogDebug(
                    "ScheduleWorker: wall clock {Wall:HH:mm} (dow {Dow}), matched {Count} device rule(s)",
                    now,
                    currentDay,
                    schedules.Count);
            }

            foreach (var schedule in schedules)
            {
                // Дни: "1,2,3" … 0=Вс. Пустая строка = одноразовое правило (после срабатывания отключается).
                var days = schedule.DaysOfWeek.Split(',', StringSplitOptions.RemoveEmptyEntries);
                if (days.Length > 0 && !days.Contains(currentDay)) continue;

                if (schedule.LastTriggeredAt.HasValue &&
                    (DateTime.UtcNow - schedule.LastTriggeredAt.Value).TotalSeconds < 85)
                    continue;

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

                bool shouldUpdate = device.Status != targetStatus;
                var settingsDict = BuildScheduleSettingsDict(device);

                // Окно: mode в MetaData (как у остальных устройств), не только в legacy device_settings.
                if (device.Type.ToLower() == "window" && !string.IsNullOrEmpty(targetMode))
                {
                    var currentMode = settingsDict.TryGetValue("mode", out var m) ? m?.ToString() : "closed";
                    if (currentMode != targetMode)
                    {
                        settingsDict["mode"] = targetMode;
                        device.MetaData = JsonSerializer.Serialize(settingsDict, JsonOptions);
                        shouldUpdate = true;
                    }
                }

                // Для Tuya-ламп пробуем LAN; при сбое всё равно обновляем БД, если статус должен смениться.
                if (device.Type.Equals("light", StringComparison.OrdinalIgnoreCase) && IsTuyaEnabled(settingsDict))
                {
                    var sent = await SendTuyaByScheduleAsync(httpClientFactory, _tuyaServiceLocator, settingsDict, targetStatus);
                    if (!sent)
                    {
                        _logger.LogWarning(
                            "Schedule {ScheduleId}: Tuya LAN failed for light {DeviceId}; applying DB state if needed",
                            schedule.Id,
                            device.DeviceId);
                    }
                }

                if (shouldUpdate)
                {
                    device.Status = targetStatus;
                    statusEvents[device.DeviceId] = targetStatus;
                    refreshDeviceIds.Add(device.DeviceId);
                    
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

                schedule.LastTriggeredAt = DateTime.UtcNow;
                if (days.Length == 0)
                    schedule.IsEnabled = false;
            }

            await ProcessScenarioGroupSchedulesAsync(context, httpClientFactory, currentDay, now, refreshDeviceIds);

            await context.SaveChangesAsync();

            foreach (var (deviceId, status) in statusEvents)
            {
                await _eventPublisher.PublishAsync("device.status.updated", new
                {
                    deviceId,
                    status = status.ToString().ToLowerInvariant(),
                });
            }

            foreach (var deviceId in refreshDeviceIds)
            {
                await _eventPublisher.PublishAsync("device.updated", new { deviceId });
            }
        }

        private async Task ProcessScenarioGroupSchedulesAsync(
            SmartHomeContext context,
            IHttpClientFactory httpClientFactory,
            string currentDay,
            DateTime now,
            HashSet<int> refreshDeviceIds)
        {
            var gh = now.Hour;
            var gm = now.Minute;
            var list = (await context.ScenarioGroupSchedules
                    .Include(s => s.Group)
                    .Where(s => s.IsEnabled)
                    .ToListAsync())
                .Where(s => s.Time.Hours == gh && s.Time.Minutes == gm)
                .ToList();

            if (list.Count > 0)
            {
                _logger.LogDebug(
                    "ScheduleWorker: wall clock {Wall:HH:mm}, matched {Count} group rule(s)",
                    now,
                    list.Count);
            }

            foreach (var sch in list)
            {
                var days = sch.DaysOfWeek.Split(',', StringSplitOptions.RemoveEmptyEntries);
                if (days.Length > 0 && !days.Contains(currentDay))
                    continue;

                if (sch.LastTriggeredAt.HasValue && (DateTime.UtcNow - sch.LastTriggeredAt.Value).TotalSeconds < 85)
                    continue;

                await ScenarioGroupApplyHelper.ApplyGroupAsync(
                    context,
                    httpClientFactory,
                    _tuyaServiceLocator,
                    _logger,
                    sch.Group);
                foreach (var deviceId in ExtractGroupDeviceIds(sch.Group.CommandsJson))
                    refreshDeviceIds.Add(deviceId);

                sch.LastTriggeredAt = DateTime.UtcNow;
                if (days.Length == 0)
                    sch.IsEnabled = false;
                _logger.LogInformation(
                    "Scenario group schedule {ScheduleId} fired for group {GroupId}",
                    sch.ScheduleId,
                    sch.GroupId);
            }
        }

        private static List<int> ExtractGroupDeviceIds(string? commandsJson)
        {
            var ids = new List<int>();
            if (string.IsNullOrWhiteSpace(commandsJson))
                return ids;

            JsonDocument? doc = null;
            try
            {
                doc = JsonDocument.Parse(commandsJson);
                if (doc.RootElement.ValueKind != JsonValueKind.Array)
                    return ids;
                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    if (el.TryGetProperty("deviceId", out var did) && did.ValueKind == JsonValueKind.Number && did.TryGetInt32(out var id))
                        ids.Add(id);
                }
            }
            catch
            {
                return ids;
            }
            finally
            {
                doc?.Dispose();
            }
            return ids;
        }

        private static Dictionary<string, object> ParseSettings(string? settingsJson)
        {
            if (string.IsNullOrWhiteSpace(settingsJson)) return new Dictionary<string, object>();
            try
            {
                return JsonSerializer.Deserialize<Dictionary<string, object>>(settingsJson, JsonOptions) ?? new Dictionary<string, object>();
            }
            catch
            {
                return new Dictionary<string, object>();
            }
        }

        /// <summary>Tuya и яркость живут в MetaData; device_settings — запасной источник.</summary>
        private static Dictionary<string, object> BuildScheduleSettingsDict(Device device)
        {
            var merged = DeviceMetaHelper.ParseToNestedObjects(device.MetaData);
            var row = device.DeviceSettings.FirstOrDefault();
            var legacy = ParseSettings(row?.Settings);
            foreach (var kv in legacy)
            {
                if (!merged.ContainsKey(kv.Key))
                    merged[kv.Key] = kv.Value;
            }

            return merged;
        }

        private static bool IsTuyaEnabled(Dictionary<string, object> settingsDict)
        {
            if (!settingsDict.TryGetValue("tuya", out var tuyaObj) || tuyaObj is null) return false;
            try
            {
                var tuyaJson = JsonSerializer.Serialize(tuyaObj, JsonOptions);
                using var doc = JsonDocument.Parse(tuyaJson);
                if (!doc.RootElement.TryGetProperty("enabled", out var enabled)) return false;
                return enabled.ValueKind == JsonValueKind.True ||
                       (enabled.ValueKind == JsonValueKind.String && bool.TryParse(enabled.GetString(), out var b) && b);
            }
            catch
            {
                return false;
            }
        }

        private async Task<bool> SendTuyaByScheduleAsync(
            IHttpClientFactory httpClientFactory,
            TuyaServiceLocator tuyaLocator,
            Dictionary<string, object> settingsDict,
            DeviceStatus targetStatus)
        {
            if (!settingsDict.TryGetValue("tuya", out var tuyaObj) || tuyaObj is null) return false;

            string? deviceId = null;
            string? localKey = null;
            string? ip = null;
            string version = "3.5";
            int dpsSwitch = 20;
            int? brightnessPercent = null;
            int? colorTempKelvin = null;

            try
            {
                var tuyaJson = JsonSerializer.Serialize(tuyaObj, JsonOptions);
                using var doc = JsonDocument.Parse(tuyaJson);
                var root = doc.RootElement;

                deviceId = root.TryGetProperty("deviceId", out var d) ? d.GetString() : null;
                localKey = root.TryGetProperty("localKey", out var k) ? k.GetString() : null;
                ip = root.TryGetProperty("ip", out var i) ? i.GetString() : null;
                if (root.TryGetProperty("version", out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString()))
                    version = v.GetString()!;
                if (root.TryGetProperty("dpsSwitch", out var ds))
                {
                    if (ds.ValueKind == JsonValueKind.Number && ds.TryGetInt32(out var parsed)) dpsSwitch = parsed;
                    else if (ds.ValueKind == JsonValueKind.String && int.TryParse(ds.GetString(), out var parsedStr)) dpsSwitch = parsedStr;
                }

                if (settingsDict.TryGetValue("brightness", out var bObj))
                {
                    if (bObj is JsonElement be && be.ValueKind == JsonValueKind.Number && be.TryGetInt32(out var bNum)) brightnessPercent = bNum;
                    else if (int.TryParse(bObj?.ToString(), out var bParsed)) brightnessPercent = bParsed;
                }
                if (settingsDict.TryGetValue("colorTempKelvin", out var tObj))
                {
                    if (tObj is JsonElement te && te.ValueKind == JsonValueKind.Number && te.TryGetInt32(out var tNum)) colorTempKelvin = tNum;
                    else if (int.TryParse(tObj?.ToString(), out var tParsed)) colorTempKelvin = tParsed;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse Tuya settings for schedule");
                return false;
            }

            if (string.IsNullOrWhiteSpace(deviceId) || string.IsNullOrWhiteSpace(localKey) || string.IsNullOrWhiteSpace(ip))
                return false;

            var basePayload = new
            {
                device_id = deviceId.Trim(),
                local_key = localKey,
                ip = ip.Trim(),
                version,
                dps_switch = dpsSwitch > 0 ? dpsSwitch : 20
            };

            var tuyaBaseUrl = await tuyaLocator.GetReachableBaseUrlAsync();
            if (string.IsNullOrEmpty(tuyaBaseUrl))
                return false;

            var client = httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(8);

            try
            {
                // 1) always switch on/off by schedule action
                using var switchResp = await client.PostAsync(
                    $"{tuyaBaseUrl.TrimEnd('/')}/v1/switch",
                    new StringContent(JsonSerializer.Serialize(new { basePayload.device_id, basePayload.local_key, basePayload.ip, basePayload.version, basePayload.dps_switch, on = targetStatus == DeviceStatus.active }, JsonOptions), Encoding.UTF8, "application/json"));
                if (!switchResp.IsSuccessStatusCode) return false;

                // 2) if turning on, apply current brightness and color temperature (if set)
                if (targetStatus == DeviceStatus.active && brightnessPercent.HasValue)
                {
                    var bright = Math.Clamp(brightnessPercent.Value, 1, 100);
                    using var brResp = await client.PostAsync(
                        $"{tuyaBaseUrl.TrimEnd('/')}/v1/brightness",
                        new StringContent(JsonSerializer.Serialize(new { basePayload.device_id, basePayload.local_key, basePayload.ip, basePayload.version, basePayload.dps_switch, percent = bright }, JsonOptions), Encoding.UTF8, "application/json"));
                    if (!brResp.IsSuccessStatusCode) return false;
                }

                if (targetStatus == DeviceStatus.active && colorTempKelvin.HasValue)
                {
                    var kelvin = Math.Clamp(colorTempKelvin.Value, 2700, 6500);
                    using var tResp = await client.PostAsync(
                        $"{tuyaBaseUrl.TrimEnd('/')}/v1/temperature",
                        new StringContent(JsonSerializer.Serialize(new { basePayload.device_id, basePayload.local_key, basePayload.ip, basePayload.version, basePayload.dps_switch, kelvin }, JsonOptions), Encoding.UTF8, "application/json"));
                    if (!tResp.IsSuccessStatusCode) return false;
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send Tuya command from schedule");
                return false;
            }
        }
    }
}

