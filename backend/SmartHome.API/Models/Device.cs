using System;
using System.Collections.Generic;
using System.Net;

namespace SmartHome.API.Models;

public partial class Device
{
    public int DeviceId { get; set; }

    public int RoomId { get; set; }

    public string Name { get; set; } = null!;

    public string? Manufacturer { get; set; }

    public string? SerialNumber { get; set; }

    public string Type { get; set; } = null!;

    public IPAddress? Ip { get; set; }

    public string? MacAddress { get; set; }

    public DeviceStatus Status { get; set; }

    public string? MetaData { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual ICollection<DeviceCommand> DeviceCommands { get; set; } = new List<DeviceCommand>();

    public virtual ICollection<DeviceSchedule> DeviceSchedules { get; set; } = new List<DeviceSchedule>();

    public virtual ICollection<DeviceSetting> DeviceSettings { get; set; } = new List<DeviceSetting>();

    public virtual Room Room { get; set; } = null!;

    public virtual ICollection<SensorReading> SensorReadings { get; set; } = new List<SensorReading>();

    public virtual ICollection<DeviceStatusHistory> DeviceStatusHistories { get; set; } = new List<DeviceStatusHistory>();

    public virtual ICollection<UserDevicePermission> UserDevicePermissions { get; set; } = new List<UserDevicePermission>();
}
