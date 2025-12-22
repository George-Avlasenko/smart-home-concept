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

    // GET: api/sensorreadings/device/5
    [HttpGet("device/{deviceId}")]
    public async Task<ActionResult<IEnumerable<SensorReadingDto>>> GetDeviceReadings(int deviceId, [FromQuery] int limit = 50)
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
                     // Also allow if user is a resident of the house with admin role?
                     // For now simplify: Owner or Permission.
                     // Or if user is HouseUser? Usually house members can see devices.
                     var houseUser = await _context.HouseUsers
                        .FirstOrDefaultAsync(hu => hu.HouseId == device.Room.HouseId && hu.UserId == userId);
                     if (houseUser != null) hasAccess = true;
                 }
            }

            if (!hasAccess) return Forbid();

            var readings = await _context.SensorReadings
                .Where(r => r.DeviceId == deviceId)
                .OrderByDescending(r => r.RecordedAt)
                .Take(limit)
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
}

