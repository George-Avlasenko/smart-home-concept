namespace SmartHome.API.DTOs;

public class SensorReadingDto
{
    public long ReadingId { get; set; }
    public int DeviceId { get; set; }
    public string ReadingType { get; set; } = null!;
    public decimal Value { get; set; }
    public string? Unit { get; set; }
    public DateTime RecordedAt { get; set; }
}

/// <summary>Одна точка графика средних по датчикам дома (время + средние temp, humidity, co2).</summary>
public class HouseSensorSummaryPointDto
{
    public DateTime RecordedAt { get; set; }
    public decimal? Temp { get; set; }
    public decimal? Humidity { get; set; }
    public decimal? Co2 { get; set; }
}

