using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace SmartHome.API.Models;

public partial class SmartHomeContext : DbContext
{
    public SmartHomeContext()
    {
    }

    public SmartHomeContext(DbContextOptions<SmartHomeContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Device> Devices { get; set; }

    public virtual DbSet<DeviceCommand> DeviceCommands { get; set; }

    public virtual DbSet<DeviceSchedule> DeviceSchedules { get; set; }

    public virtual DbSet<DeviceSetting> DeviceSettings { get; set; }

    public virtual DbSet<House> Houses { get; set; }

    public virtual DbSet<HouseUser> HouseUsers { get; set; }

    public virtual DbSet<ScenarioGroup> ScenarioGroups { get; set; }

    public virtual DbSet<ScenarioGroupSchedule> ScenarioGroupSchedules { get; set; }

    public virtual DbSet<Log> Logs { get; set; }

    public virtual DbSet<Room> Rooms { get; set; }

    public virtual DbSet<SensorReading> SensorReadings { get; set; }

    public virtual DbSet<DeviceStatusHistory> DeviceStatusHistories { get; set; }

    public virtual DbSet<User> Users { get; set; }

    public virtual DbSet<UserDevicePermission> UserDevicePermissions { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        // Конфигурация перенесена в Program.cs и appsettings.json
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Убираем .HasPostgresEnum, так как мы переходим на хранение enum как string для надежности
        // modelBuilder
        //    .HasPostgresEnum<CommandStatus>("command_status")
        //    .HasPostgresEnum<DeviceStatus>("device_status")
        //    .HasPostgresEnum<PermissionLevel>("permission_level");

        modelBuilder.Entity<Device>(entity =>
        {
            entity.HasKey(e => e.DeviceId).HasName("devices_pkey");

            entity.ToTable("devices");
            // ... индексы ...
            entity.HasIndex(e => e.RoomId, "idx_devices_room_id");
            entity.HasIndex(e => e.Type, "idx_devices_type");

            entity.Property(e => e.DeviceId).HasColumnName("device_id");
            // ...
            entity.Property(e => e.Status)
                .HasColumnName("status")
                .HasConversion<string>(); // ЯВНО указываем конвертацию в строку

            // ... остальное ...
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                //.ValueGeneratedOnAdd() // Removed
                .HasColumnType("timestamp without time zone")
                .HasColumnName("created_at");
            entity.Property(e => e.Ip)
                .HasColumnName("ip");
                //.HasColumnType("inet"); // Npgsql должен сам понять, но можно раскомментировать если что
            entity.Property(e => e.MacAddress)
                .HasMaxLength(17)
                .HasColumnName("mac_address");
            entity.Property(e => e.Status)
                .HasColumnName("status")
                .HasConversion<string>(); // ЯВНО указываем конвертацию в строку
            entity.Property(e => e.Manufacturer)
                .HasMaxLength(100)
                .HasColumnName("manufacturer");
            entity.Property(e => e.MetaData)
                .HasDefaultValueSql("'{}'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("meta_data");
            entity.Property(e => e.Name)
                .HasMaxLength(100)
                .HasColumnName("name");
            entity.Property(e => e.RoomId).HasColumnName("room_id");
            entity.Property(e => e.HardwareDeviceId)
                .HasMaxLength(255)
                .HasColumnName("serial_number");
            entity.Property(e => e.Type)
                .HasMaxLength(50)
                .HasColumnName("type");

            entity.HasOne(d => d.Room).WithMany(p => p.Devices)
                .HasForeignKey(d => d.RoomId)
                .HasConstraintName("fk_devices_room");
        });

        modelBuilder.Entity<DeviceCommand>(entity =>
        {
            entity.HasKey(e => e.CommandId).HasName("device_commands_pkey");

            entity.ToTable("device_commands");

            entity.Property(e => e.CommandId).HasColumnName("command_id");
            entity.Property(e => e.CommandType)
                .HasMaxLength(100)
                .HasColumnName("command_type");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("created_at");
            entity.Property(e => e.DeviceId).HasColumnName("device_id");
            entity.Property(e => e.ErrorMessage).HasColumnName("error_message");
            entity.Property(e => e.ExecutedAt)
                .HasColumnType("timestamp without time zone")
                .HasColumnName("executed_at");
            entity.Property(e => e.Payload)
                .HasColumnType("jsonb")
                .HasColumnName("payload");
            entity.Property(e => e.Status)
                .HasDefaultValueSql("'pending'") // Убрали ::command_status, так как теперь это varchar
                .HasColumnName("status")
                .HasConversion<string>(); // И для команд тоже
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.Device).WithMany(p => p.DeviceCommands)
                .HasForeignKey(d => d.DeviceId)
                .HasConstraintName("fk_commands_device");

            entity.HasOne(d => d.User).WithMany(p => p.DeviceCommands)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_commands_user");
        });

        modelBuilder.Entity<DeviceSchedule>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("device_schedules_pkey");

            entity.ToTable("device_schedules");

            entity.Property(e => e.Id).HasColumnName("schedule_id");
            entity.Property(e => e.DeviceId).HasColumnName("device_id");
            entity.Property(e => e.Time).HasColumnName("time").HasColumnType("time");
            entity.Property(e => e.DaysOfWeek).HasMaxLength(50).HasColumnName("days_of_week");
            entity.Property(e => e.ActionOn).HasColumnName("action_on");
            entity.Property(e => e.Action).HasMaxLength(50).HasColumnName("action");
            entity.Property(e => e.IsEnabled).HasColumnName("is_enabled").HasDefaultValue(true);
            entity.Property(e => e.LastTriggeredAt).HasColumnName("last_triggered_at");

            entity.HasOne(d => d.Device).WithMany(p => p.DeviceSchedules)
                .HasForeignKey(d => d.DeviceId)
                .HasConstraintName("fk_schedules_device")
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DeviceSetting>(entity =>
        {
            entity.HasKey(e => e.SettingId).HasName("device_settings_pkey");

            entity.ToTable("device_settings");

            entity.HasIndex(e => e.DeviceId, "idx_device_settings_device_id");

            entity.Property(e => e.SettingId).HasColumnName("setting_id");
            entity.Property(e => e.DeviceId).HasColumnName("device_id");
            entity.Property(e => e.Settings)
                .HasDefaultValueSql("'{}'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("settings");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Device).WithMany(p => p.DeviceSettings)
                .HasForeignKey(d => d.DeviceId)
                .HasConstraintName("fk_device_settings_device");
        });

        modelBuilder.Entity<House>(entity =>
        {
            entity.HasKey(e => e.HouseId).HasName("houses_pkey");

            entity.ToTable("houses");

            entity.Property(e => e.HouseId).HasColumnName("house_id");
            entity.Property(e => e.Address)
                .HasMaxLength(255)
                .HasColumnName("address");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                //.ValueGeneratedOnAdd() // Removed
                .HasColumnType("timestamp without time zone")
                .HasColumnName("created_at");
            entity.Property(e => e.OwnerId).HasColumnName("owner_id");
            entity.Property(e => e.MinTemp).HasColumnName("min_temp").HasColumnType("decimal(5,2)");
            entity.Property(e => e.MaxTemp).HasColumnName("max_temp").HasColumnType("decimal(5,2)");
            entity.Property(e => e.UseTempRange).HasColumnName("use_temp_range").HasDefaultValue(false);
            entity.Property(e => e.MinHumidity).HasColumnName("min_humidity").HasColumnType("decimal(5,2)");
            entity.Property(e => e.MaxHumidity).HasColumnName("max_humidity").HasColumnType("decimal(5,2)");
            entity.Property(e => e.MaxCo2).HasColumnName("max_co2").HasColumnType("decimal(8,2)");
            entity.Property(e => e.OutdoorTemp).HasColumnName("outdoor_temp").HasColumnType("decimal(5,2)");
            entity.Property(e => e.OutdoorHumidity).HasColumnName("outdoor_humidity").HasColumnType("decimal(5,2)");
            entity.Property(e => e.OutdoorCo2).HasColumnName("outdoor_co2").HasColumnType("decimal(8,2)");

            entity.HasOne(d => d.Owner).WithMany()
                .HasForeignKey(d => d.OwnerId)
                .HasConstraintName("fk_houses_owner")
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Log>(entity =>
        {
            entity.HasKey(e => e.LogId).HasName("logs_pkey");

            entity.ToTable("logs");

            entity.Property(e => e.LogId).HasColumnName("log_id");
            entity.Property(e => e.EventType)
                .HasMaxLength(50)
                .HasColumnName("event_type");
            entity.Property(e => e.IpAddress).HasColumnName("ip_address");
            entity.Property(e => e.Message).HasColumnName("message");
            entity.Property(e => e.Timestamp)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("timestamp");
            entity.Property(e => e.UserId).HasColumnName("user_id");
        });

        modelBuilder.Entity<Room>(entity =>
        {
            entity.HasKey(e => e.RoomId).HasName("rooms_pkey");

            entity.ToTable("rooms");

            entity.HasIndex(e => e.HouseId, "idx_rooms_house_id");

            entity.Property(e => e.RoomId).HasColumnName("room_id");
            entity.Property(e => e.Floor)
                .HasDefaultValue(1)
                .HasColumnName("floor");
            entity.Property(e => e.HouseId).HasColumnName("house_id");
            entity.Property(e => e.RoomName)
                .HasMaxLength(100)
                .HasColumnName("room_name");

            entity.HasOne(d => d.House).WithMany(p => p.Rooms)
                .HasForeignKey(d => d.HouseId)
                .HasConstraintName("fk_rooms_house");
        });

        modelBuilder.Entity<SensorReading>(entity =>
        {
            entity.HasKey(e => e.ReadingId).HasName("sensor_readings_pkey");

            entity.ToTable("sensor_readings");

            entity.HasIndex(e => new { e.DeviceId, e.RecordedAt }, "idx_readings_device_time").IsDescending(false, true);

            entity.Property(e => e.ReadingId).HasColumnName("reading_id");
            entity.Property(e => e.DeviceId).HasColumnName("device_id");
            entity.Property(e => e.ReadingType)
                .HasMaxLength(50)
                .HasColumnName("reading_type");
            entity.Property(e => e.RecordedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("recorded_at");
            entity.Property(e => e.Unit)
                .HasMaxLength(20)
                .HasColumnName("unit");
            entity.Property(e => e.Value)
                .HasPrecision(10, 2)
                .HasColumnName("value");

            entity.HasOne(d => d.Device).WithMany(p => p.SensorReadings)
                .HasForeignKey(d => d.DeviceId)
                .HasConstraintName("fk_readings_device");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.UserId).HasName("users_pkey");

            entity.ToTable("users");

            entity.HasIndex(e => e.Email, "users_email_key").IsUnique();

            entity.HasIndex(e => e.Username, "users_username_key").IsUnique();

            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("created_at");
            entity.Property(e => e.Email)
                .HasMaxLength(100)
                .HasColumnName("email");
            entity.Property(e => e.FullName)
                .HasMaxLength(100)
                .HasColumnName("full_name");
            entity.Property(e => e.AvatarUrl)
                .HasMaxLength(255)
                .HasColumnName("avatar_url");
            entity.Property(e => e.IsBlocked)
                .HasDefaultValue(false)
                .HasColumnName("is_blocked");
            entity.Property(e => e.PasswordHash)
                .HasMaxLength(255)
                .HasColumnName("password_hash");
            entity.Property(e => e.Role)
                .HasMaxLength(50)
                .HasDefaultValueSql("'user'::character varying")
                .HasColumnName("role");
            entity.Property(e => e.Username)
                .HasMaxLength(50)
                .HasColumnName("username");
        });

        modelBuilder.Entity<UserDevicePermission>(entity =>
        {
            entity.HasKey(e => e.PermissionId).HasName("user_device_permissions_pkey");

            entity.ToTable("user_device_permissions");

            entity.HasIndex(e => new { e.UserId, e.DeviceId }, "unique_user_device").IsUnique();

            entity.Property(e => e.PermissionId).HasColumnName("permission_id");
            entity.Property(e => e.DeviceId).HasColumnName("device_id");
            entity.Property(e => e.PermissionLevel)
                .HasDefaultValueSql("'viewer'") // Убрали ::permission_level
                .HasColumnName("permission_level")
                .HasConversion<string>(); // И для прав доступа
            entity.Property(e => e.GrantedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("granted_at");
            entity.Property(e => e.GrantedBy).HasColumnName("granted_by");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.Device).WithMany(p => p.UserDevicePermissions)
                .HasForeignKey(d => d.DeviceId)
                .HasConstraintName("fk_perms_device");

            entity.HasOne(d => d.User).WithMany(p => p.UserDevicePermissions)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("fk_perms_user");
        });

        modelBuilder.Entity<DeviceStatusHistory>(entity =>
        {
            entity.HasKey(e => e.HistoryId).HasName("device_status_history_pkey");

            entity.ToTable("device_status_history");

            entity.HasIndex(e => new { e.DeviceId, e.Timestamp }, "idx_status_history_device_time").IsDescending(false, true);

            entity.Property(e => e.HistoryId).HasColumnName("history_id");
            entity.Property(e => e.DeviceId).HasColumnName("device_id");
            entity.Property(e => e.Status)
                .HasColumnName("status")
                .HasConversion<string>();
            entity.Property(e => e.Timestamp)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("timestamp");
            entity.Property(e => e.ChangedByUserId).HasColumnName("changed_by_user_id");
            entity.Property(e => e.ChangeReason)
                .HasMaxLength(50)
                .HasColumnName("change_reason");

            entity.HasOne(d => d.Device).WithMany(p => p.DeviceStatusHistories)
                .HasForeignKey(d => d.DeviceId)
                .HasConstraintName("fk_status_history_device")
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(d => d.ChangedByUser).WithMany()
                .HasForeignKey(d => d.ChangedByUserId)
                .HasConstraintName("fk_status_history_user")
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ScenarioGroup>(entity =>
        {
            entity.HasKey(e => e.GroupId).HasName("scenario_groups_pkey");

            entity.ToTable("scenario_groups");

            entity.HasIndex(e => e.HouseId, "idx_scenario_groups_house_id");

            entity.Property(e => e.GroupId).HasColumnName("group_id");
            entity.Property(e => e.HouseId).HasColumnName("house_id");
            entity.Property(e => e.Name).HasMaxLength(20).HasColumnName("name");
            entity.Property(e => e.Description).HasMaxLength(100).HasColumnName("description");
            entity.Property(e => e.CommandsJson)
                .HasColumnType("jsonb")
                .HasColumnName("commands")
                .HasDefaultValueSql("'[]'::jsonb");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.House).WithMany(p => p.ScenarioGroups)
                .HasForeignKey(d => d.HouseId)
                .HasConstraintName("fk_scenario_groups_house")
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ScenarioGroupSchedule>(entity =>
        {
            entity.HasKey(e => e.ScheduleId).HasName("scenario_group_schedules_pkey");
            entity.ToTable("scenario_group_schedules");
            entity.HasIndex(e => e.GroupId, "idx_scenario_group_schedules_group");
            entity.Property(e => e.ScheduleId).HasColumnName("schedule_id");
            entity.Property(e => e.GroupId).HasColumnName("group_id");
            entity.Property(e => e.Time).HasColumnName("time").HasColumnType("time");
            entity.Property(e => e.DaysOfWeek).HasMaxLength(50).HasColumnName("days_of_week");
            entity.Property(e => e.IsEnabled).HasColumnName("is_enabled").HasDefaultValue(true);
            entity.Property(e => e.LastTriggeredAt)
                .HasColumnType("timestamp without time zone")
                .HasColumnName("last_triggered_at");
            entity.HasOne(d => d.Group).WithMany(p => p.Schedules)
                .HasForeignKey(d => d.GroupId)
                .HasConstraintName("fk_scenario_group_schedules_group")
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<HouseUser>(entity =>
        {
            entity.HasKey(e => new { e.HouseId, e.UserId }).HasName("house_users_pkey");

            entity.ToTable("house_users");

            entity.Property(e => e.HouseId).HasColumnName("house_id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.Role).HasColumnName("role").HasDefaultValue("member");
            entity.Property(e => e.JoinedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                //.ValueGeneratedOnAdd() // Removed
                .HasColumnType("timestamp without time zone")
                .HasColumnName("joined_at");

            entity.HasOne(d => d.House).WithMany(p => p.HouseUsers)
                .HasForeignKey(d => d.HouseId)
                .HasConstraintName("fk_house_users_house");

            entity.HasOne(d => d.User).WithMany(p => p.HouseUsers)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("fk_house_users_user");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
