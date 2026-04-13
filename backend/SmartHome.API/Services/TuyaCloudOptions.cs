namespace SmartHome.API.Services;

/// <summary>
/// Ключи Cloud Development (Access ID / Secret) — те же, что для tinytuya Cloud.getdevices().
/// </summary>
public sealed class TuyaCloudOptions
{
    public const string SectionName = "TuyaCloud";

    /// <summary>Включить попытку подставить local key при POST /devices.</summary>
    public bool Enabled { get; set; }

    public string AccessId { get; set; } = string.Empty;
    public string AccessSecret { get; set; } = string.Empty;

    /// <summary>eu, us, cn, in, …</summary>
    public string Region { get; set; } = "eu";
}
