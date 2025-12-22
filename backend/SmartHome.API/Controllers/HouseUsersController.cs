using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHome.API.DTOs;
using SmartHome.API.Models;
using System.Security.Claims;

namespace SmartHome.API.Controllers;

[Route("api/houses/{houseId}/users")]
[ApiController]
[Authorize]
public class HouseUsersController : ControllerBase
{
    private readonly SmartHomeContext _context;

    public HouseUsersController(SmartHomeContext context)
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

    // GET: api/houses/5/users
    [HttpGet]
    public async Task<ActionResult<IEnumerable<HouseUserDto>>> GetHouseUsers(int houseId)
    {
        var userId = GetUserId();
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

        // Проверяем доступ к дому (владелец или жилец)
        var isOwner = await _context.Houses.AnyAsync(h => h.HouseId == houseId && h.OwnerId == userId);
        var isMember = await _context.HouseUsers.AnyAsync(hu => hu.HouseId == houseId && hu.UserId == userId);

        if (!isOwner && !isMember && userRole != "admin")
        {
            return Forbid();
        }

        var users = await _context.HouseUsers
            .Where(hu => hu.HouseId == houseId)
            .Include(hu => hu.User)
            .Select(hu => new HouseUserDto
            {
                UserId = hu.UserId,
                Username = hu.User.Username,
                Email = hu.User.Email,
                Role = hu.Role,
                JoinedAt = hu.JoinedAt,
                CanInvite = hu.Role == "admin" || hu.Role == "inviter" // Owner is handled separately or joined
            })
            .ToListAsync();

        // Добавляем владельца в список
        var house = await _context.Houses.Include(h => h.Owner).FirstOrDefaultAsync(h => h.HouseId == houseId);
        if (house != null)
        {
            if (!users.Any(u => u.UserId == house.OwnerId))
            {
                users.Insert(0, new HouseUserDto
                {
                    UserId = house.Owner!.UserId,
                    Username = house.Owner.Username,
                    Email = house.Owner.Email,
                    Role = "owner",
                    JoinedAt = house.CreatedAt,
                    CanInvite = true
                });
            }
        }

        return Ok(users);
    }

    // POST: api/houses/5/users
    [HttpPost]
    public async Task<ActionResult<HouseUserDto>> AddHouseUser(int houseId, AddHouseUserDto dto)
    {
        var userId = GetUserId();
        
        var house = await _context.Houses.FindAsync(houseId);
        if (house == null) return NotFound("Дом не найден");

        // Проверка прав: Owner, Admin или Inviter
        var isOwner = house.OwnerId == userId;
        
        var currentUser = await _context.HouseUsers
            .FirstOrDefaultAsync(hu => hu.HouseId == houseId && hu.UserId == userId);
            
        var isCoOwner = currentUser?.Role == "admin";
        var isInviter = currentUser?.Role == "inviter";

        if (!isOwner && !isCoOwner && !isInviter)
        {
            return Forbid("Только владелец, совладелец или пользователь с правом приглашения могут добавлять жильцов");
        }

        var targetUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
        if (targetUser == null)
        {
            return BadRequest("Пользователь с таким Email не найден");
        }

        if (targetUser.UserId == house.OwnerId)
        {
            return BadRequest("Владелец уже живет в этом доме");
        }

        var existingLink = await _context.HouseUsers
            .FirstOrDefaultAsync(hu => hu.HouseId == houseId && hu.UserId == targetUser.UserId);

        if (existingLink != null)
        {
            return BadRequest("Пользователь уже добавлен в этот дом");
        }

        var houseUser = new HouseUser
        {
            HouseId = houseId,
            UserId = targetUser.UserId,
            Role = "member", // По умолчанию обычный жилец
            JoinedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified)
        };

        _context.HouseUsers.Add(houseUser);
        await _context.SaveChangesAsync();

