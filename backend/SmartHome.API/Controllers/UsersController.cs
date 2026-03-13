using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHome.API.Models;
using SmartHome.API.Services;

namespace SmartHome.API.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly SmartHomeContext _context;
    private readonly EventPublisher _eventPublisher;

    public UsersController(SmartHomeContext context, EventPublisher eventPublisher)
    {
        _context = context;
        _eventPublisher = eventPublisher;
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

    // GET: api/users
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetUsers()
    {
        var userId = GetUserId();
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

        // Только админ может видеть всех пользователей
        if (userRole != "admin")
        {
            return Forbid("Только администратор может просматривать список пользователей");
        }

        var activeUserIds = _eventPublisher.GetActiveUserIds();

        var users = await _context.Users
            .Select(u => new
            {
                UserId = u.UserId,
                Username = u.Username,
                Email = u.Email,
                Role = u.Role,
                FullName = u.FullName,
                IsBlocked = u.IsBlocked ?? false,
                CreatedAt = u.CreatedAt
            })
            .ToListAsync();

        var result = users.Select(u => new
        {
            u.UserId,
            u.Username,
            u.Email,
            u.Role,
            u.FullName,
            u.IsBlocked,
            u.CreatedAt,
            IsActive = activeUserIds.Contains(u.UserId)
        }).ToList();

        return Ok(result);
    }

    // DELETE: api/users/5
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var userId = GetUserId();
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

        // Только админ может удалять пользователей
        if (userRole != "admin")
        {
            return Forbid("Только администратор может удалять пользователей");
        }

        // Нельзя удалить самого себя
        if (id == userId)
        {
            return BadRequest("Нельзя удалить самого себя");
        }

        var user = await _context.Users.FindAsync(id);
        if (user == null)
        {
            return NotFound("Пользователь не найден");
        }

        // Нельзя удалить другого админа
        if (user.Role == "admin")
        {
            return BadRequest("Нельзя удалить другого администратора");
        }

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // PUT: api/users/5/block
    [HttpPut("{id}/block")]
    public async Task<IActionResult> BlockUser(int id, [FromBody] bool block)
    {
        var userId = GetUserId();
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

        // Только админ может блокировать пользователей
        if (userRole != "admin")
        {
            return Forbid("Только администратор может блокировать пользователей");
        }

        // Нельзя заблокировать самого себя
        if (id == userId)
        {
            return BadRequest("Нельзя заблокировать самого себя");
        }

        var user = await _context.Users.FindAsync(id);
        if (user == null)
        {
            return NotFound("Пользователь не найден");
        }

        user.IsBlocked = block;
        await _context.SaveChangesAsync();

        return Ok(new { message = block ? "Пользователь заблокирован" : "Пользователь разблокирован" });
    }
}




