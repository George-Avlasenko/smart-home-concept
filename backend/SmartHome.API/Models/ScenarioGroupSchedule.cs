namespace SmartHome.API.Models;

public partial class ScenarioGroupSchedule
{
    public int ScheduleId { get; set; }

    public int GroupId { get; set; }

    public TimeSpan Time { get; set; }

    public string DaysOfWeek { get; set; } = string.Empty;

    public bool IsEnabled { get; set; } = true;

    /// <summary>Чтобы не срабатывать дважды за короткий интервал (воркер каждые 10 с).</summary>
    public DateTime? LastTriggeredAt { get; set; }

    public virtual ScenarioGroup Group { get; set; } = null!;
}
