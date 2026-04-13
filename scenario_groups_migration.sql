-- Выполните вручную в PostgreSQL, если база уже создана без таблицы scenario_groups (том docker не пересоздавался).
CREATE TABLE IF NOT EXISTS scenario_groups (
    group_id SERIAL PRIMARY KEY,
    house_id INTEGER NOT NULL,
    name VARCHAR(20) NOT NULL,
    description VARCHAR(100) NOT NULL DEFAULT '',
    commands JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_scenario_groups_house FOREIGN KEY (house_id) REFERENCES houses(house_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_scenario_groups_house_id ON scenario_groups(house_id);

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

-- Старая БД (колонки 100/500)? Одна команда из корня проекта:
-- docker exec -i smarthome_db psql -U admin -d smarthome -c "UPDATE scenario_groups SET name = left(name,20) WHERE length(name)>20; UPDATE scenario_groups SET description = left(description,100) WHERE length(description)>100; ALTER TABLE scenario_groups ALTER COLUMN name TYPE VARCHAR(20); ALTER TABLE scenario_groups ALTER COLUMN description TYPE VARCHAR(100);"
