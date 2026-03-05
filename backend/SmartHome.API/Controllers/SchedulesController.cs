using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHome.API.DTOs;
using SmartHome.API.Models;
using SmartHome.API.Services;
using System.Security.Claims;

namespace SmartHome.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class SchedulesController : ControllerBase
    {
        private readonly SmartHomeContext _context;
        private readonly EventPublisher _eventPublisher;

        public SchedulesController(SmartHomeContext context, EventPublisher eventPublisher)
        {
            _context = context;
            _eventPublisher = eventPublisher;
        }

        // GET: api/schedules/device/{deviceId}
        [HttpGet("device/{deviceId}")]
        public async Task<ActionResult<IEnumerable<ScheduleDto>>> GetSchedules(int deviceId)
        {
            var schedules = await _context.DeviceSchedules
                .Where(s => s.DeviceId == deviceId)
                .ToListAsync();

            return schedules.Select(s => new ScheduleDto
            {
                Id = s.Id,
                DeviceId = s.DeviceId,
                Time = s.Time.ToString(@"hh\:mm"),
                DaysOfWeek = s.DaysOfWeek.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse).ToList(),
                ActionOn = s.ActionOn,
                Action = s.Action,
                IsEnabled = s.IsEnabled
            }).ToList();
        }

        // POST: api/schedules
        [HttpPost]
        public async Task<ActionResult<ScheduleDto>> CreateSchedule(CreateScheduleDto dto)
        {
            if (!TimeSpan.TryParse(dto.Time, out var time))
            {
                return BadRequest("Invalid time format (HH:mm)");
            }

            var schedule = new DeviceSchedule
            {
                DeviceId = dto.DeviceId,
                Time = time,
                DaysOfWeek = string.Join(",", dto.DaysOfWeek),
                ActionOn = dto.ActionOn ?? (dto.Action == "on" || dto.Action == "opened" || dto.Action == "tilted"),
                Action = dto.Action,
                IsEnabled = true
            };

            _context.DeviceSchedules.Add(schedule);
            await _context.SaveChangesAsync();

            // Публикуем событие создания расписания
            await _eventPublisher.PublishAsync("schedule.created", new
            {
                scheduleId = schedule.Id,
                deviceId = schedule.DeviceId
            });

            return CreatedAtAction(nameof(GetSchedules), new { deviceId = schedule.DeviceId }, new ScheduleDto
            {
                Id = schedule.Id,
                DeviceId = schedule.DeviceId,
                Time = schedule.Time.ToString(@"hh\:mm"),
                DaysOfWeek = dto.DaysOfWeek,
                ActionOn = schedule.ActionOn,
                Action = schedule.Action,
                IsEnabled = true
            });
        }

        // DELETE: api/schedules/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSchedule(int id)
        {
            var schedule = await _context.DeviceSchedules.FindAsync(id);
            if (schedule == null) return NotFound();

            var scheduleId = schedule.Id;
            var deviceId = schedule.DeviceId;
            _context.DeviceSchedules.Remove(schedule);
            await _context.SaveChangesAsync();

            // Публикуем событие удаления расписания
            await _eventPublisher.PublishAsync("schedule.deleted", new
            {
                scheduleId = scheduleId,
                deviceId = deviceId
            });

            return NoContent();
        }
        
        // PUT: api/schedules/{id}/toggle
        [HttpPut("{id}/toggle")]
        public async Task<IActionResult> ToggleSchedule(int id)
        {
            var schedule = await _context.DeviceSchedules.FindAsync(id);
            if (schedule == null) return NotFound();

            schedule.IsEnabled = !schedule.IsEnabled;
            await _context.SaveChangesAsync();

            // Публикуем событие изменения статуса расписания
            await _eventPublisher.PublishAsync("schedule.toggled", new
            {
                scheduleId = schedule.Id,
                deviceId = schedule.DeviceId,
                isEnabled = schedule.IsEnabled
            });

            return Ok(new { isEnabled = schedule.IsEnabled });
        }

        // PUT: api/schedules/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateSchedule(int id, [FromBody] UpdateScheduleDto dto)
        {
            var schedule = await _context.DeviceSchedules.FindAsync(id);
            if (schedule == null) return NotFound();

            if (dto.ActionOn.HasValue)
            {
                schedule.ActionOn = dto.ActionOn.Value;
            }

            if (dto.Action != null)
            {
                schedule.Action = dto.Action;
                // Обновляем ActionOn для совместимости
                schedule.ActionOn = dto.Action == "on" || dto.Action == "opened" || dto.Action == "tilted";
            }

            if (!string.IsNullOrEmpty(dto.Time))
            {
                if (TimeSpan.TryParse(dto.Time, out var time))
                {
                    schedule.Time = time;
                }
                else
                {
                    return BadRequest("Invalid time format (HH:mm)");
                }
            }

            // Обновляем дни недели: null = не обновлять, пустой массив = однократное расписание (пустая строка)
            if (dto.DaysOfWeek != null)
            {
                schedule.DaysOfWeek = dto.DaysOfWeek.Count > 0 
                    ? string.Join(",", dto.DaysOfWeek) 
                    : ""; // Пустая строка для однократного расписания
            }

            await _context.SaveChangesAsync();

            // Публикуем событие обновления расписания
            await _eventPublisher.PublishAsync("schedule.updated", new
            {
                scheduleId = schedule.Id,
                deviceId = schedule.DeviceId
            });

            return Ok(new ScheduleDto
            {
                Id = schedule.Id,
                DeviceId = schedule.DeviceId,
                Time = schedule.Time.ToString(@"hh\:mm"),
                DaysOfWeek = schedule.DaysOfWeek.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse).ToList(),
                ActionOn = schedule.ActionOn,
                Action = schedule.Action,
                IsEnabled = schedule.IsEnabled
            });
        }
    }
}

