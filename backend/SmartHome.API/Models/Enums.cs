namespace SmartHome.API.Models;

public enum DeviceStatus
{
    inactive,
    active,
    fault,
    offline
}

public enum CommandStatus
{
    pending,
    sent,
    executed,
    failed
}

public enum PermissionLevel
{
    viewer,
    user,
    admin
}

