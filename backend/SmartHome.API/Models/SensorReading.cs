using System;
using System.Collections.Generic;

namespace SmartHome.API.Models;

public partial class SensorReading
{
    public long ReadingId { get; set; }

    public int DeviceId { get; set; }

    public string ReadingType { get; set; } = null!;

    public decimal Value { get; set; }

    public string? Unit { get; set; }

    public DateTime? RecordedAt { get; set; }

    public virtual Device Device { get; set; } = null!;
}
