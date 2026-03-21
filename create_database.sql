-- ============================================
-- Создание базы данных для системы умного дома
-- PostgreSQL (адаптировано под ТЗ: ASP.NET Core + React)
-- ============================================

-- Удаление таблиц и типов ENUM если существуют (каскадно)
DROP TABLE IF EXISTS sensor_readings CASCADE;
DROP TABLE IF EXISTS device_status_history CASCADE;
DROP TABLE IF EXISTS device_schedules CASCADE;
DROP TABLE IF EXISTS user_device_permissions CASCADE;
DROP TABLE IF EXISTS device_commands CASCADE;
DROP TABLE IF EXISTS logs CASCADE;
DROP TABLE IF EXISTS device_settings CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS houses CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS device_status;
DROP TYPE IF EXISTS command_status;
DROP TYPE IF EXISTS permission_level;

-- ============================================
-- ENUM типы заменены на VARCHAR для надежности и простоты работы с EF Core
-- ============================================
-- CREATE TYPE device_status AS ENUM ('inactive', 'active', 'fault', 'offline');
-- CREATE TYPE command_status AS ENUM ('pending', 'sent', 'executed', 'failed');
-- CREATE TYPE permission_level AS ENUM ('viewer', 'user', 'admin'); 

-- ============================================
-- Таблица: users (пользователи)
-- ============================================
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL, -- Хранить хэш (напр. BCrypt)
    email VARCHAR(100) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'user', -- 'admin' или 'user'
    is_blocked BOOLEAN DEFAULT FALSE,         -- Требование ТЗ: блокировка
    full_name VARCHAR(100),
    avatar_url VARCHAR(255),                  -- URL аватара
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Таблица: houses (дома)
-- ============================================
CREATE TABLE houses (
    house_id SERIAL PRIMARY KEY,
    address VARCHAR(255) NOT NULL,
    owner_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Диапазоны климата (один на дом) и текущие уличные показания (для эмуляции)
    min_temp DECIMAL(5,2),
    max_temp DECIMAL(5,2),
    use_temp_range BOOLEAN DEFAULT FALSE,
    min_humidity DECIMAL(5,2),
    max_humidity DECIMAL(5,2),
    max_co2 DECIMAL(8,2),
    outdoor_temp DECIMAL(5,2),
    outdoor_humidity DECIMAL(5,2),
    outdoor_co2 DECIMAL(8,2),

    CONSTRAINT fk_houses_owner 
        FOREIGN KEY (owner_id) 
        REFERENCES users(user_id) 
        ON DELETE CASCADE
);
CREATE INDEX idx_houses_owner_id ON houses(owner_id);

