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

