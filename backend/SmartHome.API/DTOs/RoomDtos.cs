using System.ComponentModel.DataAnnotations;

namespace SmartHome.API.DTOs;

public class RoomDto
{
    public int RoomId { get; set; }
    public int HouseId { get; set; }
    public string RoomName { get; set; } = string.Empty;
    public int? Floor { get; set; }
}

public class CreateRoomDto
{
    [Required]
    public int HouseId { get; set; }

    [Required]
    public string RoomName { get; set; } = string.Empty;

    public int Floor { get; set; } = 1;
}

public class UpdateRoomDto
{
    [Required]
    public string RoomName { get; set; } = string.Empty;

    public int Floor { get; set; }
}

