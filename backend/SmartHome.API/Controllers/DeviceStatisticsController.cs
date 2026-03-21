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
public class DeviceStatisticsController : ControllerBase
{
    private readonly SmartHomeContext _context;

    public DeviceStatisticsController(SmartHomeContext context)
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

    // GET: api/devicestatistics/device/5
    [HttpGet("device/{deviceId}")]
    public async Task<ActionResult<DeviceStatisticsDto>> GetDeviceStatistics(int deviceId, [FromQuery] int days = 7)
    {
        try
        {
            var userId = GetUserId();
            
            var device = await _context.Devices
                .Include(d => d.Room)
                .ThenInclude(r => r.House)
                .FirstOrDefaultAsync(d => d.DeviceId == deviceId);

            if (device == null) return NotFound("Device not found");

            // Проверка доступа: только владелец или совладелец (admin дома)
            var isOwner = device.Room.House.OwnerId == userId;
            var isCoOwner = await _context.HouseUsers
                .AnyAsync(hu => hu.HouseId == device.Room.HouseId && 
                                hu.UserId == userId && 
                                hu.Role == "admin");

            if (!isOwner && !isCoOwner)
            {
                return StatusCode(403, "Доступ к статистике имеют только владелец и совладелец дома");
            }

            var fromDate = DateTime.UtcNow.AddDays(-days);
            
            // Используем дату создания устройства как минимальную точку отсчета
            var minDate = device.CreatedAt ?? fromDate;
            if (minDate < fromDate) minDate = fromDate;
            
            var events = await _context.DeviceStatusHistories
                .Where(h => h.DeviceId == deviceId && h.Timestamp >= fromDate)
                .OrderByDescending(h => h.Timestamp)
                .Include(h => h.ChangedByUser)
                .ToListAsync();

            var statistics = new DeviceStatisticsDto
            {
                DeviceId = device.DeviceId,
                DeviceName = device.Name,
                Events = new List<StatusEventDto>(),
                TotalSwitches = events.Count
            };

            TimeSpan totalActive = TimeSpan.Zero;
            TimeSpan totalInactive = TimeSpan.Zero;
            DateTime? lastOn = null;
            DateTime? lastOff = null;
            bool isCurrentlyActive = device.Status == DeviceStatus.active;

            // Обрабатываем события от новых к старым
            for (int i = 0; i < events.Count; i++)
            {
                var evt = events[i];
                var eventDto = new StatusEventDto
                {
                    HistoryId = evt.HistoryId,
                    Status = evt.Status.ToString(),
                    Timestamp = evt.Timestamp,
                    ChangedByUsername = evt.ChangedByUser?.Username,
                    ChangeReason = evt.ChangeReason
                };

                // Вычисляем длительность сессии
                if (i == 0)
                {
                    // Самое новое событие
                    if (isCurrentlyActive && evt.Status == DeviceStatus.active)
                    {
                        // Устройство сейчас активно - длительность до текущего момента
                        var duration = DateTime.UtcNow - evt.Timestamp;
                        eventDto.DurationSeconds = (long)duration.TotalSeconds;
                        totalActive = totalActive.Add(duration);
                    }
                    else if (i < events.Count - 1)
                    {
                        // Есть более старое событие - длительность до него
                        var nextEvent = events[i + 1];
                        var duration = evt.Timestamp - nextEvent.Timestamp;
                        eventDto.DurationSeconds = (long)duration.TotalSeconds;
                        
                        if (evt.Status == DeviceStatus.active)
                            totalActive = totalActive.Add(duration);
                        else
                            totalInactive = totalInactive.Add(duration);
                    }
                    else
                    {
                        // Единственное событие - длительность до создания устройства или начала периода
                        var duration = evt.Timestamp - minDate;
                        if (duration.TotalSeconds > 0)
                        {
                            eventDto.DurationSeconds = (long)duration.TotalSeconds;
                            if (evt.Status == DeviceStatus.active)
                                totalActive = totalActive.Add(duration);
                            else
                                totalInactive = totalInactive.Add(duration);
                        }
                    }
                }
                else if (i < events.Count - 1)
                {
                    // Средние события - длительность до следующего (более старого)
                    var nextEvent = events[i + 1];
                    var duration = evt.Timestamp - nextEvent.Timestamp;
                    eventDto.DurationSeconds = (long)duration.TotalSeconds;
                    
                    if (evt.Status == DeviceStatus.active)
                        totalActive = totalActive.Add(duration);
                    else
                        totalInactive = totalInactive.Add(duration);
                }
                else
                {
                    // Самое старое событие - длительность до создания устройства или начала периода
                    var duration = evt.Timestamp - minDate;
                    if (duration.TotalSeconds > 0)
                    {
                        eventDto.DurationSeconds = (long)duration.TotalSeconds;
                        if (evt.Status == DeviceStatus.active)
                            totalActive = totalActive.Add(duration);
                        else
                            totalInactive = totalInactive.Add(duration);
                    }
                }

                statistics.Events.Add(eventDto);

                // Отслеживаем последние включение/выключение
                if (evt.Status == DeviceStatus.active && lastOn == null)
                    lastOn = evt.Timestamp;
                if (evt.Status == DeviceStatus.inactive && lastOff == null)
                    lastOff = evt.Timestamp;
            }

            // Текущая сессия отдельно (если устройство активно)
            if (isCurrentlyActive && events.Count > 0 && events[0].Status == DeviceStatus.active)
            {
                var currentSession = DateTime.UtcNow - events[0].Timestamp;
                statistics.CurrentSessionDurationSeconds = (long)currentSession.TotalSeconds;
            }

            statistics.TotalActiveTimeSeconds = (long)totalActive.TotalSeconds;
            statistics.TotalInactiveTimeSeconds = (long)totalInactive.TotalSeconds;
            statistics.LastTurnedOn = lastOn;
            statistics.LastTurnedOff = lastOff;

            return Ok(statistics);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting statistics: {ex.Message}");
            return StatusCode(500, "Internal Server Error");
        }
    }
}

