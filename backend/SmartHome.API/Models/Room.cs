using System;
using System.Collections.Generic;

namespace SmartHome.API.Models;

public partial class Room
{
    public int RoomId { get; set; }

    public int HouseId { get; set; }

    public string RoomName { get; set; } = null!;

    public int? Floor { get; set; }

    public virtual ICollection<Device> Devices { get; set; } = new List<Device>();

    public virtual House House { get; set; } = null!;
}
