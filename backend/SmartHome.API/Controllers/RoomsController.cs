using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHome.API.DTOs;
using SmartHome.API.Models;

namespace SmartHome.API.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class RoomsController : ControllerBase
{
    private readonly SmartHomeContext _context;

    public RoomsController(SmartHomeContext context)
    {
        _context = context;
    }

    // POST: api/rooms
    [HttpPost]
    public async Task<ActionResult<RoomDto>> CreateRoom(CreateRoomDto dto)
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) return Unauthorized();
        var userId = int.Parse(claim.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

        // Проверяем, владеет ли пользователь этим домом
        var house = await _context.Houses.FindAsync(dto.HouseId);
        if (house == null) return BadRequest("Дом не найден.");
        
        if (house.OwnerId != userId && userRole != "admin")
        {
            return Forbid("Вы не владелец этого дома.");
        }

        // Проверка уникальности имени комнаты в доме (без учета регистра)
        var existingRoom = await _context.Rooms
            .FirstOrDefaultAsync(r => r.HouseId == dto.HouseId && r.RoomName.ToLower() == dto.RoomName.ToLower());
        
        if (existingRoom != null)
        {
            return BadRequest("Комната с таким названием уже существует в этом доме.");
        }

        var room = new Room
        {
            HouseId = dto.HouseId,
            RoomName = dto.RoomName,
            Floor = dto.Floor
        };

        _context.Rooms.Add(room);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetRoom), new { id = room.RoomId }, new RoomDto
        {
            RoomId = room.RoomId,
            HouseId = room.HouseId,
            RoomName = room.RoomName,
            Floor = room.Floor
        });
    }

    // GET: api/rooms/5
    [HttpGet("{id}")]
    public async Task<ActionResult<RoomDto>> GetRoom(int id)
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) return Unauthorized();
        var userId = int.Parse(claim.Value);
        
        var room = await _context.Rooms
            .Include(r => r.House)
            .FirstOrDefaultAsync(r => r.RoomId == id);

        if (room == null) return NotFound();

        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
        // Проверка прав: админ, владелец дома или есть права на устройства в этой комнате
        if (room.House.OwnerId != userId && userRole != "admin")
        {
            // TODO: Здесь можно добавить логику проверки прав доступа к устройствам в этой комнате для членов семьи
            return Forbid();
        }

        return new RoomDto
        {
            RoomId = room.RoomId,
            HouseId = room.HouseId,
            RoomName = room.RoomName,
            Floor = room.Floor
        };
    }

    // DELETE: api/rooms/5
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRoom(int id)
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) return Unauthorized();
        var userId = int.Parse(claim.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
        var room = await _context.Rooms.Include(r => r.House).FirstOrDefaultAsync(r => r.RoomId == id);
        
        if (room == null) return NotFound();

        if (room.House.OwnerId != userId && userRole != "admin")
        {
            return Forbid();
        }

        _context.Rooms.Remove(room);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateRoom(int id, [FromBody] CreateRoomDto dto)
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) return Unauthorized();
        var userId = int.Parse(claim.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
        var room = await _context.Rooms.Include(r => r.House).FirstOrDefaultAsync(r => r.RoomId == id);
        
        if (room == null) return NotFound();
        if (room.House.OwnerId != userId && userRole != "admin") return Forbid();

        // Проверка на дубликат (если имя изменилось)
        if (room.RoomName != dto.RoomName)
        {
            var existingRoom = await _context.Rooms
                .FirstOrDefaultAsync(r => r.HouseId == room.HouseId && r.RoomName.ToLower() == dto.RoomName.ToLower());
            
            if (existingRoom != null)
            {
                return BadRequest("Комната с таким названием уже существует в этом доме.");
            }
        }

        room.RoomName = dto.RoomName;
        // room.Floor = dto.Floor; // Можно и этаж обновить если надо
        
        await _context.SaveChangesAsync();

        return Ok(new RoomDto
        {
            RoomId = room.RoomId,
            HouseId = room.HouseId,
            RoomName = room.RoomName,
            Floor = room.Floor
        });
    }
}
