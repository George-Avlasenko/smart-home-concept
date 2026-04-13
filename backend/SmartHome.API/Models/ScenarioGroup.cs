namespace SmartHome.API.Models;

public partial class ScenarioGroup
{
    public int GroupId { get; set; }

    public int HouseId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    /// <summary>JSON-массив команд: [{ "deviceId", "status", "settings" }].</summary>
    public string CommandsJson { get; set; } = "[]";

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual House House { get; set; } = null!;

    public virtual ICollection<ScenarioGroupSchedule> Schedules { get; set; } = new List<ScenarioGroupSchedule>();
}
