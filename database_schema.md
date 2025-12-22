# Схема базы данных SmartHome

## Полная схема всех связей

```
┌─────────────────────┐
│   users             │
│   PK: user_id       │
└──────────┬──────────┘
           │
           ├──────────────────────┬──────────────────────┬──────────────────────┬──────────────────────┐
           │                      │                      │                      │                      │
           │                      │                      │                      │                      │
           ▼                      ▼                      ▼                      ▼                      ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   houses           │  │   house_users       │  │user_device_         │  │device_commands     │  │device_status_       │
│   PK: house_id     │  │   PK: house_id,     │  │permissions          │  │PK: command_id      │  │history              │
│   FK: owner_id ────┼──┼──► user_id          │  │PK: permission_id    │  │FK: device_id ───────┼──┼──► device_id         │
└──────────┬─────────┘  │   FK: house_id ─────┘  │FK: user_id ──────────┼──┼──► user_id          │  │FK: changed_by_      │
           │            │   FK: user_id ──────┐  │FK: device_id ────────┼──┼──► device_id ───────┼──┼──► user_id           │
           │            └─────────────────────┘  │granted_by (no FK)    │  └─────────────────────┘  └─────────────────────┘
           │                      │              └──────────────────────┘
           │                      │
           │                      │
           ▼                      │
┌─────────────────────┐          │
│   rooms             │          │
│   PK: room_id       │          │
│   FK: house_id ─────┘          │
└──────────┬───────────┘          │
           │                      │
           │                      │
           ▼                      │
┌─────────────────────┐          │
│   devices          │          │
│   PK: device_id    │          │
│   FK: room_id ─────┘          │
└──────────┬───────────┘          │
           │                      │
           ├──────────┬───────────┼──────────┬──────────┬──────────┬──────────┐
           │          │           │          │          │          │          │
           ▼          ▼           ▼          ▼          ▼          ▼          ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
    │device_   │ │user_     │ │device_   │ │device_   │ │device_   │ │sensor_   │
    │settings  │ │device_   │ │schedules │ │commands  │ │status_   │ │readings  │
    │PK:       │ │perms     │ │PK:       │ │PK:       │ │history   │ │PK:       │
    │setting_id│ │PK:       │ │schedule_ │ │command_  │ │PK:       │ │reading_  │
    │FK:       │ │permission│ │id        │ │id        │ │history_  │ │id        │
    │device_id │ │_id       │ │FK:       │ │FK:       │ │id        │ │FK:       │
    └──────────┘ │FK:       │ │device_id │ │device_id │ │FK:       │ │device_id │
                 │user_id ──┼─┼──────────┘ │FK:       │ │device_id │ └──────────┘
                 │FK:       │ │            │user_id ──┼─┼──────────┘
                 │device_id │ │            └──────────┘ │FK:       │
                 └──────────┘ │                         │changed_  │
                              │                         │by_user_  │
                              │                         │id ────────┘
                              │                         └──────────┘
                              │
                              │
┌─────────────────────┐       │
│   logs             │       │
│   PK: log_id       │       │
│   user_id ─────────┼───────┘
└─────────────────────┘       (reference to users.user_id, no FK constraint)
```

## Детальная схема таблиц со всеми связями

### 1. users
```
┌─────────────────────────────────────────┐
│ users (PK: user_id)                     │
├─────────────────────────────────────────┤
│ • user_id (SERIAL) PK                   │
│ • username (VARCHAR(50)) UK             │
│ • password_hash (VARCHAR(255))          │
│ • email (VARCHAR(100)) UK                │
│ • role (VARCHAR(50))                     │
│ • is_blocked (BOOLEAN)                  │
│ • full_name (VARCHAR(100))              │
│ • avatar_url (VARCHAR(255))             │
│ • created_at (TIMESTAMP)                │
└─────────────────────────────────────────┘
   │
   ├───► houses.owner_id (FK)
   ├───► house_users.user_id (FK)
   ├───► user_device_permissions.user_id (FK)
   ├───► device_commands.user_id (FK)
   ├───► device_status_history.changed_by_user_id (FK)
   └───► logs.user_id (reference, no FK)
```

