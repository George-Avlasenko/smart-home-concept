using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace SmartHome.API.DTOs;

public class ScenarioGroupDto
{
    public int GroupId { get; set; }
    public int HouseId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<ScenarioGroupCommandDto> Commands { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class ScenarioGroupCommandDto
{
    public int DeviceId { get; set; }
    public string Status { get; set; } = "inactive";
    public JsonElement Settings { get; set; }
}

public class CreateScenarioGroupDto
{
    [Required]
    [MaxLength(20)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Description { get; set; }

    [Required]
    public List<ScenarioGroupCommandDto> Commands { get; set; } = new();
}

public class UpdateScenarioGroupDto
{
    [MaxLength(20)]
    public string? Name { get; set; }

    [MaxLength(100)]
    public string? Description { get; set; }

    public List<ScenarioGroupCommandDto>? Commands { get; set; }
}

public class ScenarioGroupScheduleDto
{
    public int ScheduleId { get; set; }
    public int GroupId { get; set; }
    public string Time { get; set; } = string.Empty;
    public List<int> DaysOfWeek { get; set; } = new();
    public bool IsEnabled { get; set; }
}

public class CreateScenarioGroupScheduleDto
{
    [Required]
    public string Time { get; set; } = string.Empty;

    public List<int> DaysOfWeek { get; set; } = new();
}

public class UpdateScenarioGroupScheduleDto
{
    public string? Time { get; set; }
    public List<int>? DaysOfWeek { get; set; }
    public bool? IsEnabled { get; set; }
}
