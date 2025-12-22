using System.ComponentModel.DataAnnotations;

namespace SmartHome.API.DTOs;

public class UserProfileDto
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? AvatarUrl { get; set; }
    public string Role { get; set; } = string.Empty;
}

public class UpdateProfileDto
{
    [EmailAddress]
    public string? Email { get; set; }
    public string? FullName { get; set; }
}

public class UpdatePasswordDto
{
    [Required]
    public string OldPassword { get; set; } = string.Empty;

    [Required]
    [MinLength(6)]
    public string NewPassword { get; set; } = string.Empty;
}




