using System;
using System.Collections.Generic;

namespace SmartHome.API.Models;

public partial class House
{
    public int HouseId { get; set; }

    public string Address { get; set; } = null!;

    public DateTime? CreatedAt { get; set; }

    public int? OwnerId { get; set; }

    public virtual User? Owner { get; set; }

    public virtual ICollection<Room> Rooms { get; set; } = new List<Room>();

    public virtual ICollection<HouseUser> HouseUsers { get; set; } = new List<HouseUser>();
}
