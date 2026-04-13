using System;
using System.Collections.Generic;

namespace SmartHome.API.Models;

public partial class House
{
    public int HouseId { get; set; }

    public string Address { get; set; } = null!;

    public DateTime? CreatedAt { get; set; }

    public int? OwnerId { get; set; }

    public decimal? MinTemp { get; set; }
    public decimal? MaxTemp { get; set; }
    /// <summary>true = кондиционер по диапазону (ниже мин → греть до макс; выше макс → охлаждать до мин). false = одна целевая температура с карточки кондиционера.</summary>
    public bool UseTempRange { get; set; }
    public decimal? MinHumidity { get; set; }
    public decimal? MaxHumidity { get; set; }
    public decimal? MaxCo2 { get; set; }
    public decimal? OutdoorTemp { get; set; }
    public decimal? OutdoorHumidity { get; set; }
    public decimal? OutdoorCo2 { get; set; }

    public virtual User? Owner { get; set; }

    public virtual ICollection<Room> Rooms { get; set; } = new List<Room>();

    public virtual ICollection<HouseUser> HouseUsers { get; set; } = new List<HouseUser>();

    public virtual ICollection<ScenarioGroup> ScenarioGroups { get; set; } = new List<ScenarioGroup>();
}