        return Ok(new HouseUserDto
        {
            UserId = targetUser.UserId,
            Username = targetUser.Username,
            Email = targetUser.Email,
            Role = houseUser.Role,
            JoinedAt = houseUser.JoinedAt,
            CanInvite = houseUser.Role == "admin" || houseUser.Role == "inviter"
        });
    }

    // DELETE: api/houses/5/users/10
    [HttpDelete("{targetUserId}")]
    public async Task<IActionResult> RemoveHouseUser(int houseId, int targetUserId)
    {
        var userId = GetUserId();
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

        var house = await _context.Houses.FindAsync(houseId);
        if (house == null) return NotFound();

        // Админ может удалять кого угодно (кроме владельца, если это не сам админ)
        bool isAdmin = userRole == "admin";
        
        // Если пытаются удалить владельца (или владелец удаляет себя)
        if (targetUserId == house.OwnerId)
        {
             if (userId == house.OwnerId)
             {
                 return BadRequest("Владелец не может покинуть дом. Сначала передайте права владения другому жильцу.");
             }
             if (!isAdmin)
             {
                 return BadRequest("Нельзя удалить владельца дома.");
             }
        }

        var isOwner = house.OwnerId == userId;
        var isCoOwner = await _context.HouseUsers
            .AnyAsync(hu => hu.HouseId == houseId && hu.UserId == userId && hu.Role == "admin");

        // Админ может удалять кого угодно.
        // Владелец может удалять кого угодно. 
        // Совладелец может удалять (кроме владельца). 
        // Жилец может удалить себя (покинуть дом).
        if (!isAdmin && !isOwner && !isCoOwner && userId != targetUserId)
        {
            return Forbid();
        }

        var houseUser = await _context.HouseUsers
            .FirstOrDefaultAsync(hu => hu.HouseId == houseId && hu.UserId == targetUserId);

        if (houseUser == null) return NotFound("Жилец не найден");

        _context.HouseUsers.Remove(houseUser);
        
        // Удаляем права доступа к девайсам
        var houseDeviceIds = await _context.Devices
            .Where(d => d.Room.HouseId == houseId)
            .Select(d => d.DeviceId)
            .ToListAsync();

        var permissions = await _context.UserDevicePermissions
            .Where(p => p.UserId == targetUserId && houseDeviceIds.Contains(p.DeviceId))
            .ToListAsync();

        _context.UserDevicePermissions.RemoveRange(permissions);

        await _context.SaveChangesAsync();

        return NoContent();
    }

    // PUT: api/houses/5/users/10/role
    [HttpPut("{targetUserId}/role")]
    public async Task<IActionResult> UpdateUserRole(int houseId, int targetUserId, [FromBody] UpdateUserRoleDto dto)
    {
        var userId = GetUserId();
        var house = await _context.Houses.FindAsync(houseId);
        if (house == null) return NotFound();

        if (targetUserId == house.OwnerId) return BadRequest("Нельзя изменить роль владельца через этот метод");

        var currentUserRole = await _context.HouseUsers
             .Where(hu => hu.HouseId == houseId && hu.UserId == userId)
             .Select(hu => hu.Role)
             .FirstOrDefaultAsync();

        bool isOwner = house.OwnerId == userId;
        bool isAdmin = currentUserRole == "admin";

        if (!isOwner && !isAdmin)
        {
            return Forbid("Только владелец или совладелец может управлять ролями");
        }

        var houseUser = await _context.HouseUsers
            .FirstOrDefaultAsync(hu => hu.HouseId == houseId && hu.UserId == targetUserId);

        if (houseUser == null) return NotFound("Жилец не найден");

        // Совладелец не может менять роль другого совладельца
        if (isAdmin && houseUser.Role == "admin")
        {
             return Forbid("Совладелец не может изменять роль другого совладельца");
        }

        // Разрешенные роли: admin (совладелец), inviter (может приглашать), member (жилец), viewer
        if (dto.Role != "admin" && dto.Role != "member" && dto.Role != "viewer" && dto.Role != "inviter")
        {
             return BadRequest("Недопустимая роль");
        }

        // Совладелец не может назначить кого-то совладельцем
        if (isAdmin && dto.Role == "admin")
        {
            return Forbid("Только владелец может назначать совладельцев");
        }

        houseUser.Role = dto.Role;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Роль обновлена" });
    }

    // POST: api/houses/5/transfer/10
    // Передача прав владельца
    [HttpPost("transfer/{newOwnerId}")]
    public async Task<IActionResult> TransferOwnership(int houseId, int newOwnerId)
    {
        var userId = GetUserId();
        var house = await _context.Houses.FindAsync(houseId);
        if (house == null) return NotFound();

        if (house.OwnerId != userId)
        {
            return Forbid("Только текущий владелец может передать права владения");
        }

        if (newOwnerId == userId) return BadRequest("Вы уже владелец");

        var newOwnerUser = await _context.HouseUsers
            .FirstOrDefaultAsync(hu => hu.HouseId == houseId && hu.UserId == newOwnerId);

        if (newOwnerUser == null) return BadRequest("Новый владелец должен быть жильцом дома");

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // 1. Назначаем нового владельца дому
            house.OwnerId = newOwnerId;

            // 2. Старого владельца делаем совладельцем (admin)
            var oldOwnerLink = await _context.HouseUsers
                .FirstOrDefaultAsync(hu => hu.HouseId == houseId && hu.UserId == userId);

            if (oldOwnerLink == null)
            {
                _context.HouseUsers.Add(new HouseUser
                {
                    HouseId = houseId,
                    UserId = userId,
                    Role = "admin",
                    JoinedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified)
                });
            }
            else
            {
                oldOwnerLink.Role = "admin";
            }

            // 3. Нового владельца удаляем из HouseUsers
            _context.HouseUsers.Remove(newOwnerUser);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new { message = "Права владения переданы успешно" });
        }
        catch (Exception)
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}

public class UpdateUserRoleDto
{
    public string Role { get; set; } = string.Empty;
}
