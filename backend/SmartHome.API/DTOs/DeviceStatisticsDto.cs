namespace SmartHome.API.DTOs;

public class DeviceStatisticsDto
{
    public int DeviceId { get; set; }
    public string DeviceName { get; set; } = null!;
    public List<StatusEventDto> Events { get; set; } = new();
    public long TotalActiveTimeSeconds { get; set; }
    public long TotalInactiveTimeSeconds { get; set; }
    public int TotalSwitches { get; set; }
    public DateTime? LastTurnedOn { get; set; }
    public DateTime? LastTurnedOff { get; set; }
    public long? CurrentSessionDurationSeconds { get; set; } // Если сейчас включено
}

public class StatusEventDto
{
    public long HistoryId { get; set; }
    public string Status { get; set; } = null!;
    public DateTime Timestamp { get; set; }
    public string? ChangedByUsername { get; set; }
    public string? ChangeReason { get; set; }
    public long? DurationSeconds { get; set; } // Длительность предыдущей сессии в секундах
}

