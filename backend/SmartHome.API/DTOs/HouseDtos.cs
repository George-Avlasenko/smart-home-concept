using System.ComponentModel.DataAnnotations;

namespace SmartHome.API.DTOs;

public class HouseDto
{
    public int HouseId { get; set; }
    public string Address { get; set; } = string.Empty;
    public DateTime? CreatedAt { get; set; }
    public int? OwnerId { get; set; }
    public string? CurrentUserRole { get; set; } // Роль текущего пользователя (owner, admin, member, viewer)
}

public class CreateHouseDto
{
    [Required]
    public string Address { get; set; } = string.Empty;
}

public class UpdateHouseDto
{
    [Required]
    public string Address { get; set; } = string.Empty;
}
