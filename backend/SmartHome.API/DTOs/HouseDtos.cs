using System.ComponentModel.DataAnnotations;

namespace SmartHome.API.DTOs;

public class HouseDto
{
    public int HouseId { get; set; }
    public string Address { get; set; } = string.Empty;
    public DateTime? CreatedAt { get; set; }
    public int? OwnerId { get; set; }
    public string? CurrentUserRole { get; set; }
    public decimal? MinTemp { get; set; }
    public decimal? MaxTemp { get; set; }
    public bool UseTempRange { get; set; }
}

public class CreateHouseDto
{
    [Required]
    public string Address { get; set; } = string.Empty;
}

public class UpdateHouseDto
{
    public string? Address { get; set; }
    public decimal? MinTemp { get; set; }
    public decimal? MaxTemp { get; set; }
    public bool? UseTempRange { get; set; }
}
