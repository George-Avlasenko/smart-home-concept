namespace SmartHome.API.Services;

public static class DeviceTuyaHelper
{
    /// <summary>Виртуальные (VIRTUAL-*) и демо-эмулятор (SN-*) — только БД, без Tuya LAN.</summary>
    public static bool IsLocalOnlyDevice(string? hardwareDeviceId, string? metaData)
    {
        if (IsLocalOnlyId(hardwareDeviceId)) return true;
        if (string.IsNullOrWhiteSpace(metaData)) return false;
        try
        {
            var settings = DeviceMetaHelper.ParseToNestedObjects(metaData);
            if (!settings.TryGetValue("tuya", out var tuyaRaw) || tuyaRaw is null) return false;
            var json = System.Text.Json.JsonSerializer.Serialize(tuyaRaw);
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("deviceId", out var d) && d.ValueKind == System.Text.Json.JsonValueKind.String)
                return IsLocalOnlyId(d.GetString());
        }
        catch { /* ignore */ }
        return false;
    }

    public static bool IsLocalOnlyId(string? id)
    {
        if (string.IsNullOrWhiteSpace(id)) return false;
        var s = id.Trim();
        return s.StartsWith("VIRTUAL-", StringComparison.OrdinalIgnoreCase)
            || s.StartsWith("SN-", StringComparison.OrdinalIgnoreCase);
    }
}
