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
public class HousesController : ControllerBase
{
    private readonly SmartHomeContext _context;

    public HousesController(SmartHomeContext context)
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

    [HttpGet]
    public async Task<ActionResult<IEnumerable<HouseDto>>> GetHouses()
    {
        try
        {
            var userId = GetUserId();
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

            // Если админ - возвращаем все дома
            if (userRole == "admin")
            {
                var allHouses = await _context.Houses
                .Select(h => new HouseDto
                {
                    HouseId = h.HouseId,
                    Address = h.Address,
                        CreatedAt = h.CreatedAt,
                        OwnerId = h.OwnerId,
                        CurrentUserRole = "admin" // Админ видит все дома с правами админа
                    })
                    .ToListAsync();
                return Ok(allHouses);
            }

            // Получаем дома, где пользователь владелец
            var ownedHouses = await _context.Houses
                .Where(h => h.OwnerId == userId)
                .Select(h => new { House = h, Role = "owner" })
                .ToListAsync();

            // Получаем дома, где пользователь участник (и их роль)
            var memberHouses = await _context.HouseUsers
                .Where(hu => hu.UserId == userId)
                .Include(hu => hu.House)
                .Select(hu => new { House = hu.House, Role = hu.Role })
                .ToListAsync();

            // Объединяем (используем GroupBy чтобы убрать дубликаты, если вдруг владелец есть и в HouseUsers)
            var all = ownedHouses.Concat(memberHouses)
                .GroupBy(x => x.House.HouseId)
                .Select(g => g.First()) 
                .ToList();

            var dtos = all.Select(x => new HouseDto
            {
                HouseId = x.House.HouseId,
                Address = x.House.Address,
                CreatedAt = x.House.CreatedAt,
                OwnerId = x.House.OwnerId,
                CurrentUserRole = x.Role
            }).ToList();

            return Ok(dtos);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] GetHouses failed: {ex}");
            return StatusCode(500, $"Error getting houses: {ex.Message}");
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<HouseDto>> GetHouse(int id)
    {
        try
        {
            var userId = GetUserId();
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
            var house = await _context.Houses.FindAsync(id);

            if (house == null) return NotFound();
            if (house.OwnerId != userId && userRole != "admin") return Forbid();

            // Проверка уникальности адреса дома для одного владельца (если нужно)
            // Но в общем случае разные дома могут быть по одному адресу (квартиры), 
            // поэтому уникальность лучше проверять по сочетанию (owner_id, address).
            // Здесь, в методе CreateHouse, мы это добавим.

            return new HouseDto
            {
                HouseId = house.HouseId,
                Address = house.Address,
                CreatedAt = house.CreatedAt,
                OwnerId = house.OwnerId
            };
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error getting house: {ex.Message}");
        }
    }

    [HttpGet("{id}/rooms")]
    public async Task<ActionResult<IEnumerable<RoomDto>>> GetHouseRooms(int id)
    {
        try
        {
            var userId = GetUserId();
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
            var house = await _context.Houses.FindAsync(id);

            if (house == null) return NotFound();

            // Проверка прав: админ, владелец или жилец
            if (userRole != "admin")
            {
                var isMember = await _context.HouseUsers.AnyAsync(hu => hu.HouseId == id && hu.UserId == userId);
                if (house.OwnerId != userId && !isMember) return Forbid();
            }

            return await _context.Rooms
                .Where(r => r.HouseId == id)
                .Select(r => new RoomDto
                {
                    RoomId = r.RoomId,
                    HouseId = r.HouseId,
                    RoomName = r.RoomName,
                    Floor = r.Floor
                })
                .ToListAsync();
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error getting rooms: {ex.Message}");
        }
    }

    [HttpPost]
    public async Task<ActionResult<HouseDto>> CreateHouse(CreateHouseDto dto)
    {
        try
        {
            var userId = GetUserId();

            // Проверка на дубликат дома по адресу для этого пользователя (без учета регистра)
            var existingHouse = await _context.Houses
                .FirstOrDefaultAsync(h => h.OwnerId == userId && h.Address.ToLower() == dto.Address.ToLower());

            if (existingHouse != null)
            {
                return BadRequest($"У вас уже есть дом с адресом '{dto.Address}'");
            }

            var house = new House
            {
                Address = dto.Address,
                OwnerId = userId,
                CreatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified)
            };

            _context.Houses.Add(house);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetHouse), new { id = house.HouseId }, new HouseDto
            {
                HouseId = house.HouseId,
                Address = house.Address,
                CreatedAt = house.CreatedAt,
                OwnerId = house.OwnerId
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error creating house: {ex.Message} \nInner: {ex.InnerException?.Message}");
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteHouse(int id)
    {
        try
        {
            var userId = GetUserId();
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
            var house = await _context.Houses.FindAsync(id);
            
            if (house == null) return NotFound();
            if (house.OwnerId != userId && userRole != "admin") return Forbid();

            _context.Houses.Remove(house);
            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error deleting house: {ex.Message}");
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateHouse(int id, [FromBody] CreateHouseDto dto)
    {
        try
        {
            var userId = GetUserId();
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
            var house = await _context.Houses.FindAsync(id);

            if (house == null) return NotFound();
            if (house.OwnerId != userId && userRole != "admin") return Forbid();

            // Проверка на дубликат (если адрес изменился)
            if (house.Address != dto.Address)
            {
                var existingHouse = await _context.Houses
                    .FirstOrDefaultAsync(h => h.OwnerId == userId && h.Address.ToLower() == dto.Address.ToLower());
                
                if (existingHouse != null)
                {
                    return BadRequest($"У вас уже есть дом с адресом '{dto.Address}'");
                }
            }

            house.Address = dto.Address;
            await _context.SaveChangesAsync();

            return Ok(new HouseDto
            {
                HouseId = house.HouseId,
                Address = house.Address,
                CreatedAt = house.CreatedAt,
                OwnerId = house.OwnerId
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error updating house: {ex.Message}");
        }
    }
}
