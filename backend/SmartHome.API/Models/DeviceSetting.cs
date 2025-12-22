using System;
using System.Collections.Generic;

namespace SmartHome.API.Models;

public partial class DeviceSetting
{
    public int SettingId { get; set; }

    public int DeviceId { get; set; }

    public string Settings { get; set; } = null!;

    public DateTime? UpdatedAt { get; set; }

    public virtual Device Device { get; set; } = null!;
}