### 2. houses
```
┌─────────────────────────────────────────┐
│ houses (PK: house_id)                   │
├─────────────────────────────────────────┤
│ • house_id (SERIAL) PK                  │
│ • address (VARCHAR(255))                │
│ • owner_id (INTEGER) FK ──► users.user_id│
│ • created_at (TIMESTAMP)                │
└─────────────────────────────────────────┘
   │
   ├───► house_users.house_id (FK)
   └───► rooms.house_id (FK)
```

### 3. house_users
```
┌─────────────────────────────────────────┐
│ house_users (PK: house_id, user_id)     │
├─────────────────────────────────────────┤
│ • house_id (INTEGER) PK,FK ──► houses.house_id│
│ • user_id (INTEGER) PK,FK ──► users.user_id│
│ • role (VARCHAR(20))                    │
│ • joined_at (TIMESTAMP)                 │
└─────────────────────────────────────────┘
```

### 4. rooms
```
┌─────────────────────────────────────────┐
│ rooms (PK: room_id)                     │
├─────────────────────────────────────────┤
│ • room_id (SERIAL) PK                   │
│ • house_id (INTEGER) FK ──► houses.house_id│
│ • room_name (VARCHAR(100))               │
│ • floor (INTEGER)                        │
└─────────────────────────────────────────┘
   │
   └───► devices.room_id (FK)
```

### 5. devices
```
┌─────────────────────────────────────────┐
│ devices (PK: device_id)                 │
├─────────────────────────────────────────┤
│ • device_id (SERIAL) PK                 │
│ • room_id (INTEGER) FK ──► rooms.room_id│
│ • name (VARCHAR(100))                   │
│ • manufacturer (VARCHAR(100))           │
│ • serial_number (VARCHAR(100))          │
│ • type (VARCHAR(50))                     │
│ • ip (INET)                             │
│ • mac_address (VARCHAR(17))             │
│ • status (VARCHAR(50))                  │
│ • meta_data (JSONB)                     │
│ • created_at (TIMESTAMP)               │
└─────────────────────────────────────────┘
   │
   ├───► device_settings.device_id (FK)
   ├───► user_device_permissions.device_id (FK)
   ├───► device_schedules.device_id (FK)
   ├───► device_commands.device_id (FK)
   ├───► device_status_history.device_id (FK)
   └───► sensor_readings.device_id (FK)
```

### 6. device_settings
```
┌─────────────────────────────────────────┐
│ device_settings (PK: setting_id)       │
├─────────────────────────────────────────┤
│ • setting_id (SERIAL) PK                │
│ • device_id (INTEGER) FK ──► devices.device_id│
│ • settings (JSONB)                      │
│ • updated_at (TIMESTAMP)                │
└─────────────────────────────────────────┘
```

### 7. user_device_permissions
```
┌─────────────────────────────────────────┐
│ user_device_permissions (PK: permission_id)│
├─────────────────────────────────────────┤
│ • permission_id (SERIAL) PK             │
│ • user_id (INTEGER) FK ──► users.user_id│
│ • device_id (INTEGER) FK ──► devices.device_id│
│ • permission_level (VARCHAR(50))        │
│ • granted_by (INTEGER) ──► users.user_id (reference, no FK)│
│ • granted_at (TIMESTAMP)                │
└─────────────────────────────────────────┘
```

### 8. device_schedules
```
┌─────────────────────────────────────────┐
│ device_schedules (PK: schedule_id)      │
├─────────────────────────────────────────┤
│ • schedule_id (SERIAL) PK              │
│ • device_id (INTEGER) FK ──► devices.device_id│
│ • time (TIME)                           │
│ • days_of_week (VARCHAR(50))            │
│ • action_on (BOOLEAN)                   │
│ • action (VARCHAR(50))                  │
│ • is_enabled (BOOLEAN)                  │
└─────────────────────────────────────────┘
```

