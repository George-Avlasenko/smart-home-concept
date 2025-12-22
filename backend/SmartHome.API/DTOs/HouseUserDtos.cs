using System.ComponentModel.DataAnnotations;

namespace SmartHome.API.DTOs;

public class HouseUserDto
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public DateTime? JoinedAt { get; set; }
    public bool CanInvite { get; set; }
}

public class AddHouseUserDto
{
    [Required]
    public string Email { get; set; } = string.Empty;
}

public class UserDevicePermissionDto
{
    public int PermissionId { get; set; }
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public int DeviceId { get; set; }
    public string PermissionLevel { get; set; } = string.Empty;
}

public class UpdatePermissionDto
{
    [Required]
    public int UserId { get; set; }
    
    [Required]
    public int DeviceId { get; set; }

    [Required]
    public string PermissionLevel { get; set; } = string.Empty;
}

