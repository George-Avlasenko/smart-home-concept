using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartHome.API.Services;

namespace SmartHome.API.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class IntegrationsController : ControllerBase
{
    private readonly TuyaCloudRuntimeConfig _tuyaRuntime;
    private readonly TuyaCloudLocalKeyService _tuyaService;

    public IntegrationsController(TuyaCloudRuntimeConfig tuyaRuntime, TuyaCloudLocalKeyService tuyaService)
    {
        _tuyaRuntime = tuyaRuntime;
        _tuyaService = tuyaService;
    }

    private bool IsAdmin() =>
        string.Equals(User.FindFirst(ClaimTypes.Role)?.Value, "admin", StringComparison.OrdinalIgnoreCase);

    public sealed class TuyaCloudSettingsDto
    {
        public bool? Enabled { get; set; }
        public string? AccessId { get; set; }
        public string? AccessSecret { get; set; }
        public string? Region { get; set; }
    }

    [HttpGet("tuya-cloud")]
    public IActionResult GetTuyaCloud()
    {
        if (!IsAdmin()) return Forbid("Только администратор может управлять интеграциями.");
        var snap = _tuyaRuntime.Snapshot();
        return Ok(new
        {
            enabled = snap.Enabled,
            accessId = snap.AccessId,
            accessSecret = snap.AccessSecret,
            hasAccessSecret = !string.IsNullOrWhiteSpace(snap.AccessSecret),
            region = snap.Region,
            isConfigured = _tuyaService.IsConfigured
        });
    }

    [HttpPut("tuya-cloud")]
    public IActionResult UpdateTuyaCloud([FromBody] TuyaCloudSettingsDto dto)
    {
        if (!IsAdmin()) return Forbid("Только администратор может управлять интеграциями.");
        _tuyaRuntime.Update(dto.Enabled, dto.AccessId, dto.AccessSecret, dto.Region);
        var snap = _tuyaRuntime.Snapshot();
        return Ok(new
        {
            ok = true,
            enabled = snap.Enabled,
            accessSecret = snap.AccessSecret,
            region = snap.Region,
            isConfigured = _tuyaService.IsConfigured
        });
    }
}
