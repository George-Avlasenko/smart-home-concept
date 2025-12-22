using System;
using System.Collections.Generic;

namespace SmartHome.API.Models;

public partial class UserDevicePermission
{
    public int PermissionId { get; set; }

    public int UserId { get; set; }

    public int DeviceId { get; set; }

    public PermissionLevel PermissionLevel { get; set; }

    public int? GrantedBy { get; set; }

    public DateTime? GrantedAt { get; set; }

    public virtual Device Device { get; set; } = null!;

    public virtual User User { get; set; } = null!;
}
