using System.ComponentModel.DataAnnotations;
using System.Net;
using SmartHome.API.Models;

namespace SmartHome.API.DTOs;

public class DeviceDto
{
    public int DeviceId { get; set; }
    public int RoomId { get; set; }
    public string RoomName { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Manufacturer { get; set; }
    public string? SerialNumber { get; set; } // Добавили
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

    [Required]
    public string Name { get; set; } = string.Empty;

    public string? Manufacturer { get; set; }

    public string? SerialNumber { get; set; }

    [Required]
    public string Type { get; set; } = string.Empty;

    public string? Ip { get; set; }
}

public class UpdateDeviceStatusDto
{
    [Required]
    public string Status { get; set; } = string.Empty;
}

public class UpdateDeviceSettingsDto
{
    public Dictionary<string, object> Settings { get; set; } = new();
}

public class UpdateDeviceDto
{
    public string? Name { get; set; }
    public string? Type { get; set; }
    public string? Manufacturer { get; set; }
    public string? SerialNumber { get; set; }
    public string? Ip { get; set; }
}

