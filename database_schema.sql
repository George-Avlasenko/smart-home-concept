-- ============================================
-- ВИЗУАЛЬНАЯ СХЕМА БАЗЫ ДАННЫХ SmartHome
-- ============================================

-- users (PK: user_id)
-- ├── user_id (SERIAL) PK
-- ├── username (VARCHAR(50)) UK
-- ├── password_hash (VARCHAR(255))
-- ├── email (VARCHAR(100)) UK
-- ├── role (VARCHAR(50))
-- ├── is_blocked (BOOLEAN)
-- ├── full_name (VARCHAR(100))
-- ├── avatar_url (VARCHAR(255))
-- └── created_at (TIMESTAMP)
--     │
--     ├──> houses.owner_id (FK)
--     ├──> house_users.user_id (FK)
--     ├──> user_device_permissions.user_id (FK)
--     ├──> device_commands.user_id (FK)
--     └──> device_status_history.changed_by_user_id (FK)

-- houses (PK: house_id)
-- ├── house_id (SERIAL) PK
-- ├── address (VARCHAR(255))
-- ├── owner_id (INTEGER) FK -> users.user_id
-- └── created_at (TIMESTAMP)
--     │
--     ├──> house_users.house_id (FK)
--     └──> rooms.house_id (FK)

-- house_users (PK: house_id, user_id)
-- ├── house_id (INTEGER) PK,FK -> houses.house_id
-- ├── user_id (INTEGER) PK,FK -> users.user_id
-- ├── role (VARCHAR(20))
-- └── joined_at (TIMESTAMP)

-- rooms (PK: room_id)
-- ├── room_id (SERIAL) PK
-- ├── house_id (INTEGER) FK -> houses.house_id
-- ├── room_name (VARCHAR(100))
-- └── floor (INTEGER)
--     │
--     └──> devices.room_id (FK)

-- devices (PK: device_id)
-- ├── device_id (SERIAL) PK
-- ├── room_id (INTEGER) FK -> rooms.room_id
-- ├── name (VARCHAR(100))
-- ├── manufacturer (VARCHAR(100))
-- ├── serial_number (VARCHAR(100))
-- ├── type (VARCHAR(50))
-- ├── ip (INET)
-- ├── mac_address (VARCHAR(17))
-- ├── status (VARCHAR(50))
-- ├── meta_data (JSONB)
-- └── created_at (TIMESTAMP)
--     │
--     ├──> device_settings.device_id (FK)
--     ├──> user_device_permissions.device_id (FK)
--     ├──> device_schedules.device_id (FK)
--     ├──> device_commands.device_id (FK)
--     ├──> device_status_history.device_id (FK)
--     └──> sensor_readings.device_id (FK)

-- device_settings (PK: setting_id)
-- ├── setting_id (SERIAL) PK
-- ├── device_id (INTEGER) FK -> devices.device_id
-- ├── settings (JSONB)
-- └── updated_at (TIMESTAMP)

-- user_device_permissions (PK: permission_id)
-- ├── permission_id (SERIAL) PK
-- ├── user_id (INTEGER) FK -> users.user_id
-- ├── device_id (INTEGER) FK -> devices.device_id
-- ├── permission_level (VARCHAR(50))
-- ├── granted_by (INTEGER)
-- └── granted_at (TIMESTAMP)
--     │
--     └── UNIQUE(user_id, device_id)

-- device_schedules (PK: schedule_id)
-- ├── schedule_id (SERIAL) PK
-- ├── device_id (INTEGER) FK -> devices.device_id
-- ├── time (TIME)
-- ├── days_of_week (VARCHAR(50))
-- ├── action_on (BOOLEAN)
-- ├── action (VARCHAR(50))
-- └── is_enabled (BOOLEAN)

-- device_commands (PK: command_id)
-- ├── command_id (SERIAL) PK
-- ├── device_id (INTEGER) FK -> devices.device_id
-- ├── user_id (INTEGER) FK -> users.user_id
-- ├── command_type (VARCHAR(100))
-- ├── payload (JSONB)
-- ├── status (VARCHAR(50))
-- ├── executed_at (TIMESTAMP)
-- ├── error_message (TEXT)
-- └── created_at (TIMESTAMP)

-- device_status_history (PK: history_id)
-- ├── history_id (BIGSERIAL) PK
-- ├── device_id (INTEGER) FK -> devices.device_id
-- ├── status (VARCHAR(50))
-- ├── timestamp (TIMESTAMP)
-- ├── changed_by_user_id (INTEGER) FK -> users.user_id
-- └── change_reason (VARCHAR(50))

-- sensor_readings (PK: reading_id)
-- ├── reading_id (BIGSERIAL) PK
-- ├── device_id (INTEGER) FK -> devices.device_id
-- ├── reading_type (VARCHAR(50))
-- ├── value (DECIMAL(10,2))
-- ├── unit (VARCHAR(20))
-- └── recorded_at (TIMESTAMP)

-- logs (PK: log_id)
-- ├── log_id (SERIAL) PK
-- ├── user_id (INTEGER)
-- ├── event_type (VARCHAR(50))
-- ├── message (TEXT)
-- ├── ip_address (INET)
-- └── timestamp (TIMESTAMP)



