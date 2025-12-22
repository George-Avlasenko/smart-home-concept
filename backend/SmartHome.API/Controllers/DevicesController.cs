using System.Net;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHome.API.DTOs;
using SmartHome.API.Models;

namespace SmartHome.API.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize] // Требует токен для всех методов
public class DevicesController : ControllerBase
{
    private readonly SmartHomeContext _context;

    public DevicesController(SmartHomeContext context)
    {
        _context = context;
    }

    // GET: api/devices
    [HttpGet]
    public async Task<ActionResult<IEnumerable<DeviceDto>>> GetDevices()
    {
        try
        {
            var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
            if (claim == null) return Unauthorized("Missing userId claim");
            var userId = int.Parse(claim.Value);
            
            var roleClaim = User.FindFirst(ClaimTypes.Role);
            var userRole = roleClaim?.Value ?? "user";

            IQueryable<Device> query = _context.Devices
            .Include(d => d.Room)
            .ThenInclude(r => r.House); // Подгружаем Дом для группировки

        // Если не админ, фильтруем по правам доступа
        if (userRole != "admin")
        {
            // Получаем список домов, где пользователь владелец ИЛИ совладелец (admin)
            var ownedHouseIds = await _context.Houses
               .Where(h => h.OwnerId == userId)
               .Select(h => h.HouseId)
               .ToListAsync();

            var coOwnedHouseIds = await _context.HouseUsers
               .Where(hu => hu.UserId == userId && hu.Role == "admin")
               .Select(hu => hu.HouseId)
               .ToListAsync();
            
            var fullAccessHouseIds = ownedHouseIds.Concat(coOwnedHouseIds).Distinct().ToList();

            query = query.Where(d => 
                d.UserDevicePermissions.Any(p => p.UserId == userId) ||
                fullAccessHouseIds.Contains(d.Room.HouseId)
            );
        }

        var devices = await query
            .Include(d => d.UserDevicePermissions) // Нужно подгрузить разрешения
            .ToListAsync();

        // Кэшируем список домов, где пользователь совладелец, чтобы не делать запросы в цикле
        var userCoOwnedHouses = await _context.HouseUsers
            .Where(hu => hu.UserId == userId && hu.Role == "admin")
            .Select(hu => hu.HouseId)
            .ToListAsync();

        var dtos = devices.Select(d => {
            Dictionary<string, object> settings = new();
            try 
            {
                if (!string.IsNullOrEmpty(d.MetaData))
                {
                    settings = JsonSerializer.Deserialize<Dictionary<string, object>>(d.MetaData) ?? new();
                }
            }
            catch { /* Игнорируем ошибки парсинга JSON */ }

            // Определяем права текущего пользователя
            string permission = "viewer";
            
            // Проверка на полного админа (владелец или совладелец дома)
            bool isFullAdmin = userRole == "admin" || 
                               d.Room.House.OwnerId == userId || 
                               userCoOwnedHouses.Contains(d.Room.HouseId);

            if (isFullAdmin)
            {
                permission = "admin"; // Владелец/Совладелец = Админ устройства
            }
            else
            {
                // Ищем явное разрешение для этого пользователя
                var userPerm = d.UserDevicePermissions.FirstOrDefault(p => p.UserId == userId);
                if (userPerm != null)
                {
                    permission = userPerm.PermissionLevel.ToString().ToLower();
                }
            }

            return new DeviceDto
        {
            DeviceId = d.DeviceId,
            RoomId = d.RoomId,
            RoomName = d.Room.RoomName,
                HouseId = d.Room.HouseId,
                HouseAddress = d.Room.House.Address,
            Name = d.Name,
            Manufacturer = d.Manufacturer,
                SerialNumber = d.SerialNumber,
            Type = d.Type,
            Ip = d.Ip != null ? d.Ip.ToString() : null,
                Status = d.Status.ToString(),
                Settings = settings,
                CurrentUserPermission = permission
            };
        }).ToList();

        return Ok(dtos);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] GetDevices failed: {ex}");
            return StatusCode(500, $"Error getting devices: {ex.Message}");
        }
    }

    // PUT: api/devices/5/settings
    [HttpPut("{id}/settings")]
    public async Task<IActionResult> UpdateDeviceSettings(int id, [FromBody] UpdateDeviceSettingsDto dto)
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) return Unauthorized();
        var userId = int.Parse(claim.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "user";

        var device = await _context.Devices
            .Include(d => d.Room)
            .ThenInclude(r => r.House)
            .Include(d => d.UserDevicePermissions)
            .FirstOrDefaultAsync(d => d.DeviceId == id);

        if (device == null) return NotFound();

        // Проверка прав (нужен user или admin)
        if (userRole != "admin")
        {
            // Проверка владельца дома или совладельца
            bool isOwnerOrCoOwner = device.Room.House.OwnerId == userId || 
                                    await _context.HouseUsers.AnyAsync(hu => hu.HouseId == device.Room.HouseId && hu.UserId == userId && hu.Role == "admin");

            if (!isOwnerOrCoOwner)
            {
                var permission = device.UserDevicePermissions.FirstOrDefault(p => p.UserId == userId);
                if (permission == null || permission.PermissionLevel == PermissionLevel.viewer)
                {
                    return Forbid("Нет прав на изменение настроек.");
                }
            }
        }

        // Обновляем MetaData
        Dictionary<string, object> currentSettings = new();
        if (!string.IsNullOrEmpty(device.MetaData))
        {
            try {
                currentSettings = JsonSerializer.Deserialize<Dictionary<string, object>>(device.MetaData) ?? new();
            } catch {}
        }

        foreach (var kvp in dto.Settings)
        {
            currentSettings[kvp.Key] = kvp.Value;
        }

        device.MetaData = JsonSerializer.Serialize(currentSettings);
        await _context.SaveChangesAsync();

        return Ok(currentSettings);
    }

    // GET: api/devices/5
    [HttpGet("{id}")]
    public async Task<ActionResult<DeviceDto>> GetDevice(int id)
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) return Unauthorized();
        var userId = int.Parse(claim.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "user";

        var device = await _context.Devices
            .Include(d => d.Room)
            .ThenInclude(r => r.House)
            .Include(d => d.UserDevicePermissions)
            .FirstOrDefaultAsync(d => d.DeviceId == id);

        if (device == null)
        {
            return NotFound();
        }

        // Проверка прав доступа
        if (userRole != "admin")
        {
             bool isOwnerOrCoOwner = device.Room.House.OwnerId == userId || 
                                     await _context.HouseUsers.AnyAsync(hu => hu.HouseId == device.Room.HouseId && hu.UserId == userId && hu.Role == "admin");
             
             if (!isOwnerOrCoOwner && !device.UserDevicePermissions.Any(p => p.UserId == userId))
        {
                 return Forbid();
             }
        }

        return new DeviceDto
        {
            DeviceId = device.DeviceId,
            RoomId = device.RoomId,
            RoomName = device.Room.RoomName,
            Name = device.Name,
            Manufacturer = device.Manufacturer,
            SerialNumber = device.SerialNumber,
            Type = device.Type,
            Ip = device.Ip != null ? device.Ip.ToString() : null,
            Status = device.Status.ToString()
        };
    }

    // POST: api/devices
    [HttpPost]
    public async Task<ActionResult<Device>> CreateDevice(CreateDeviceDto dto)
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) return Unauthorized();
        var userId = int.Parse(claim.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "user";

        // Проверка существования комнаты с подгрузкой дома
        var room = await _context.Rooms
            .Include(r => r.House)
            .FirstOrDefaultAsync(r => r.RoomId == dto.RoomId);

        if (room == null)
        {
            return BadRequest("Указанная комната не существует.");
        }

        // Проверка прав: Админ, Владелец дома или Совладелец
        bool isCoOwner = await _context.HouseUsers.AnyAsync(hu => hu.HouseId == room.HouseId && hu.UserId == userId && hu.Role == "admin");
        
        if (userRole != "admin" && room.House.OwnerId != userId && !isCoOwner)
        {
            return Problem(
                statusCode: 400,
                title: "Ошибка доступа",
                detail: "Вы не являетесь владельцем или совладельцем этого дома."
            );
        }

        // Проверка на дубликаты по IP и серийному номеру
        if (!string.IsNullOrWhiteSpace(dto.Ip))
        {
            try 
            {
                var ipAddr = IPAddress.Parse(dto.Ip);
                var existing = await _context.Devices.FirstOrDefaultAsync(d => d.Ip == ipAddr);
                if (existing != null)
                {
                     return BadRequest($"Устройство с IP {dto.Ip} уже существует.");
                }
            }
            catch (FormatException)
            {
                return BadRequest($"Неверный формат IP адреса: {dto.Ip}. Ожидается формат xxx.xxx.xxx.xxx (например: 192.168.1.1)");
            }
        }

        if (!string.IsNullOrWhiteSpace(dto.SerialNumber))
        {
            var existingSerial = await _context.Devices.AnyAsync(d => d.SerialNumber == dto.SerialNumber);
            if (existingSerial)
            {
                return BadRequest($"Устройство с серийным номером {dto.SerialNumber} уже существует.");
            }
        }

        try
        {
        var device = new Device
        {
            RoomId = dto.RoomId,
            Name = dto.Name,
            Manufacturer = dto.Manufacturer,
            SerialNumber = dto.SerialNumber,
            Type = dto.Type,
            Status = DeviceStatus.inactive,
                Ip = !string.IsNullOrWhiteSpace(dto.Ip) ? IPAddress.Parse(dto.Ip) : null, // IP уже проверен выше
                CreatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified)
        };

        _context.Devices.Add(device);
        await _context.SaveChangesAsync();

            // Права владельцу уже не обязательны через таблицу, так как мы проверяем OwnerId,
            // но можно добавить для порядка или удалить этот блок, если мы полностью перешли на логику "Владелец видит все".
            // Лучше не добавлять лишних записей, если логика работает через House.OwnerId
            // Но добавим, чтобы старый код (если где-то остался) работал.
            
            var permission = new UserDevicePermission
            {
                UserId = userId,
                DeviceId = device.DeviceId,
                PermissionLevel = PermissionLevel.admin,
                GrantedBy = userId
            };
            _context.UserDevicePermissions.Add(permission);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetDevice), new { id = device.DeviceId }, new DeviceDto
            {
                DeviceId = device.DeviceId,
                RoomId = device.RoomId,
                RoomName = room.RoomName,
                Name = device.Name,
                Manufacturer = device.Manufacturer,
                Type = device.Type,
                Ip = device.Ip?.ToString(),
                Status = device.Status.ToString()
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Ошибка при создании устройства", error = ex.Message });
        }
    }

    // PUT: api/devices/5/status
    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateDeviceStatus(int id, UpdateDeviceStatusDto dto)
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) return Unauthorized();
        var userId = int.Parse(claim.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "user";

        var device = await _context.Devices
            .Include(d => d.Room)
            .ThenInclude(r => r.House) // Обязательно подгружаем дом!
            .Include(d => d.UserDevicePermissions)
            .FirstOrDefaultAsync(d => d.DeviceId == id);

        if (device == null)
        {
            return NotFound();
        }

        if (userRole != "admin")
        {
            bool isOwnerOrCoOwner = device.Room.House.OwnerId == userId || 
                                    await _context.HouseUsers.AnyAsync(hu => hu.HouseId == device.Room.HouseId && hu.UserId == userId && hu.Role == "admin");

            if (!isOwnerOrCoOwner)
        {
            var permission = device.UserDevicePermissions.FirstOrDefault(p => p.UserId == userId);
            
            if (permission == null)
            {
                return Forbid("Нет доступа к устройству.");
            }

            if (permission.PermissionLevel == PermissionLevel.viewer)
            {
                return Forbid("У вас только права на просмотр.");
            }
        }
        }

        if (Enum.TryParse<DeviceStatus>(dto.Status, true, out var newStatus))
        {
            device.Status = newStatus;
            
            // Записываем событие изменения статуса
            var history = new DeviceStatusHistory
            {
                DeviceId = device.DeviceId,
                Status = newStatus,
                Timestamp = DateTime.UtcNow,
                ChangedByUserId = userId,
                ChangeReason = "manual"
            };
            _context.DeviceStatusHistories.Add(history);
        await _context.SaveChangesAsync();
        }
        else
        {
            return BadRequest($"Неверный статус устройства: {dto.Status}");
        }

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteDevice(int id)
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) return Unauthorized();
        var userId = int.Parse(claim.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "user";

        var device = await _context.Devices
            .Include(d => d.Room)
            .ThenInclude(r => r.House)
            .FirstOrDefaultAsync(d => d.DeviceId == id);

        if (device == null)
        {
            return NotFound();
        }

        // Админ, Владелец или Совладелец
        bool isCoOwner = await _context.HouseUsers.AnyAsync(hu => hu.HouseId == device.Room.HouseId && hu.UserId == userId && hu.Role == "admin");

        if (userRole != "admin" && device.Room.House.OwnerId != userId && !isCoOwner)
        {
            return StatusCode(403, "Только владелец или совладелец может удалять устройства.");
        }

        _context.Devices.Remove(device);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateDevice(int id, [FromBody] UpdateDeviceDto dto)
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) return Unauthorized();
        var userId = int.Parse(claim.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "user";

        var device = await _context.Devices
            .Include(d => d.Room)
            .ThenInclude(r => r.House)
            .FirstOrDefaultAsync(d => d.DeviceId == id);

        if (device == null) return NotFound();

        // Админ, Владелец или Совладелец
        bool isCoOwner = await _context.HouseUsers.AnyAsync(hu => hu.HouseId == device.Room.HouseId && hu.UserId == userId && hu.Role == "admin");

        if (userRole != "admin" && device.Room.House.OwnerId != userId && !isCoOwner)
        {
            return StatusCode(403, "Только владелец или совладелец может изменять устройства.");
        }

        // Проверка дубликатов и валидация IP
        if (dto.Ip != null && dto.Ip != device.Ip?.ToString())
        {
             if (!string.IsNullOrWhiteSpace(dto.Ip))
             {
                 try {
                    var ipAddr = IPAddress.Parse(dto.Ip);
                    if (await _context.Devices.AnyAsync(d => d.Ip == ipAddr && d.DeviceId != id))
                        return BadRequest($"Устройство с IP {dto.Ip} уже существует.");
                 } catch (FormatException) {
                    return BadRequest($"Неверный формат IP адреса: {dto.Ip}. Ожидается формат xxx.xxx.xxx.xxx (например: 192.168.1.1)");
                 }
             }
        }
        if (dto.SerialNumber != null && dto.SerialNumber != device.SerialNumber)
        {
            if (await _context.Devices.AnyAsync(d => d.SerialNumber == dto.SerialNumber && d.DeviceId != id))
                return BadRequest($"Устройство с серийным номером {dto.SerialNumber} уже существует.");
        }

        // Обновляем поля
        if (dto.Name != null) device.Name = dto.Name;
        if (dto.Type != null) device.Type = dto.Type;
        if (dto.Manufacturer != null) device.Manufacturer = dto.Manufacturer;
        if (dto.SerialNumber != null) device.SerialNumber = dto.SerialNumber;
        if (dto.Ip != null) {
             if (string.IsNullOrWhiteSpace(dto.Ip))
             {
                 device.Ip = null;
             }
             else
             {
                 try 
                 { 
                     device.Ip = IPAddress.Parse(dto.Ip);
                 } 
                 catch (FormatException)
                 {
                     return BadRequest($"Неверный формат IP адреса: {dto.Ip}. Ожидается формат xxx.xxx.xxx.xxx (например: 192.168.1.1)");
                 }
             }
        }

        await _context.SaveChangesAsync();
        return Ok(new DeviceDto
        {
            DeviceId = device.DeviceId,
            Name = device.Name,
            Type = device.Type,
            // ...
        });
    }
}
