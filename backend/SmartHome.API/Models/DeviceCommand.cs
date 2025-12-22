using System;
using System.Collections.Generic;

namespace SmartHome.API.Models;

public partial class DeviceCommand
{
    public int CommandId { get; set; }

    public int DeviceId { get; set; }

    public int? UserId { get; set; }

    public string CommandType { get; set; } = null!;

    public string? Payload { get; set; }

    public CommandStatus Status { get; set; }

    public DateTime? ExecutedAt { get; set; }

    public string? ErrorMessage { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual Device Device { get; set; } = null!;

    public virtual User? User { get; set; }
}
