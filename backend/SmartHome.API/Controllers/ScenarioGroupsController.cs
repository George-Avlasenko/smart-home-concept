using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHome.API.DTOs;
using SmartHome.API.Models;
using SmartHome.API.Services;

namespace SmartHome.API.Controllers;

[Route("api/houses/{houseId:int}/scenario-groups")]
[ApiController]
[Authorize]
public class ScenarioGroupsController : ControllerBase
{
    private readonly SmartHomeContext _context;
    private readonly EventPublisher _eventPublisher;
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public ScenarioGroupsController(SmartHomeContext context, EventPublisher eventPublisher)
    {
        _context = context;
        _eventPublisher = eventPublisher;
    }

    private int GetUserId()
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null)
            throw new UnauthorizedAccessException("Token is invalid: missing userId claim");
        return int.Parse(claim.Value);
    }

    /// <summary>Владелец дома, совладелец (роль admin в house_users) или системный admin.</summary>
    private async Task<bool> CanManageScenarioGroupsAsync(int userId, int houseId, CancellationToken ct)
    {
        var globalRole = User.FindFirst(ClaimTypes.Role)?.Value;
        if (globalRole == "admin")
            return await _context.Houses.AnyAsync(h => h.HouseId == houseId, ct);

        var house = await _context.Houses.AsNoTracking().FirstOrDefaultAsync(h => h.HouseId == houseId, ct);
        if (house == null) return false;
        if (house.OwnerId == userId) return true;
        return await _context.HouseUsers.AnyAsync(
            hu => hu.HouseId == houseId && hu.UserId == userId && hu.Role == "admin",
            ct);
    }

    private static List<ScenarioGroupCommandDto> ParseCommandsJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new List<ScenarioGroupCommandDto>();
        try
        {
            return JsonSerializer.Deserialize<List<ScenarioGroupCommandDto>>(json, JsonOpts) ?? new List<ScenarioGroupCommandDto>();
        }
        catch
        {
            return new List<ScenarioGroupCommandDto>();
        }
    }

    private static string SerializeCommands(IReadOnlyList<ScenarioGroupCommandDto> commands)
        => JsonSerializer.Serialize(commands, JsonOpts);

    /// <summary>«08:00», «8:00:00», фрагменты из input type=time.</summary>
    private static bool TryParseScheduleTime(string? raw, out TimeSpan time)
    {
        time = default;
        if (string.IsNullOrWhiteSpace(raw)) return false;
        var s = raw.Trim();
        if (TimeOnly.TryParse(s, System.Globalization.CultureInfo.InvariantCulture, out var to))
        {
            time = to.ToTimeSpan();
            return true;
        }

        if (TimeSpan.TryParse(s, out time)) return true;

        if (s.Length >= 5 && s[2] == ':' &&
            int.TryParse(s.AsSpan(0, 2), System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out var h) &&
            int.TryParse(s.AsSpan(3, 2), System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out var m) &&
            h is >= 0 and < 24 && m is >= 0 and < 60)
        {
            time = new TimeSpan(h, m, 0);
            return true;
        }

        return false;
    }

    private async Task<bool> CommandsBelongToHouseAsync(int houseId, IReadOnlyList<ScenarioGroupCommandDto> commands, CancellationToken ct)
    {
        if (commands.Count == 0) return false;
        var ids = commands.Select(c => c.DeviceId).Distinct().ToList();
        var ok = await _context.Devices
            .AsNoTracking()
            .Include(d => d.Room)
            .Where(d => ids.Contains(d.DeviceId) && d.Room != null && d.Room.HouseId == houseId)
            .Select(d => d.DeviceId)
            .ToListAsync(ct);
        return ok.Count == ids.Count;
    }

    private static ScenarioGroupDto ToDto(ScenarioGroup g)
    {
        return new ScenarioGroupDto
        {
            GroupId = g.GroupId,
            HouseId = g.HouseId,
            Name = g.Name,
            Description = g.Description,
            Commands = ParseCommandsJson(g.CommandsJson),
            CreatedAt = g.CreatedAt,
            UpdatedAt = g.UpdatedAt,
        };
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ScenarioGroupDto>>> GetGroups(int houseId, CancellationToken ct)
    {
        var userId = GetUserId();
        if (!await CanManageScenarioGroupsAsync(userId, houseId, ct))
            return Forbid();

        var list = await _context.ScenarioGroups
            .AsNoTracking()
            .Where(g => g.HouseId == houseId)
            .OrderByDescending(g => g.UpdatedAt)
            .ToListAsync(ct);

        return Ok(list.Select(ToDto));
    }

    [HttpPost]
    public async Task<ActionResult<ScenarioGroupDto>> Create(int houseId, [FromBody] CreateScenarioGroupDto dto, CancellationToken ct)
    {
        var userId = GetUserId();
        if (!await CanManageScenarioGroupsAsync(userId, houseId, ct))
            return Forbid();

        if (dto.Commands == null || dto.Commands.Count == 0)
            return BadRequest(new { message = "Добавьте хотя бы одно устройство" });

        if (!await CommandsBelongToHouseAsync(houseId, dto.Commands, ct))
            return BadRequest(new { message = "Устройства должны принадлежать выбранному дому" });

        var now = DateTime.UtcNow;
        var entity = new ScenarioGroup
        {
            HouseId = houseId,
            Name = dto.Name.Trim(),
            Description = (dto.Description ?? string.Empty).Trim(),
            CommandsJson = SerializeCommands(dto.Commands),
            CreatedAt = now,
            UpdatedAt = now,
        };

        _context.ScenarioGroups.Add(entity);
        await _context.SaveChangesAsync(ct);

        var result = ToDto(entity);
        await _eventPublisher.PublishAsync("scenario_group.created", new
        {
            houseId,
            groupId = entity.GroupId,
            name = entity.Name,
        });

        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpPut("{groupId:int}")]
    public async Task<ActionResult<ScenarioGroupDto>> Update(int houseId, int groupId, [FromBody] UpdateScenarioGroupDto dto, CancellationToken ct)
    {
        var userId = GetUserId();
        if (!await CanManageScenarioGroupsAsync(userId, houseId, ct))
            return Forbid();

        var entity = await _context.ScenarioGroups.FirstOrDefaultAsync(g => g.GroupId == groupId && g.HouseId == houseId, ct);
        if (entity == null)
            return NotFound();

        if (dto.Name != null)
        {
            var n = dto.Name.Trim();
            if (string.IsNullOrEmpty(n))
                return BadRequest(new { message = "Название не может быть пустым" });
            entity.Name = n;
        }
        if (dto.Description != null)
            entity.Description = dto.Description.Trim();

        if (dto.Commands != null)
        {
            if (dto.Commands.Count == 0)
                return BadRequest(new { message = "В группе должно быть хотя бы одно устройство" });
            if (!await CommandsBelongToHouseAsync(houseId, dto.Commands, ct))
                return BadRequest(new { message = "Устройства должны принадлежать выбранному дому" });
            entity.CommandsJson = SerializeCommands(dto.Commands);
        }

        entity.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);

        var result = ToDto(entity);
        await _eventPublisher.PublishAsync("scenario_group.updated", new { houseId, groupId = entity.GroupId });
        return Ok(result);
    }

    [HttpDelete("{groupId:int}")]
    public async Task<IActionResult> Delete(int houseId, int groupId, CancellationToken ct)
    {
        var userId = GetUserId();
        if (!await CanManageScenarioGroupsAsync(userId, houseId, ct))
            return Forbid();

        var entity = await _context.ScenarioGroups.FirstOrDefaultAsync(g => g.GroupId == groupId && g.HouseId == houseId, ct);
        if (entity == null)
            return NotFound();

        _context.ScenarioGroups.Remove(entity);
        await _context.SaveChangesAsync(ct);

        await _eventPublisher.PublishAsync("scenario_group.deleted", new { houseId, groupId });
        return NoContent();
    }

    private static ScenarioGroupScheduleDto ToScheduleDto(ScenarioGroupSchedule s)
    {
        var days = new List<int>();
        foreach (var p in s.DaysOfWeek.Split(',', StringSplitOptions.RemoveEmptyEntries))
        {
            if (int.TryParse(p.Trim(), out var d))
                days.Add(d);
        }

        return new ScenarioGroupScheduleDto
        {
            ScheduleId = s.ScheduleId,
            GroupId = s.GroupId,
            Time = s.Time.ToString(@"hh\:mm"),
            DaysOfWeek = days,
            IsEnabled = s.IsEnabled,
        };
    }

    private async Task<bool> GroupInHouseAsync(int houseId, int groupId, CancellationToken ct) =>
        await _context.ScenarioGroups.AnyAsync(g => g.GroupId == groupId && g.HouseId == houseId, ct);

    [HttpGet("{groupId:int}/schedules")]
    public async Task<ActionResult<IEnumerable<ScenarioGroupScheduleDto>>> GetGroupSchedules(int houseId, int groupId, CancellationToken ct)
    {
        var userId = GetUserId();
        if (!await CanManageScenarioGroupsAsync(userId, houseId, ct))
            return Forbid();

        if (!await GroupInHouseAsync(houseId, groupId, ct))
            return NotFound();

        var rows = await _context.ScenarioGroupSchedules
            .AsNoTracking()
            .Where(s => s.GroupId == groupId)
            .OrderBy(s => s.Time)
            .ThenBy(s => s.ScheduleId)
            .ToListAsync(ct);

        return Ok(rows.Select(ToScheduleDto));
    }

    [HttpPost("{groupId:int}/schedules")]
    public async Task<ActionResult<ScenarioGroupScheduleDto>> CreateGroupSchedule(
        int houseId,
        int groupId,
        [FromBody] CreateScenarioGroupScheduleDto dto,
        CancellationToken ct)
    {
        var userId = GetUserId();
        if (!await CanManageScenarioGroupsAsync(userId, houseId, ct))
            return Forbid();

        if (!await GroupInHouseAsync(houseId, groupId, ct))
            return NotFound();

        if (!TryParseScheduleTime(dto.Time, out var time))
            return BadRequest(new { message = "Неверный формат времени (ожидается HH:mm)" });

        var entity = new ScenarioGroupSchedule
        {
            GroupId = groupId,
            Time = time,
            DaysOfWeek = dto.DaysOfWeek is { Count: > 0 } ? string.Join(",", dto.DaysOfWeek) : string.Empty,
            IsEnabled = true,
        };

        _context.ScenarioGroupSchedules.Add(entity);
        try
        {
            await _context.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex)
        {
            return StatusCode(500, new
            {
                message =
                    "Не удалось сохранить расписание. Часто это отсутствует таблица scenario_group_schedules — выполни SQL из scenario_groups_migration.sql в PostgreSQL.",
                detail = ex.InnerException?.Message ?? ex.Message,
            });
        }

        return StatusCode(StatusCodes.Status201Created, ToScheduleDto(entity));
    }

    [HttpPut("{groupId:int}/schedules/{scheduleId:int}")]
    public async Task<ActionResult<ScenarioGroupScheduleDto>> UpdateGroupSchedule(
        int houseId,
        int groupId,
        int scheduleId,
        [FromBody] UpdateScenarioGroupScheduleDto dto,
        CancellationToken ct)
    {
        var userId = GetUserId();
        if (!await CanManageScenarioGroupsAsync(userId, houseId, ct))
            return Forbid();

        if (!await GroupInHouseAsync(houseId, groupId, ct))
            return NotFound();

        var sch = await _context.ScenarioGroupSchedules.FirstOrDefaultAsync(
            s => s.ScheduleId == scheduleId && s.GroupId == groupId,
            ct);
        if (sch == null)
            return NotFound();

        if (!string.IsNullOrEmpty(dto.Time))
        {
            if (!TryParseScheduleTime(dto.Time, out var t))
                return BadRequest(new { message = "Неверный формат времени (ожидается HH:mm)" });
            sch.Time = t;
        }

        if (dto.DaysOfWeek != null)
            sch.DaysOfWeek = dto.DaysOfWeek.Count > 0 ? string.Join(",", dto.DaysOfWeek) : string.Empty;

        if (dto.IsEnabled.HasValue)
            sch.IsEnabled = dto.IsEnabled.Value;

        await _context.SaveChangesAsync(ct);
        return Ok(ToScheduleDto(sch));
    }

    [HttpPut("{groupId:int}/schedules/{scheduleId:int}/toggle")]
    public async Task<ActionResult<object>> ToggleGroupSchedule(int houseId, int groupId, int scheduleId, CancellationToken ct)
    {
        var userId = GetUserId();
        if (!await CanManageScenarioGroupsAsync(userId, houseId, ct))
            return Forbid();

        if (!await GroupInHouseAsync(houseId, groupId, ct))
            return NotFound();

        var sch = await _context.ScenarioGroupSchedules.FirstOrDefaultAsync(
            s => s.ScheduleId == scheduleId && s.GroupId == groupId,
            ct);
        if (sch == null)
            return NotFound();

        sch.IsEnabled = !sch.IsEnabled;
        await _context.SaveChangesAsync(ct);
        return Ok(new { isEnabled = sch.IsEnabled });
    }

    [HttpDelete("{groupId:int}/schedules/{scheduleId:int}")]
    public async Task<IActionResult> DeleteGroupSchedule(int houseId, int groupId, int scheduleId, CancellationToken ct)
    {
        var userId = GetUserId();
        if (!await CanManageScenarioGroupsAsync(userId, houseId, ct))
            return Forbid();

        if (!await GroupInHouseAsync(houseId, groupId, ct))
            return NotFound();

        var sch = await _context.ScenarioGroupSchedules.FirstOrDefaultAsync(
            s => s.ScheduleId == scheduleId && s.GroupId == groupId,
            ct);
        if (sch == null)
            return NotFound();

        _context.ScenarioGroupSchedules.Remove(sch);
        await _context.SaveChangesAsync(ct);
        return NoContent();
    }
}
