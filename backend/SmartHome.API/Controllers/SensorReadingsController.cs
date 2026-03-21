using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHome.API.DTOs;
using SmartHome.API.Models;
using System.Security.Claims;

namespace SmartHome.API.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class SensorReadingsController : ControllerBase
{
    private readonly SmartHomeContext _context;

    public SensorReadingsController(SmartHomeContext context)
    {
        _context = context;
    }

    private int GetUserId()
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) 
        {
            throw new UnauthorizedAccessException("Token is invalid: missing userId claim");
        }
        return int.Parse(claim.Value);
    }

    // GET: api/sensorreadings/device/5?limit=500&days=7
    [HttpGet("device/{deviceId}")]
    public async Task<ActionResult<IEnumerable<SensorReadingDto>>> GetDeviceReadings(int deviceId, [FromQuery] int limit = 500, [FromQuery] int? days = null)
    {
        try
        {
            var userId = GetUserId();
            
            var device = await _context.Devices
                .Include(d => d.Room)
                .ThenInclude(r => r.House)
                .FirstOrDefaultAsync(d => d.DeviceId == deviceId);

            if (device == null) return NotFound("Device not found");

            bool hasAccess = false;
            if (User.IsInRole("admin")) 
            {
                hasAccess = true;
            }
            else if (device.Room.House.OwnerId == userId) 
            {
                hasAccess = true;
            }
            else
            {
                 var permission = await _context.UserDevicePermissions
                    .FirstOrDefaultAsync(p => p.DeviceId == deviceId && p.UserId == userId);
                 
                 if (permission != null) hasAccess = true;
                 else 
                 {
                     var houseUser = await _context.HouseUsers
                        .FirstOrDefaultAsync(hu => hu.HouseId == device.Room.HouseId && hu.UserId == userId);
                     if (houseUser != null) hasAccess = true;
                 }
            }

            if (!hasAccess) return Forbid();

            var baseQuery = _context.SensorReadings.Where(r => r.DeviceId == deviceId);
            if (days.HasValue && days.Value > 0)
            {
                var from = DateTime.UtcNow.AddDays(-days.Value);
                baseQuery = baseQuery.Where(r => r.RecordedAt >= from);
            }
            // Сначала берём до maxPoints уникальных моментов времени (каждый тик датчика = 3 строки: temp, humidity, co2).
            // Так в выборке не окажется "обрезанных" троек и CO₂ не пропадёт на графике.
            var maxPoints = Math.Min(Math.Max(limit, 1), 2000);
            var timestamps = await baseQuery
                .GroupBy(r => r.RecordedAt)
                .OrderByDescending(g => g.Key)
                .Take(maxPoints)
                .Select(g => g.Key)
                .ToListAsync();

            if (timestamps.Count == 0)
                return Ok(new List<SensorReadingDto>());

            var readings = await _context.SensorReadings
                .Where(r => r.DeviceId == deviceId && timestamps.Contains(r.RecordedAt))
                .OrderBy(r => r.RecordedAt)
                .Select(r => new SensorReadingDto
                {
                    ReadingId = r.ReadingId,
                    DeviceId = r.DeviceId,
                    ReadingType = r.ReadingType,
                    Value = r.Value,
                    Unit = r.Unit,
                    RecordedAt = r.RecordedAt ?? DateTime.UtcNow
                })
                .ToListAsync();

            return Ok(readings);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting readings: {ex.Message}");
            return StatusCode(500, "Internal Server Error");
        }
    }

    // GET: api/sensorreadings/house/5?days=7&maxPoints=500 — средние по датчикам дома для графика на дашборде
    [HttpGet("house/{houseId}")]
    public async Task<ActionResult<IEnumerable<HouseSensorSummaryPointDto>>> GetHouseReadings(int houseId, [FromQuery] int? days = null, [FromQuery] int maxPoints = 500)
    {
        try
        {
            var userId = GetUserId();
            var house = await _context.Houses.FindAsync(houseId);
            if (house == null) return NotFound("House not found");

            var hasAccess = User.IsInRole("admin") || house.OwnerId == userId ||
                await _context.HouseUsers.AnyAsync(hu => hu.HouseId == houseId && hu.UserId == userId);
            if (!hasAccess) return Forbid();

            var sensorIds = await _context.Devices
                .Where(d => d.Room.HouseId == houseId && d.Type.ToLower() == "sensor")
                .Select(d => d.DeviceId)
                .ToListAsync();
            if (sensorIds.Count == 0)
                return Ok(new List<HouseSensorSummaryPointDto>());

            var baseQuery = _context.SensorReadings.Where(r => sensorIds.Contains(r.DeviceId));
            if (days.HasValue && days.Value > 0)
            {
                var from = DateTime.UtcNow.AddDays(-days.Value);
                baseQuery = baseQuery.Where(r => r.RecordedAt >= from);
            }
            var raw = await baseQuery
                .Where(r => r.RecordedAt.HasValue)
                .Select(r => new { r.RecordedAt, r.ReadingType, r.Value })
                .ToListAsync();
            if (raw.Count == 0)
                return Ok(new List<HouseSensorSummaryPointDto>());

            var take = Math.Min(Math.Max(maxPoints, 1), 2000);
            var daysVal = (double)(days ?? 1);
            var bucketMinutes = Math.Max(2, (int)Math.Ceiling(daysVal * 24 * 60 / take));
            DateTime Bucket(DateTime? t)
            {
                if (!t.HasValue) return DateTime.UtcNow;
                var d = t.Value;
                var totalM = (long)(d - DateTime.MinValue).TotalMinutes;
                var b = (long)bucketMinutes;
                return DateTime.MinValue.AddMinutes((totalM / b) * b);
            }

            var byTime = raw
                .GroupBy(r => Bucket(r.RecordedAt))
                .Select(g =>
                {
                    var temps = g.Where(x => string.Equals(x.ReadingType, "temperature", StringComparison.OrdinalIgnoreCase)).Select(x => x.Value).ToList();
                    var hums = g.Where(x => string.Equals(x.ReadingType, "humidity", StringComparison.OrdinalIgnoreCase)).Select(x => x.Value).ToList();
                    var co2s = g.Where(x => string.Equals(x.ReadingType, "co2", StringComparison.OrdinalIgnoreCase)).Select(x => x.Value).ToList();
                    return new HouseSensorSummaryPointDto
                    {
                        RecordedAt = g.Key,
                        Temp = temps.Count > 0 ? (decimal?)Math.Round(temps.Average(x => (double)x), 1) : null,
                        Humidity = hums.Count > 0 ? (decimal?)Math.Round(hums.Average(x => (double)x), 1) : null,
                        Co2 = co2s.Count > 0 ? (decimal?)Math.Round(co2s.Average(x => (double)x), 0) : null
                    };
                })
                .OrderBy(x => x.RecordedAt)
                .ToList();

            return Ok(byTime);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting house readings: {ex.Message}");
            return StatusCode(500, "Internal Server Error");
        }
    }
}

