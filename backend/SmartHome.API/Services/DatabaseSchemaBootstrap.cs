using Microsoft.EntityFrameworkCore;
using SmartHome.API.Models;

namespace SmartHome.API.Services;

/// <summary>
/// Старые тома Postgres не подхватывают изменения create_database.sql — создаём недостающие объекты при старте.
/// </summary>
public static class DatabaseSchemaBootstrap
{
    public static async Task ApplyAsync(SmartHomeContext db, ILogger logger, CancellationToken ct = default)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync(
                """
                CREATE TABLE IF NOT EXISTS scenario_group_schedules (
                    schedule_id SERIAL PRIMARY KEY,
                    group_id INTEGER NOT NULL,
                    time TIME NOT NULL,
                    days_of_week VARCHAR(50) NOT NULL,
                    is_enabled BOOLEAN DEFAULT TRUE,
                    last_triggered_at TIMESTAMP,
                    CONSTRAINT fk_scenario_group_schedules_group FOREIGN KEY (group_id) REFERENCES scenario_groups(group_id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_scenario_group_schedules_group ON scenario_group_schedules(group_id);
                """,
                ct);

            await db.Database.ExecuteSqlRawAsync(
                """
                ALTER TABLE device_schedules ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMP;
                """,
                ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "DatabaseSchemaBootstrap: не удалось применить DDL (проверь права и наличие scenario_groups)");
        }
    }
}
