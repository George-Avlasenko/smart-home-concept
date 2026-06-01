using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SmartHome.API.Models;

namespace SmartHome.API.Services;

/// <summary>Применение сохранённых команд сценария (расписание группы / ручной вызов).</summary>
public static class ScenarioGroupApplyHelper
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public static async Task ApplyGroupAsync(
        SmartHomeContext context,
        IHttpClientFactory httpClientFactory,
        TuyaServiceLocator tuyaLocator,
        ILogger logger,
        ScenarioGroup group,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(group.CommandsJson) || group.CommandsJson == "[]")
            return;

        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(group.CommandsJson);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Scenario group {GroupId}: invalid commands JSON", group.GroupId);
            return;
        }

        using (doc)
        {
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (!el.TryGetProperty("deviceId", out var didEl) || didEl.ValueKind != JsonValueKind.Number)
                    continue;
                var deviceId = didEl.GetInt32();
                var statusStr = el.TryGetProperty("status", out var stEl) && stEl.ValueKind == JsonValueKind.String
                    ? stEl.GetString() ?? "inactive"
                    : "inactive";
                var settingsJson = "{}";
                if (el.TryGetProperty("settings", out var se) && se.ValueKind is JsonValueKind.Object or JsonValueKind.Array)
                    settingsJson = se.GetRawText();
                else if (se.ValueKind == JsonValueKind.String)
                    settingsJson = se.GetString() ?? "{}";

                var device = await context.Devices
                    .Include(d => d.DeviceSettings)
                    .FirstOrDefaultAsync(d => d.DeviceId == deviceId, ct);
                if (device == null) continue;

                if (!Enum.TryParse<DeviceStatus>(statusStr, true, out var targetStatus))
                    targetStatus = DeviceStatus.inactive;

                var merged = DeviceMetaHelper.ParseToNestedObjects(device.MetaData);
                foreach (var kv in ParseSettings(settingsJson))
                    merged[kv.Key] = kv.Value;

                if (device.Type.Equals("light", StringComparison.OrdinalIgnoreCase) &&
                    IsTuyaEnabled(merged) &&
                    !DeviceTuyaHelper.IsLocalOnlyDevice(device.HardwareDeviceId, device.MetaData))
                {
                    var sent = await SendTuyaByScheduleAsync(httpClientFactory, tuyaLocator, merged, targetStatus, logger);
                    if (!sent)
                    {
                        logger.LogWarning("Scenario group {GroupId}: Tuya failed for device {DeviceId}", group.GroupId, deviceId);
                        continue;
                    }
                }

                device.Status = targetStatus;
                device.MetaData = JsonSerializer.Serialize(merged, JsonOptions);

                context.DeviceStatusHistories.Add(new DeviceStatusHistory
                {
                    DeviceId = device.DeviceId,
                    Status = targetStatus,
                    Timestamp = DateTime.UtcNow,
                    ChangedByUserId = null,
                    ChangeReason = "scenario_group_schedule",
                });

                logger.LogInformation("Scenario group {GroupId} applied: device {DeviceId} -> {Status}", group.GroupId, deviceId, targetStatus);
            }
        }
    }

    private static Dictionary<string, object> ParseSettings(string? settingsJson)
    {
        if (string.IsNullOrWhiteSpace(settingsJson)) return new Dictionary<string, object>();
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, object>>(settingsJson, JsonOptions) ?? new Dictionary<string, object>();
        }
        catch
        {
            return new Dictionary<string, object>();
        }
    }

    private static bool IsTuyaEnabled(Dictionary<string, object> settingsDict)
    {
        if (!settingsDict.TryGetValue("tuya", out var tuyaObj) || tuyaObj is null) return false;
        try
        {
            var tuyaJson = JsonSerializer.Serialize(tuyaObj, JsonOptions);
            using var d = JsonDocument.Parse(tuyaJson);
            if (!d.RootElement.TryGetProperty("enabled", out var enabled)) return false;
            return enabled.ValueKind == JsonValueKind.True ||
                   (enabled.ValueKind == JsonValueKind.String && bool.TryParse(enabled.GetString(), out var b) && b);
        }
        catch
        {
            return false;
        }
    }

    private static async Task<bool> SendTuyaByScheduleAsync(
        IHttpClientFactory httpClientFactory,
        TuyaServiceLocator tuyaLocator,
        Dictionary<string, object> settingsDict,
        DeviceStatus targetStatus,
        ILogger logger)
    {
        if (!settingsDict.TryGetValue("tuya", out var tuyaObj) || tuyaObj is null) return false;

        string? deviceId = null;
        string? localKey = null;
        string? ip = null;
        var version = "3.5";
        var dpsSwitch = 20;
        int? brightnessPercent = null;
        int? colorTempKelvin = null;

        try
        {
            var tuyaJson = JsonSerializer.Serialize(tuyaObj, JsonOptions);
            using var doc = JsonDocument.Parse(tuyaJson);
            var root = doc.RootElement;

            deviceId = root.TryGetProperty("deviceId", out var d) ? d.GetString() : null;
            localKey = root.TryGetProperty("localKey", out var k) ? k.GetString() : null;
            ip = root.TryGetProperty("ip", out var i) ? i.GetString() : null;
            if (root.TryGetProperty("version", out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString()))
                version = v.GetString()!;
            if (root.TryGetProperty("dpsSwitch", out var ds))
            {
                if (ds.ValueKind == JsonValueKind.Number && ds.TryGetInt32(out var parsed)) dpsSwitch = parsed;
                else if (ds.ValueKind == JsonValueKind.String && int.TryParse(ds.GetString(), out var parsedStr)) dpsSwitch = parsedStr;
            }

            if (settingsDict.TryGetValue("brightness", out var bObj))
            {
                if (bObj is JsonElement be && be.ValueKind == JsonValueKind.Number && be.TryGetInt32(out var bNum)) brightnessPercent = bNum;
                else if (int.TryParse(bObj?.ToString(), out var bParsed)) brightnessPercent = bParsed;
            }
            if (settingsDict.TryGetValue("colorTempKelvin", out var tObj))
            {
                if (tObj is JsonElement te && te.ValueKind == JsonValueKind.Number && te.TryGetInt32(out var tNum)) colorTempKelvin = tNum;
                else if (int.TryParse(tObj?.ToString(), out var tParsed)) colorTempKelvin = tParsed;
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Tuya parse in scenario group apply");
            return false;
        }

        if (string.IsNullOrWhiteSpace(deviceId) || string.IsNullOrWhiteSpace(localKey) || string.IsNullOrWhiteSpace(ip))
            return false;

        var basePayload = new
        {
            device_id = deviceId.Trim(),
            local_key = localKey,
            ip = ip.Trim(),
            version,
            dps_switch = dpsSwitch > 0 ? dpsSwitch : 20
        };

        var tuyaBaseUrl = await tuyaLocator.GetReachableBaseUrlAsync();
        if (string.IsNullOrEmpty(tuyaBaseUrl))
            return false;

        var client = httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(8);

        try
        {
            using var switchResp = await client.PostAsync(
                $"{tuyaBaseUrl.TrimEnd('/')}/v1/switch",
                new StringContent(JsonSerializer.Serialize(new { basePayload.device_id, basePayload.local_key, basePayload.ip, basePayload.version, basePayload.dps_switch, on = targetStatus == DeviceStatus.active }, JsonOptions), Encoding.UTF8, "application/json"));
            if (!switchResp.IsSuccessStatusCode) return false;

            if (targetStatus == DeviceStatus.active && brightnessPercent.HasValue)
            {
                var bright = Math.Clamp(brightnessPercent.Value, 1, 100);
                using var brResp = await client.PostAsync(
                    $"{tuyaBaseUrl.TrimEnd('/')}/v1/brightness",
                    new StringContent(JsonSerializer.Serialize(new { basePayload.device_id, basePayload.local_key, basePayload.ip, basePayload.version, basePayload.dps_switch, percent = bright }, JsonOptions), Encoding.UTF8, "application/json"));
                if (!brResp.IsSuccessStatusCode) return false;
            }

            if (targetStatus == DeviceStatus.active && colorTempKelvin.HasValue)
            {
                var kelvin = Math.Clamp(colorTempKelvin.Value, 2700, 6500);
                using var tResp = await client.PostAsync(
                    $"{tuyaBaseUrl.TrimEnd('/')}/v1/temperature",
                    new StringContent(JsonSerializer.Serialize(new { basePayload.device_id, basePayload.local_key, basePayload.ip, basePayload.version, basePayload.dps_switch, kelvin }, JsonOptions), Encoding.UTF8, "application/json"));
                if (!tResp.IsSuccessStatusCode) return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Tuya HTTP in scenario group apply");
            return false;
        }
    }
}
