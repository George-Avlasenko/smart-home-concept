using System;
using System.Collections.Generic;
using System.Net;

namespace SmartHome.API.Models;

public partial class Log
{
    public int LogId { get; set; }

    public int? UserId { get; set; }

    public string EventType { get; set; } = null!;

    public string? Message { get; set; }

    public IPAddress? IpAddress { get; set; }

    public DateTime? Timestamp { get; set; }
}
