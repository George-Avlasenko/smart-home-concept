using System.ComponentModel.DataAnnotations;
using System.Net;
using SmartHome.API.Models;

namespace SmartHome.API.DTOs;

public class SupportedDeviceProductDto
{
    public string Sku { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Manufacturer { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string SuggestedName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public List<string> Features { get; set; } = [];
    public string? TuyaProductLabel { get; set; }
}

public class DeviceCatalogRequestDto
{
    [Required]
    public string Category { get; set; } = string.Empty;
    [Required]
    public string DeviceKind { get; set; } = string.Empty;
    [Required]
    public string Connectivity { get; set; } = string.Empty;
    public string? LightMode { get; set; }
    [Required]
    public string Contact { get; set; } = string.Empty;
    public string? Comment { get; set; }
}

public class DiscoverDeviceDto
{
    public string? ProductSku { get; set; }

    /// <summary>
    /// auto — общий UDP-скан (TinyTuya); tuya_lan — тот же скан, но дольше и с опциональным целевым IP лампы.
    /// </summary>
    public string? Mode { get; set; }

    /// <summary>Один или несколько IPv4 (например IP лампы из админки роутера).</summary>
    public List<string>? WantIps { get; set; }

    public int? TimeoutSec { get; set; }
}

public class DeviceDto
{
    public int DeviceId { get; set; }
    public int RoomId { get; set; }
    public string RoomName { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Manufacturer { get; set; }
    /// <summary>SKU модели из каталога (в meta_data.catalogSku).</summary>
    public string? ProductSku { get; set; }
    /// <summary>Уникальный ID экземпляра устройства.</summary>
    public string? HardwareDeviceId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string? Ip { get; set; }
    public string? MacAddress { get; set; }
    public string Status { get; set; } = string.Empty;
    
    // Новые поля для группировки и настроек
    public int HouseId { get; set; }
    public string HouseAddress { get; set; } = string.Empty;
    public Dictionary<string, object> Settings { get; set; } = new();
    public string? CurrentUserPermission { get; set; }
    public decimal? OutdoorTemp { get; set; }
    public decimal? OutdoorHumidity { get; set; }
    public decimal? OutdoorCo2 { get; set; }
}

public class CreateDeviceDto
{
    [Required]
    public int RoomId { get; set; }

    /// <summary>Артикул из GET /api/devices/catalog.</summary>
    [Required]
    public string ProductSku { get; set; } = string.Empty;

    [Required]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string HardwareDeviceId { get; set; } = string.Empty;

    public string? Ip { get; set; }

    /// <summary>Версия локального протокола Tuya с LAN-поиска (например 3.3), для блока settings.tuya.</summary>
    public string? TuyaLanVersion { get; set; }
}

public class UpdateDeviceStatusDto
{
    [Required]
    public string Status { get; set; } = string.Empty;

    /// <summary>Только запись в БД (сценарии групп и т.д.), без LAN-команды в tuya-service.</summary>
    public bool SkipTuyaLan { get; set; }
}

public class UpdateDeviceSettingsDto
{
    public Dictionary<string, object> Settings { get; set; } = new();
}

public class UpdateDeviceDto
{
    public string? Name { get; set; }
    public string? HardwareDeviceId { get; set; }
    public string? Ip { get; set; }
}

public class RefreshTuyaLocalKeyDto
{
    [Required]
    public string HardwareDeviceId { get; set; } = string.Empty;
}