### 9. device_commands
```
┌─────────────────────────────────────────┐
│ device_commands (PK: command_id)        │
├─────────────────────────────────────────┤
│ • command_id (SERIAL) PK                │
│ • device_id (INTEGER) FK ──► devices.device_id│
│ • user_id (INTEGER) FK ──► users.user_id│
│ • command_type (VARCHAR(100))           │
│ • payload (JSONB)                        │
│ • status (VARCHAR(50))                  │
│ • executed_at (TIMESTAMP)                │
│ • error_message (TEXT)                  │
│ • created_at (TIMESTAMP)                │
└─────────────────────────────────────────┘
```

### 10. device_status_history
```
┌─────────────────────────────────────────┐
│ device_status_history (PK: history_id)   │
├─────────────────────────────────────────┤
│ • history_id (BIGSERIAL) PK             │
│ • device_id (INTEGER) FK ──► devices.device_id│
│ • status (VARCHAR(50))                 │
│ • timestamp (TIMESTAMP)                 │
│ • changed_by_user_id (INTEGER) FK ──► users.user_id│
│ • change_reason (VARCHAR(50))           │
└─────────────────────────────────────────┘
```

### 11. sensor_readings
```
┌─────────────────────────────────────────┐
│ sensor_readings (PK: reading_id)        │
├─────────────────────────────────────────┤
│ • reading_id (BIGSERIAL) PK             │
│ • device_id (INTEGER) FK ──► devices.device_id│
│ • reading_type (VARCHAR(50))            │
│ • value (DECIMAL(10,2))                 │
│ • unit (VARCHAR(20))                     │
│ • recorded_at (TIMESTAMP)              │
└─────────────────────────────────────────┘
```

### 12. logs
```
┌─────────────────────────────────────────┐
│ logs (PK: log_id)                       │
├─────────────────────────────────────────┤
│ • log_id (SERIAL) PK                    │
│ • user_id (INTEGER) ──► users.user_id (reference, no FK)│
│ • event_type (VARCHAR(50))              │
│ • message (TEXT)                         │
│ • ip_address (INET)                     │
│ • timestamp (TIMESTAMP)                 │
└─────────────────────────────────────────┘
```

## Полный список всех связей (Foreign Keys)

### От users.user_id:
```
users.user_id
    │
    ├───► houses.owner_id (FK constraint)
    ├───► house_users.user_id (FK constraint)
    ├───► user_device_permissions.user_id (FK constraint)
    ├───► device_commands.user_id (FK constraint, nullable)
    ├───► device_status_history.changed_by_user_id (FK constraint, nullable)
    ├───► logs.user_id (reference, NO FK constraint)
    └───► user_device_permissions.granted_by (reference, NO FK constraint)
```

### От houses.house_id:
```
houses.house_id
    │
    ├───► house_users.house_id (FK constraint)
    └───► rooms.house_id (FK constraint)
```

### От rooms.room_id:
```
rooms.room_id
    │
    └───► devices.room_id (FK constraint)
```

### От devices.device_id:
```
devices.device_id
    │
    ├───► device_settings.device_id (FK constraint)
    ├───► user_device_permissions.device_id (FK constraint)
    ├───► device_schedules.device_id (FK constraint)
    ├───► device_commands.device_id (FK constraint)
    ├───► device_status_history.device_id (FK constraint)
    └───► sensor_readings.device_id (FK constraint)
```

## Итого связей:
- **С FK constraint**: 15 связей
- **Без FK constraint (только reference)**: 2 связи
  - `logs.user_id` → `users.user_id`
  - `user_device_permissions.granted_by` → `users.user_id`