-- ============================================
-- Таблица: house_users (жильцы дома)
-- ============================================
CREATE TABLE house_users (
    house_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role VARCHAR(20) DEFAULT 'member', -- 'member'
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (house_id, user_id),
    CONSTRAINT fk_house_users_house FOREIGN KEY (house_id) REFERENCES houses(house_id) ON DELETE CASCADE,
    CONSTRAINT fk_house_users_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ============================================
-- Таблица: rooms (комнаты)
-- ============================================
CREATE TABLE rooms (
    room_id SERIAL PRIMARY KEY,
    house_id INTEGER NOT NULL,
    room_name VARCHAR(100) NOT NULL,
    floor INTEGER DEFAULT 1,
    
    CONSTRAINT fk_rooms_house 
        FOREIGN KEY (house_id) 
        REFERENCES houses(house_id) 
        ON DELETE CASCADE
);
CREATE INDEX idx_rooms_house_id ON rooms(house_id);

-- ============================================
-- Таблица: devices (устройства)
-- ============================================
CREATE TABLE devices (
    device_id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(100),
    serial_number VARCHAR(100),
    type VARCHAR(50) NOT NULL, -- 'light', 'thermostat', 'camera', 'sensor'
    ip INET,                   -- IP адрес для связи
    mac_address VARCHAR(17),   -- MAC адрес (полезно для идентификации)
    status VARCHAR(50) DEFAULT 'inactive', -- device_status
    meta_data JSONB DEFAULT '{}', -- Доп. технические данные (версия прошивки и т.д.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_devices_room 
        FOREIGN KEY (room_id) 
        REFERENCES rooms(room_id) 
        ON DELETE CASCADE
);
CREATE INDEX idx_devices_room_id ON devices(room_id);
CREATE INDEX idx_devices_type ON devices(type);

-- ============================================
-- Таблица: device_settings (настройки параметров работы)
-- Требование ТЗ: "настройка параметров работы"
-- ============================================
CREATE TABLE device_settings (
    setting_id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}', -- Гибкие настройки (яркость: 50, цвет: #FFF)
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_device_settings_device 
        FOREIGN KEY (device_id) 
        REFERENCES devices(device_id) 
        ON DELETE CASCADE
);
CREATE INDEX idx_device_settings_device_id ON device_settings(device_id);

-- Триггер для авто-обновления времени настроек
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_device_settings_time
BEFORE UPDATE ON device_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Таблица: user_device_permissions (права доступа)
-- Требование ТЗ: "распределение прав доступа", "управление в пределах прав"
-- ============================================
CREATE TABLE user_device_permissions (
    permission_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    device_id INTEGER NOT NULL,
    permission_level VARCHAR(50) NOT NULL DEFAULT 'viewer', -- permission_level
    granted_by INTEGER, -- Кто выдал права (ID админа)
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_perms_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_perms_device FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    CONSTRAINT unique_user_device UNIQUE (user_id, device_id) -- Одно правило на пару юзер-девайс
);

-- ============================================
-- Таблица: device_schedules (графики работы)
-- Требование ТЗ: "настройка графиков включения/выключения"
-- ============================================
CREATE TABLE device_schedules (
    schedule_id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL,
    time TIME NOT NULL,
    days_of_week VARCHAR(50) NOT NULL,
    action_on BOOLEAN NOT NULL,
    action VARCHAR(50), -- Для устройств с несколькими действиями (окна: "closed", "tilted", "opened")
    is_enabled BOOLEAN DEFAULT TRUE,

    CONSTRAINT fk_schedules_device FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

-- ============================================
-- Таблица: device_commands (история команд)
-- Требование ТЗ: "управление устройствами" (асинхронная очередь)
-- ============================================
CREATE TABLE device_commands (
    command_id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL,
    user_id INTEGER, -- Может быть NULL, если команда от системы/расписания
    command_type VARCHAR(100) NOT NULL, -- 'turn_on', 'set_temp', etc.
    payload JSONB,                      -- Параметры команды
    status VARCHAR(50) DEFAULT 'pending', -- command_status
    executed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_commands_device FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    CONSTRAINT fk_commands_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- ============================================
-- Таблица: device_status_history (история изменений статусов устройств)
-- ============================================
CREATE TABLE device_status_history (
    history_id BIGSERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by_user_id INTEGER,
    change_reason VARCHAR(50),
    
    CONSTRAINT fk_status_history_device FOREIGN KEY (device_id) REFERENCES devices (device_id) ON DELETE CASCADE,
    CONSTRAINT fk_status_history_user FOREIGN KEY (changed_by_user_id) REFERENCES users (user_id) ON DELETE SET NULL
);
CREATE INDEX idx_status_history_device_time ON device_status_history (device_id, timestamp DESC);

-- ============================================
-- Таблица: sensor_readings (статистика датчиков)
-- Требование ТЗ: "просмотр статистики датчиков"
-- ============================================
CREATE TABLE sensor_readings (
    reading_id BIGSERIAL PRIMARY KEY, -- BIGSERIAL т.к. записей будет очень много
    device_id INTEGER NOT NULL,
    reading_type VARCHAR(50) NOT NULL, -- 'temperature', 'humidity', 'power_usage'
    value DECIMAL(10, 2) NOT NULL,     -- Значение (напр. 22.50)
    unit VARCHAR(20),                  -- Единица измерения ('C', '%', 'kW')
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_readings_device FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);
-- Индекс для быстрого построения графиков по времени
CREATE INDEX idx_readings_device_time ON sensor_readings(device_id, recorded_at DESC);

-- ============================================
-- Таблица: logs (общий журнал событий безопасности)
-- ============================================
CREATE TABLE logs (
    log_id SERIAL PRIMARY KEY,
    user_id INTEGER,
    event_type VARCHAR(50) NOT NULL, -- 'login', 'auth_failed', 'permission_change'
    message TEXT,
    ip_address INET,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT 'База данных успешно сконфигурирована!' AS message;
