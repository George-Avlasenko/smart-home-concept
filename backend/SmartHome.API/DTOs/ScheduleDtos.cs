using System.ComponentModel.DataAnnotations;

namespace SmartHome.API.DTOs
{
    public class CreateScheduleDto
    {
        [Required]
        public int DeviceId { get; set; }
        [Required]
        public string Time { get; set; } = string.Empty; // "HH:mm"
        public List<int> DaysOfWeek { get; set; } = new(); // [0, 1, 2]
        public bool? ActionOn { get; set; } // Legacy: для устройств с вкл/выкл
        public string? Action { get; set; } // Для устройств с несколькими действиями (окна: "closed", "tilted", "opened")
    }

    public class ScheduleDto
    {
        public int Id { get; set; }
        public int DeviceId { get; set; }
        public string Time { get; set; } = string.Empty;
        public List<int> DaysOfWeek { get; set; } = new();
        public bool ActionOn { get; set; }
        public string? Action { get; set; }
        public bool IsEnabled { get; set; }
    }

    public class UpdateScheduleDto
    {
        public string? Time { get; set; }
        public List<int>? DaysOfWeek { get; set; }
        public bool? ActionOn { get; set; }
        public string? Action { get; set; }
    }
}

