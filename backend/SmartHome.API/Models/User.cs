using System;
using System.Collections.Generic;

namespace SmartHome.API.Models;

public partial class User
{
    public int UserId { get; set; }

    public string Username { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string Role { get; set; } = null!;

    public bool? IsBlocked { get; set; }

    public string? FullName { get; set; }

    public string? AvatarUrl { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual ICollection<DeviceCommand> DeviceCommands { get; set; } = new List<DeviceCommand>();

    public virtual ICollection<UserDevicePermission> UserDevicePermissions { get; set; } = new List<UserDevicePermission>();

    public virtual ICollection<HouseUser> HouseUsers { get; set; } = new List<HouseUser>();
}
