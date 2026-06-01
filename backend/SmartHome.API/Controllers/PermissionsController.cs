using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHome.API.DTOs;
using SmartHome.API.Models;
using SmartHome.API.Services;
using System.Security.Claims;

namespace SmartHome.API.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class PermissionsController : ControllerBase
{
    private readonly SmartHomeContext _context;
    private readonly EventPublisher _eventPublisher;

    public PermissionsController(SmartHomeContext context, EventPublisher eventPublisher)
    {
        _context = context;
        _eventPublisher = eventPublisher;
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

    /// <summary>Владелец дома или совладелец (house_users.role = admin).</summary>
    private async Task<bool> CanManageHousePermissionsAsync(int houseId, int userId)
    {
        if (await _context.Houses.AnyAsync(h => h.HouseId == houseId && h.OwnerId == userId))
            return true;
        return await _context.HouseUsers.AnyAsync(hu =>
            hu.HouseId == houseId && hu.UserId == userId && hu.Role == "admin");
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

        if (!await CanManageHousePermissionsAsync(device.Room.HouseId, userId))
            return Forbid("Только владелец или совладелец может просматривать права");

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

        // Только владелец дома может выдавать права (глобальный админ не может в чужих домах)
        if (device.Room.House.OwnerId != userId)
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

        // Публикуем событие изменения прав доступа
        await _eventPublisher.PublishAsync("permission.updated", new
        {
            deviceId = dto.DeviceId,
            userId = dto.UserId,
            permissionLevel = level.ToString()
        });

        return Ok();
    }

    // DELETE: api/permissions/user/5/device/10 — забрать доступ (нет)
    [HttpDelete("user/{targetUserId}/device/{deviceId}")]
    public async Task<IActionResult> RemovePermissionByUserAndDevice(int targetUserId, int deviceId)
    {
        var userId = GetUserId();
        var device = await _context.Devices
            .Include(d => d.Room)
            .ThenInclude(r => r.House)
            .FirstOrDefaultAsync(d => d.DeviceId == deviceId);
        if (device == null) return NotFound();
        if (!await CanManageHousePermissionsAsync(device.Room.HouseId, userId))
            return Forbid("Только владелец или совладелец может управлять правами");

        var permission = await _context.UserDevicePermissions
            .FirstOrDefaultAsync(p => p.UserId == targetUserId && p.DeviceId == deviceId);
        if (permission == null) return NoContent();

        _context.UserDevicePermissions.Remove(permission);
        await _context.SaveChangesAsync();
        await _eventPublisher.PublishAsync("permission.deleted", new { deviceId, userId = targetUserId });
        return NoContent();
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

        if (!await CanManageHousePermissionsAsync(permission.Device.Room.HouseId, userId))
            return Forbid("Только владелец или совладелец может управлять правами");

        var deviceId = permission.DeviceId;
        var targetUserId = permission.UserId;
        _context.UserDevicePermissions.Remove(permission);
        await _context.SaveChangesAsync();

        // Публикуем событие удаления прав доступа
        await _eventPublisher.PublishAsync("permission.deleted", new
        {
            deviceId = deviceId,
            userId = targetUserId
        });

        return NoContent();
    }
}

