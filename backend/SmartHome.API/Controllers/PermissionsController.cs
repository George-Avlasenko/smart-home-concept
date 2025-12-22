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
public class PermissionsController : ControllerBase
{
    private readonly SmartHomeContext _context;

    public PermissionsController(SmartHomeContext context)
    {
        _context = context;
    }

    private int GetUserId()
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) 
        {
            Console.WriteLine("[ERROR] Token missing userId/nameid claim");
            throw new UnauthorizedAccessException("Token is invalid: missing userId claim");
        }
        return int.Parse(claim.Value);
    }

    // GET: api/permissions/device/5
    [HttpGet("device/{deviceId}")]
    public async Task<ActionResult<IEnumerable<UserDevicePermissionDto>>> GetDevicePermissions(int deviceId)
    {
        var userId = GetUserId();
        var device = await _context.Devices
            .Include(d => d.Room)
            .ThenInclude(r => r.House)
            .FirstOrDefaultAsync(d => d.DeviceId == deviceId);

        if (device == null) return NotFound();

        // Просмотр прав доступен владельцу дома или админу
        if (device.Room.House.OwnerId != userId && !User.IsInRole("admin"))
        {
            return Forbid();
        }

        return await _context.UserDevicePermissions
            .Where(p => p.DeviceId == deviceId)
            .Include(p => p.User)
            .Select(p => new UserDevicePermissionDto
            {
                PermissionId = p.PermissionId,
                UserId = p.UserId,
                Username = p.User.Username,
                DeviceId = p.DeviceId,
                PermissionLevel = p.PermissionLevel.ToString()
            })
            .ToListAsync();
    }

    // POST: api/permissions
    [HttpPost]
    public async Task<IActionResult> SetPermission(UpdatePermissionDto dto)
    {
        var userId = GetUserId();
        var device = await _context.Devices
            .Include(d => d.Room)
            .ThenInclude(r => r.House)
            .FirstOrDefaultAsync(d => d.DeviceId == dto.DeviceId);

        if (device == null) return NotFound("Устройство не найдено");

        // Только владелец дома может выдавать права
        if (device.Room.House.OwnerId != userId && !User.IsInRole("admin"))
        {
            return Forbid("Только владелец может управлять правами");
        }

        if (!Enum.TryParse<PermissionLevel>(dto.PermissionLevel, true, out var level))
        {
            return BadRequest("Некорректный уровень доступа (viewer, user, admin)");
        }

        var permission = await _context.UserDevicePermissions
            .FirstOrDefaultAsync(p => p.UserId == dto.UserId && p.DeviceId == dto.DeviceId);

        if (permission == null)
        {
            permission = new UserDevicePermission
            {
                UserId = dto.UserId,
                DeviceId = dto.DeviceId,
                PermissionLevel = level,
                GrantedBy = userId,
                GrantedAt = DateTime.UtcNow
            };
            _context.UserDevicePermissions.Add(permission);
        }
        else
        {
            permission.PermissionLevel = level;
            permission.GrantedBy = userId;
            permission.GrantedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return Ok();
    }

    // DELETE: api/permissions/5
    [HttpDelete("{permissionId}")]
    public async Task<IActionResult> RemovePermission(int permissionId)
    {
        var userId = GetUserId();
        var permission = await _context.UserDevicePermissions
            .Include(p => p.Device)
            .ThenInclude(d => d.Room)
            .ThenInclude(r => r.House)
            .FirstOrDefaultAsync(p => p.PermissionId == permissionId);

        if (permission == null) return NotFound();

        if (permission.Device.Room.House.OwnerId != userId && !User.IsInRole("admin"))
        {
            return Forbid();
        }

        _context.UserDevicePermissions.Remove(permission);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}

