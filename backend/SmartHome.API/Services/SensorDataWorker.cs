using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SmartHome.API.Models;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using SmartHome.API.Services;

namespace SmartHome.API.Services;

public class SensorDataWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SensorDataWorker> _logger;
    private readonly Random _random = new Random();

    public SensorDataWorker(IServiceProvider serviceProvider, ILogger<SensorDataWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    // BackgroundService: хост вызывает ExecuteAsync при старте; тело метода — цикл while + Task.Delay между проходами.
    // В пояснительной записке блок-схема телеметрии — один линейный проход (без цикла и паузы на схеме): загрузка данных → расчёт → Any → SaveChanges → Publish.
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("SensorDataWorker started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using (var scope = _serviceProvider.CreateScope())
                {
                    var context = scope.ServiceProvider.GetRequiredService<SmartHomeContext>();
                    var eventPublisher = scope.ServiceProvider.GetRequiredService<EventPublisher>();
                    var housesById = await context.Houses.AsNoTracking().ToDictionaryAsync(h => h.HouseId, stoppingToken);
                    var windows = await context.Devices
                        .Include(d => d.Room)
                        .Where(d => d.Type == "window")
                        .ToListAsync(stoppingToken);

                    var devices = await context.Devices
                        .Include(d => d.Room)
                        .Where(d => d.Type == "sensor" || d.Type == "thermostat" || (d.Type == "kettle" && d.Status == DeviceStatus.active))
                        .ToListAsync(stoppingToken);

                    foreach (var device in devices)
                    {
                        if (device.Type == "sensor")
                        {
                            var meta = ParseMeta(device.MetaData);
                            var prevTemp = TryGetDouble(meta, "currentTemp") ?? TryGetDouble(meta, "temp") ?? 22.0;
                            var prevHum = TryGetDouble(meta, "humidity") ?? 45.0;
                            var prevCo2 = TryGetDouble(meta, "co2") ?? TryGetDouble(meta, "coPpm") ?? 650.0;

                            var houseId = device.Room?.HouseId ?? 0;
                            housesById.TryGetValue(houseId, out var house);
                            var outdoorTemp = (double?)house?.OutdoorTemp ?? 13.0;
                            var outdoorHum = (double?)house?.OutdoorHumidity ?? 45.0;

                            var roomWindows = windows.Where(w => w.RoomId == device.RoomId).ToList();
                            var windowOpen = roomWindows.Any(w =>
                            {
                                if (w.Status == DeviceStatus.active) return true;
                                var wm = ParseMeta(w.MetaData);
                                var mode = (TryGetString(wm, "mode") ?? "closed").ToLowerInvariant();
                                return mode != "closed";
                            });

                            var thermostat = devices.FirstOrDefault(d => d.Type == "thermostat" && d.Room?.HouseId == houseId);
                            var thermostatMeta = thermostat != null ? ParseMeta(thermostat.MetaData) : new Dictionary<string, object>();
                            var thermostatActive = thermostat?.Status == DeviceStatus.active;
                            var targetTemp = TryGetDouble(thermostatMeta, "targetTemp") ?? 21.0;

                            // Окна открыты -> быстро тянем температуру к улице.
                            // Окна закрыты -> медленный дрейф, а активный термостат тянет к targetTemp.
                            var targetByWindow = windowOpen
                                ? outdoorTemp
                                : (thermostatActive ? targetTemp : (outdoorTemp + 4.0));
                            var tempFactor = windowOpen ? 0.22 : 0.04;
                            var nextTemp = prevTemp + (targetByWindow - prevTemp) * tempFactor;
                            if (!windowOpen && thermostatActive)
                            {
                                nextTemp += (targetTemp - nextTemp) * 0.18;
                            }
                            nextTemp += (_random.NextDouble() - 0.5) * 0.4; // небольшой шум
                            nextTemp = Math.Clamp(nextTemp, -35.0, 60.0);

                            var humTarget = windowOpen ? outdoorHum : 45.0;
                            var humFactor = windowOpen ? 0.18 : 0.05;
                            var nextHum = prevHum + (humTarget - prevHum) * humFactor + (_random.NextDouble() - 0.5) * 1.0;
                            nextHum = Math.Clamp(nextHum, 10.0, 95.0);

                            // При открытых окнах CO2 падает к более "уличному" уровню.
                            var co2Target = windowOpen ? 420.0 : 700.0;
                            var co2Factor = windowOpen ? 0.22 : 0.06;
                            var nextCo2 = prevCo2 + (co2Target - prevCo2) * co2Factor + (_random.NextDouble() - 0.5) * 20.0;
                            nextCo2 = Math.Clamp(nextCo2, 350.0, 2500.0);

                            var temp = (decimal)Math.Round(nextTemp, 1);
                            var hum = (decimal)Math.Round(nextHum, 1);
                            var co2 = (decimal)Math.Round(nextCo2, 0);
                            context.SensorReadings.Add(new SensorReading
                            {
                                DeviceId = device.DeviceId,
                                ReadingType = "temperature",
                                Value = temp,
                                Unit = "°C",
                                RecordedAt = DateTime.UtcNow
                            });
                            context.SensorReadings.Add(new SensorReading
                            {
                                DeviceId = device.DeviceId,
                                ReadingType = "humidity",
                                Value = hum,
                                Unit = "%",
                                RecordedAt = DateTime.UtcNow
                            });
                            context.SensorReadings.Add(new SensorReading
                            {
                                DeviceId = device.DeviceId,
                                ReadingType = "co2",
                                Value = co2, // ~450..1000 ppm
                                Unit = "ppm",
                                RecordedAt = DateTime.UtcNow
                            });

                            meta["temp"] = Math.Round((double)temp, 1);
                            meta["currentTemp"] = Math.Round((double)temp, 1);
                            meta["humidity"] = Math.Round((double)hum, 1);
                            meta["co2"] = Math.Round((double)co2, 0);
                            meta["coPpm"] = Math.Round((double)co2, 0);
                            device.MetaData = JsonSerializer.Serialize(meta);
                        }
                        else if (device.Type == "thermostat")
                        {
                            var meta = ParseMeta(device.MetaData);
                            var prevTemp = TryGetDouble(meta, "currentTemp") ?? 21.0;
                            var targetTemp = TryGetDouble(meta, "targetTemp") ?? 22.0;
                            var isActive = device.Status == DeviceStatus.active;

                            // При включенном кондиционере температура стремится к targetTemp,
                            // при выключенном — плавно возвращается к комнатной (~23°C).
                            var ambientTemp = 23.0;
                            var target = isActive ? targetTemp : ambientTemp;
                            var factor = isActive ? 0.22 : 0.06;
                            var nextTemp = prevTemp + (target - prevTemp) * factor + (_random.NextDouble() - 0.5) * 0.15;
                            nextTemp = Math.Clamp(nextTemp, 10.0, 35.0);
                            var temp = (decimal)Math.Round(nextTemp, 1);

                            context.SensorReadings.Add(new SensorReading
                            {
                                DeviceId = device.DeviceId,
                                ReadingType = "temperature",
                                Value = temp,
                                Unit = "°C",
                                RecordedAt = DateTime.UtcNow
                            });
                            meta["currentTemp"] = Math.Round((double)temp, 1);
                            meta["temp"] = Math.Round((double)temp, 1);
                            device.MetaData = JsonSerializer.Serialize(meta);
                        }
                        else if (device.Type == "kettle")
                        {
                             var temp = (decimal)(20 + _random.NextDouble() * 80);
                             context.SensorReadings.Add(new SensorReading
                            {
                                DeviceId = device.DeviceId,
                                ReadingType = "temperature",
                                Value = temp,
                                Unit = "°C",
                                RecordedAt = DateTime.UtcNow
                            });
                            var meta = ParseMeta(device.MetaData);
                            meta["currentTemp"] = Math.Round((double)temp, 1);
                            device.MetaData = JsonSerializer.Serialize(meta);
                        }
                    }
                    
                    if (devices.Any())
                    {
                        await context.SaveChangesAsync(stoppingToken);

                        foreach (var d in devices)
                        {
                            if (d.Type != "sensor" && d.Type != "thermostat" && d.Type != "kettle") continue;
                            var settings = ParseMeta(d.MetaData);
                            await eventPublisher.PublishAsync("device.settings.updated", new
                            {
                                deviceId = d.DeviceId,
                                settings
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SensorDataWorker");
            }

            // Пауза между итерациями цикла (на схеме — «пауза перед следующей итерацией»).
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        }
    }

    private static Dictionary<string, object> ParseMeta(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return new Dictionary<string, object>();
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, object>>(raw) ?? new Dictionary<string, object>();
        }
        catch
        {
            return new Dictionary<string, object>();
        }
    }

    private static double? TryGetDouble(Dictionary<string, object> meta, string key)
    {
        if (!meta.TryGetValue(key, out var value) || value == null) return null;
        if (value is JsonElement je)
        {
            if (je.ValueKind == JsonValueKind.Number && je.TryGetDouble(out var n)) return n;
            if (je.ValueKind == JsonValueKind.String && double.TryParse(je.GetString(), out var ns)) return ns;
            return null;
        }
        return double.TryParse(value.ToString(), out var d) ? d : null;
    }

    private static string? TryGetString(Dictionary<string, object> meta, string key)
    {
        if (!meta.TryGetValue(key, out var value) || value == null) return null;
        if (value is JsonElement je)
        {
            if (je.ValueKind == JsonValueKind.String) return je.GetString();
            return je.ToString();
        }
        return value.ToString();
    }
}

