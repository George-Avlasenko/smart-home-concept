using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SmartHome.API.Models
{
    [Table("device_schedules")]
    public class DeviceSchedule
    {
        [Key]
        [Column("schedule_id")]
        public int Id { get; set; }

        [Column("device_id")]
        public int DeviceId { get; set; }
        
        [Column("time", TypeName = "time")]
        public TimeSpan Time { get; set; }

        [Column("days_of_week")]
        [MaxLength(50)]
        public string DaysOfWeek { get; set; } = null!; // "1,2,3" for Mon, Tue, Wed

        [Column("action_on")] // true for ON, false for OFF (legacy)
        public bool ActionOn { get; set; }

        [Column("action")]
        [MaxLength(50)]
        public string? Action { get; set; } // "on", "off", "closed", "tilted", "opened"

        [Column("is_enabled")]
        public bool IsEnabled { get; set; } = true;

        [ForeignKey("DeviceId")]
        public virtual Device Device { get; set; } = null!;
    }
}

