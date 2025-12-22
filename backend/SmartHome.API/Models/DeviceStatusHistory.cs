using System;

namespace SmartHome.API.Models;

public partial class DeviceStatusHistory
{
    public long HistoryId { get; set; }
    public int DeviceId { get; set; }
    public DeviceStatus Status { get; set; }
    public DateTime Timestamp { get; set; }
    public int? ChangedByUserId { get; set; }
    public string? ChangeReason { get; set; } // 'manual', 'schedule', 'system', etc.

    public virtual Device Device { get; set; } = null!;
    public virtual User? ChangedByUser { get; set; }
}


