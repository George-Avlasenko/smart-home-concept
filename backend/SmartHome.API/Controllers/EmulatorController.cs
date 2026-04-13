using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHome.API.DTOs;
using SmartHome.API.Models;
using SmartHome.API.Services;

namespace SmartHome.API.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class EmulatorController : ControllerBase
{
    private readonly SmartHomeContext _context;
    private readonly EventPublisher _eventPublisher;

    public EmulatorController(SmartHomeContext context, EventPublisher eventPublisher)
    {
        _context = context;
        _eventPublisher = eventPublisher;
    }

    private int GetUserId()
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) throw new UnauthorizedAccessException("Missing userId");
        return int.Parse(claim.Value);
    }

    private bool IsDemoUser()
    {
        var name = User.FindFirst(ClaimTypes.Name)?.Value;
        return string.Equals(name, "demo", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Создать демо-дом с комнатами и устройствами, если ещё нет. Только для пользователя demo.
    /// </summary>
    [HttpPost("ensure-demo-house")]
    public async Task<IActionResult> EnsureDemoHouse()
    {
        if (!IsDemoUser())
            return Forbid("Только пользователь demo может вызвать этот метод.");

        var userId = GetUserId();
        var existing = await _context.Houses
            .FirstOrDefaultAsync(h => h.OwnerId == userId && h.Address == "Демо-дом");
        if (existing != null)
        {
            await SetDefaultClimateRanges(existing);
            var devices = await GetHouseDevicesSummary(existing.HouseId);
            return Ok(new { houseId = existing.HouseId, devices });
        }

        var house = new House
        {
            Address = "Демо-дом",
            OwnerId = userId,
            CreatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified),
            MinTemp = 18,
            MaxTemp = 24,
            MinHumidity = 30,
            MaxHumidity = 60,
            MaxCo2 = 1000
        };
        _context.Houses.Add(house);
        await _context.SaveChangesAsync();

        var roomNames = new[] { "Прихожая", "Кухня", "Гостиная", "Спальня" };
        var rooms = new List<Room>();
        foreach (var name in roomNames)
        {
            var room = new Room
            {
                HouseId = house.HouseId,
                RoomName = name,
                Floor = 1
            };
            _context.Rooms.Add(room);
            rooms.Add(room);
        }
        await _context.SaveChangesAsync();

        // Все типы устройств, раскиданы по комнатам (Прихожая=0, Кухня=1, Гостиная=2, Спальня=3)
        var roomIds = rooms.Select(r => r.RoomId).ToList();
        var devicesToCreate = new List<(int RoomIndex, string Type, string Name)>
        {
            (0, "sensor", "Датчик прихожей"),
            (0, "light", "Свет прихожей"),
            (0, "window", "Окно прихожей"),
            (0, "switch", "Выключатель прихожей"),
            (0, "outlet", "Розетка прихожей"),
            (0, "lock", "Замок входной двери"),
            (0, "camera", "Камера прихожей"),
            (1, "sensor", "Датчик кухни"),
            (1, "light", "Свет кухни"),
            (1, "window", "Окно кухни"),
            (1, "kettle", "Чайник"),
            (1, "switch", "Выключатель кухни"),
            (1, "outlet", "Розетка кухни"),
            (2, "sensor", "Датчик гостиной"),
            (2, "light", "Свет гостиной"),
            (2, "window", "Окно гостиной"),
            (2, "thermostat", "Кондиционер"),
            (2, "humidifier", "Увлажнитель"),
            (2, "ventilation", "Вентиляция"),
            (2, "vacuum", "Робот-пылесос"),
            (2, "curtain", "Шторы гостиной"),
            (2, "switch", "Выключатель гостиной"),
            (2, "outlet", "Розетка гостиной"),
            (3, "sensor", "Датчик спальни"),
            (3, "light", "Свет спальни"),
            (3, "window", "Окно спальни"),
            (3, "curtain", "Шторы спальни"),
            (3, "switch", "Выключатель спальни"),
            (3, "outlet", "Розетка спальни")
        };

        int ipLastOctet = 10;
        foreach (var (roomIndex, type, name) in devicesToCreate)
        {
            var catalogProduct = DeviceProductCatalog.All.FirstOrDefault(p =>
                p.Type.Equals(type, StringComparison.OrdinalIgnoreCase));
            var sku = catalogProduct?.Sku ?? "sh-sensor-01";
            var meta = new Dictionary<string, object> { ["catalogSku"] = sku };
            if (type.Equals("light", StringComparison.OrdinalIgnoreCase) && catalogProduct != null)
                meta["lightCapabilities"] = LightCapabilitiesHelper.FromCatalogFeatures(catalogProduct.Features);
            if (type == "thermostat")
            {
                meta["targetTemp"] = 21.0;
                meta["mode"] = "cool";
            }
            if (type == "window")
                meta["mode"] = "closed";

            var device = new Device
            {
                RoomId = roomIds[roomIndex],
                Name = name,
                Type = type,
                Manufacturer = catalogProduct?.Manufacturer ?? "SmartHome Demo",
                HardwareDeviceId = $"SN-{type}-{house.HouseId}-{ipLastOctet}",
                Ip = System.Net.IPAddress.Parse($"192.168.1.{ipLastOctet}"),
                MacAddress = $"02:00:00:00:{ipLastOctet:X2}:{roomIndex:X2}",
                Status = type == "sensor" ? DeviceStatus.active : DeviceStatus.inactive,
                MetaData = JsonSerializer.Serialize(meta),
                CreatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified)
            };
            ipLastOctet++;
            _context.Devices.Add(device);
        }
        await _context.SaveChangesAsync();

        var deviceList = await GetHouseDevicesSummary(house.HouseId);
        return Ok(new { houseId = house.HouseId, devices = deviceList });
    }

    private async Task SetDefaultClimateRanges(House house)
    {
        if (house.MinTemp.HasValue) return;
        house.MinTemp = 18;
        house.MaxTemp = 24;
        house.MinHumidity = 30;
        house.MaxHumidity = 60;
        house.MaxCo2 = 1000;
        await _context.SaveChangesAsync();
    }

    private async Task<List<object>> GetHouseDevicesSummary(int houseId)
    {
        var rooms = await _context.Rooms.Where(r => r.HouseId == houseId).ToListAsync();
        var roomIds = rooms.Select(r => r.RoomId).ToList();
        var devices = await _context.Devices
            .Where(d => roomIds.Contains(d.RoomId))
            .Select(d => new { d.DeviceId, d.Type, d.RoomId, d.Name })
            .ToListAsync();
        return devices.Cast<object>().ToList();
    }

    /// <summary>
    /// Принять показания от эмулятора (только пользователь demo).
    /// Обновляет SensorReadings, MetaData устройств, уличные показания дома и запускает авто-логику по диапазонам.
    /// </summary>
    [HttpPost("readings")]
    public async Task<IActionResult> PostReadings([FromBody] EmulatorReadingsDto dto)
    {
        if (!IsDemoUser())
            return Forbid("Только пользователь demo может отправлять показания эмулятора.");

        var house = await _context.Houses
            .Include(h => h.Rooms)
            .FirstOrDefaultAsync(h => h.HouseId == dto.HouseId);
        if (house == null)
            return NotFound("Дом не найден.");

        var now = DateTime.UtcNow;

        // 1. Уличные показания
        if (dto.Outdoor != null)
        {
            if (dto.Outdoor.Temp.HasValue) house.OutdoorTemp = dto.Outdoor.Temp;
            if (dto.Outdoor.Humidity.HasValue) house.OutdoorHumidity = dto.Outdoor.Humidity;
            if (dto.Outdoor.Co2.HasValue) house.OutdoorCo2 = dto.Outdoor.Co2;
            await _eventPublisher.PublishAsync("house.outdoor_updated", new
            {
                houseId = dto.HouseId,
                outdoorTemp = house.OutdoorTemp,
                outdoorHumidity = house.OutdoorHumidity,
                outdoorCo2 = house.OutdoorCo2
            });
        }

        var updatedDeviceIds = new List<int>();

        // 2. Показания по устройствам
        foreach (var r in dto.Readings)
        {
            var device = await _context.Devices
                .Include(d => d.Room)
                .FirstOrDefaultAsync(d => d.DeviceId == r.DeviceId);
            if (device == null || device.Room.HouseId != dto.HouseId)
                continue;

            var meta = GetOrNewMeta(device.MetaData);

            if (r.Temperature.HasValue)
            {
                meta["currentTemp"] = (double)r.Temperature.Value;
                meta["temp"] = (double)r.Temperature.Value;
                _context.SensorReadings.Add(new SensorReading
                {
                    DeviceId = device.DeviceId,
                    ReadingType = "temperature",
                    Value = r.Temperature.Value,
                    Unit = "°C",
                    RecordedAt = now
                });
            }
            if (r.Humidity.HasValue)
            {
                meta["humidity"] = (double)r.Humidity.Value;
                _context.SensorReadings.Add(new SensorReading
                {
                    DeviceId = device.DeviceId,
                    ReadingType = "humidity",
                    Value = r.Humidity.Value,
                    Unit = "%",
                    RecordedAt = now
                });
            }
            if (r.Co2.HasValue)
            {
                meta["co2"] = (double)r.Co2.Value;
                meta["coPpm"] = (double)r.Co2.Value;
                _context.SensorReadings.Add(new SensorReading
                {
                    DeviceId = device.DeviceId,
                    ReadingType = "co2",
                    Value = r.Co2.Value,
                    Unit = "ppm",
                    RecordedAt = now
                });
            }
            if (r.WaterTemp.HasValue)
            {
                meta["currentTemp"] = (double)r.WaterTemp.Value;
                _context.SensorReadings.Add(new SensorReading
                {
                    DeviceId = device.DeviceId,
                    ReadingType = "temperature",
                    Value = r.WaterTemp.Value,
                    Unit = "°C",
                    RecordedAt = now
                });
            }

            device.MetaData = JsonSerializer.Serialize(meta);
            updatedDeviceIds.Add(device.DeviceId);
        }

        await _context.SaveChangesAsync();

        // 2b. Подставить среднюю влажность (и температуру) по дому в увлажнитель и термостат, чтобы в карточках всегда были данные
        var sensorsInHouse = await _context.Devices
            .Include(d => d.Room)
            .Where(d => d.Room.HouseId == dto.HouseId && d.Type.ToLower() == "sensor")
            .ToListAsync();
        double avgHumidity = 45;
        double avgTemp = 21;
        if (sensorsInHouse.Count > 0)
        {
            var humList = new List<double>();
            var tempList = new List<double>();
            foreach (var s in sensorsInHouse)
            {
                var m = GetOrNewMeta(s.MetaData);
                if (m.TryGetValue("humidity", out var h)) humList.Add(Convert.ToDouble(h));
                if (m.TryGetValue("currentTemp", out var t) || m.TryGetValue("temp", out t)) tempList.Add(Convert.ToDouble(t));
            }
            if (humList.Count > 0) avgHumidity = humList.Average();
            if (tempList.Count > 0) avgTemp = tempList.Average();
        }
        var climateDevices = await _context.Devices
            .Include(d => d.Room)
            .Where(d => d.Room.HouseId == dto.HouseId && (d.Type.ToLower() == "humidifier" || d.Type.ToLower() == "thermostat"))
            .ToListAsync();
        foreach (var dev in climateDevices)
        {
            var meta = GetOrNewMeta(dev.MetaData);
            meta["humidity"] = Math.Round(avgHumidity, 1);
            if (dev.Type.ToLower() == "thermostat")
                meta["currentTemp"] = Math.Round(avgTemp, 1);
            dev.MetaData = JsonSerializer.Serialize(meta);
            updatedDeviceIds.Add(dev.DeviceId);
        }
        await _context.SaveChangesAsync();

        // 3. События для фронта
        foreach (var deviceId in updatedDeviceIds)
        {
            var device = await _context.Devices.FindAsync(deviceId);
            if (device == null) continue;
            var meta = GetOrNewMeta(device.MetaData);
            await _eventPublisher.PublishAsync("device.settings.updated", new
            {
                deviceId,
                settings = meta,
                changedBy = GetUserId()
            });
        }

        // 4. Авто-логика по диапазонам (температура, влажность, CO2)
        await RunClimateAutomationAsync(dto.HouseId);

        return Ok(new { updated = updatedDeviceIds.Count });
    }

    private static Dictionary<string, object> GetOrNewMeta(string? metaData)
    {
        if (string.IsNullOrWhiteSpace(metaData))
            return new Dictionary<string, object>();
        try
        {
            var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(metaData);
            if (dict == null) return new Dictionary<string, object>();
            var result = new Dictionary<string, object>();
            foreach (var kv in dict)
            {
                result[kv.Key] = kv.Value.ValueKind switch
                {
                    JsonValueKind.Number when kv.Value.TryGetDouble(out var d) => d,
                    JsonValueKind.String => kv.Value.GetString() ?? "",
                    JsonValueKind.True => true,
                    JsonValueKind.False => false,
                    _ => kv.Value.GetRawText()
                };
            }
            return result;
        }
        catch
        {
            return new Dictionary<string, object>();
        }
    }

    private async Task RunClimateAutomationAsync(int houseId)
    {
        var house = await _context.Houses
            .Include(h => h.Rooms)
            .ThenInclude(r => r.Devices)
            .FirstOrDefaultAsync(h => h.HouseId == houseId);
        if (house == null) return;

        var roomIds = house.Rooms.Select(r => r.RoomId).ToList();
        var allDevices = await _context.Devices
            .Where(d => roomIds.Contains(d.RoomId))
            .ToListAsync();

        var minTemp = (double)(house.MinTemp ?? 18m);
        var maxTemp = (double)(house.MaxTemp ?? 24m);
        var minHumidity = (double)(house.MinHumidity ?? 30m);
        var maxHumidity = (double)(house.MaxHumidity ?? 60m);
        var maxCo2 = (double)(house.MaxCo2 ?? 1000m);

        // Средние показания по дому из датчиков
        double? avgTemp = null, avgHumidity = null, avgCo2 = null;
        var sensorDevices = allDevices.Where(d => d.Type == "sensor").ToList();
        if (sensorDevices.Count > 0)
        {
            double sumT = 0, sumH = 0, sumC = 0;
            int cT = 0, cH = 0, cC = 0;
            foreach (var d in sensorDevices)
            {
                var meta = GetOrNewMeta(d.MetaData);
                if (meta.TryGetValue("currentTemp", out var t)) { sumT += Convert.ToDouble(t); cT++; }
                if (meta.TryGetValue("humidity", out var h)) { sumH += Convert.ToDouble(h); cH++; }
                if (meta.TryGetValue("co2", out var c) || meta.TryGetValue("coPpm", out c)) { sumC += Convert.ToDouble(c); cC++; }
            }
            if (cT > 0) avgTemp = sumT / cT;
            if (cH > 0) avgHumidity = sumH / cH;
            if (cC > 0) avgCo2 = sumC / cC;
        }

        var thermostat = allDevices.FirstOrDefault(d => d.Type == "thermostat");
        var humidifier = allDevices.FirstOrDefault(d => d.Type == "humidifier");
        var ventilation = allDevices.FirstOrDefault(d => d.Type == "ventilation");
        var windows = allDevices.Where(d => d.Type == "window").ToList();

        // Температура: только если в карточке включён "Автовключение по температуре"
        if (thermostat != null && avgTemp.HasValue)
        {
            var meta = GetOrNewMeta(thermostat.MetaData);
            var autoOn = meta.TryGetValue("autoOn", out var ao) && (ao is bool ab && ab || ao?.ToString()?.ToLowerInvariant() == "true");
            if (!autoOn) { /* не трогаем кондей */ }
            else
            {
            var targetTemp = meta.TryGetValue("targetTemp", out var tt) ? Convert.ToDouble(tt) : 21.0;
            var currentStatus = thermostat.Status;
            var useRangeFromDevice = meta.TryGetValue("useTempRange", out var ur) && (ur is bool b && b || (ur?.ToString()?.ToLowerInvariant() == "true"));
            var minTempDevice = meta.TryGetValue("minTemp", out var mt) ? Convert.ToDouble(mt) : (double?)null;
            var maxTempDevice = meta.TryGetValue("maxTemp", out var mx) ? Convert.ToDouble(mx) : (double?)null;
            var useRange = useRangeFromDevice ? true : house.UseTempRange;
            var rangeMin = useRangeFromDevice && minTempDevice.HasValue ? minTempDevice.Value : minTemp;
            var rangeMax = useRangeFromDevice && maxTempDevice.HasValue ? maxTempDevice.Value : maxTemp;

            if (useRange)
            {
                // По диапазону: ниже мин → включить нагрев до макс; выше макс → охлаждение до мин; внутри диапазона → выкл
                if (avgTemp.Value < rangeMin)
                {
                    meta["targetTemp"] = (double)rangeMax;
                    meta["mode"] = "heat";
                    thermostat.MetaData = JsonSerializer.Serialize(meta);
                    if (currentStatus != DeviceStatus.active) { thermostat.Status = DeviceStatus.active; AddStatusHistory(thermostat.DeviceId, DeviceStatus.active, "system"); await PublishDeviceStatusAndSettings(thermostat); }
                }
                else if (avgTemp.Value > rangeMax)
                {
                    meta["targetTemp"] = (double)rangeMin;
                    meta["mode"] = "cool";
                    thermostat.MetaData = JsonSerializer.Serialize(meta);
                    if (currentStatus != DeviceStatus.active) { thermostat.Status = DeviceStatus.active; AddStatusHistory(thermostat.DeviceId, DeviceStatus.active, "system"); await PublishDeviceStatusAndSettings(thermostat); }
                }
                else
                {
                    if (currentStatus == DeviceStatus.active) { thermostat.Status = DeviceStatus.inactive; AddStatusHistory(thermostat.DeviceId, DeviceStatus.inactive, "system"); await PublishDeviceStatus(thermostat); }
                }
            }
            else
            {
                // Одна цель: пользовательская targetTemp, только вкл/выкл
                if (avgTemp.Value > targetTemp + 0.5 || avgTemp.Value < targetTemp - 0.5)
                {
                    if (currentStatus != DeviceStatus.active) { thermostat.Status = DeviceStatus.active; AddStatusHistory(thermostat.DeviceId, DeviceStatus.active, "system"); await PublishDeviceStatus(thermostat); }
                }
                else if (currentStatus == DeviceStatus.active && Math.Abs(avgTemp.Value - targetTemp) < 0.5)
                {
                    thermostat.Status = DeviceStatus.inactive;
                    AddStatusHistory(thermostat.DeviceId, DeviceStatus.inactive, "system");
                    await PublishDeviceStatus(thermostat);
                }
            }
            }
        }

        // Вентиляция: диапазон CO2 — опциональная автофункция.
        if (ventilation != null && avgCo2.HasValue)
        {
            var vMeta = GetOrNewMeta(ventilation.MetaData);
            var useRange = vMeta.TryGetValue("useCo2Range", out var ur) &&
                (ur is bool ub && ub || ur?.ToString()?.ToLowerInvariant() == "true");
            if (!useRange) goto VentilationDone;

            var rangeMin = vMeta.TryGetValue("co2Min", out var vmin) ? Convert.ToDouble(vmin) : 600.0;
            var rangeMax = vMeta.TryGetValue("co2Max", out var vmax) ? Convert.ToDouble(vmax) : 1200.0;
            if (rangeMax < rangeMin + 100) rangeMax = rangeMin + 100;

            var currentStatus = ventilation.Status;
            if (avgCo2.Value > rangeMax)
            {
                if (currentStatus != DeviceStatus.active)
                {
                    ventilation.Status = DeviceStatus.active;
                    AddStatusHistory(ventilation.DeviceId, DeviceStatus.active, "system");
                    await PublishDeviceStatusAndSettings(ventilation);
                }
            }
            else if (avgCo2.Value < rangeMin)
            {
                if (currentStatus != DeviceStatus.inactive)
                {
                    ventilation.Status = DeviceStatus.inactive;
                    AddStatusHistory(ventilation.DeviceId, DeviceStatus.inactive, "system");
                    await PublishDeviceStatusAndSettings(ventilation);
                }
            }
        }
        VentilationDone:;

        // Окна: автозакрытие в дождь — если в карточке включено и влажность на улице >= порога
        var outdoorHum = house.OutdoorHumidity.HasValue ? (double)house.OutdoorHumidity.Value : (double?)null;
        foreach (var win in windows)
        {
            var wMeta = GetOrNewMeta(win.MetaData);
            var autoCloseInRain = wMeta.TryGetValue("autoCloseInRain", out var aor) && (aor is bool ar && ar || aor?.ToString()?.ToLowerInvariant() == "true");
            if (!autoCloseInRain || !outdoorHum.HasValue) continue;
            var rainThreshold = wMeta.TryGetValue("rainHumidityThreshold", out var rht) ? Convert.ToDouble(rht) : 85.0;
            if (outdoorHum.Value >= rainThreshold)
            {
                var mode = wMeta.TryGetValue("mode", out var m) ? m?.ToString() : "closed";
                if (mode != "closed" && win.Status != DeviceStatus.inactive)
                {
                    wMeta["mode"] = "closed";
                    win.MetaData = JsonSerializer.Serialize(wMeta);
                    win.Status = DeviceStatus.inactive;
                    AddStatusHistory(win.DeviceId, DeviceStatus.inactive, "system");
                    await PublishDeviceStatusAndSettings(win);
                }
            }
        }

        await _context.SaveChangesAsync();
    }

    private void AddStatusHistory(int deviceId, DeviceStatus status, string reason)
    {
        _context.DeviceStatusHistories.Add(new DeviceStatusHistory
        {
            DeviceId = deviceId,
            Status = status,
            Timestamp = DateTime.UtcNow,
            ChangedByUserId = null,
            ChangeReason = reason
        });
    }

    private async Task PublishDeviceStatus(Device device)
    {
        await _eventPublisher.PublishAsync("device.status.updated", new
        {
            deviceId = device.DeviceId,
            status = device.Status.ToString()
        });
    }

    private async Task PublishDeviceStatusAndSettings(Device device)
    {
        await _eventPublisher.PublishAsync("device.status.updated", new
        {
            deviceId = device.DeviceId,
            status = device.Status.ToString()
        });
        var meta = GetOrNewMeta(device.MetaData);
        await _eventPublisher.PublishAsync("device.settings.updated", new
        {
            deviceId = device.DeviceId,
            settings = meta,
            changedBy = GetUserId()
        });
    }
}
