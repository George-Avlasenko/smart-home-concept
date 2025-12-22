using System;

namespace SmartHome.API.Models;

public partial class HouseUser
{
    public int HouseId { get; set; }
    public int UserId { get; set; }
    public string Role { get; set; } = "member";
    public DateTime? JoinedAt { get; set; }

    public virtual House House { get; set; } = null!;
    public virtual User User { get; set; } = null!;
}

