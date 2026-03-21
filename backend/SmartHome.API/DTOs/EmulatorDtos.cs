namespace SmartHome.API.DTOs;

/// <summary>
/// Уличные показания по дому (от эмулятора).
/// </summary>
public class OutdoorReadingsDto
{
    public decimal? Temp { get; set; }
    public decimal? Humidity { get; set; }
    public decimal? Co2 { get; set; }
}

/// <summary>
/// Показания одного устройства (датчик: temp, humidity, co2; чайник: waterTemp).
/// </summary>
public class DeviceReadingItemDto
{
    public int DeviceId { get; set; }
    public decimal? Temperature { get; set; }
    public decimal? Humidity { get; set; }
    public decimal? Co2 { get; set; }
    public decimal? WaterTemp { get; set; }
}

/// <summary>
/// Тело запроса POST от эмулятора: дом, уличные показания, показания по устройствам.
/// </summary>
public class EmulatorReadingsDto
{
    public int HouseId { get; set; }
    public OutdoorReadingsDto? Outdoor { get; set; }
    public List<DeviceReadingItemDto> Readings { get; set; } = new();
}
