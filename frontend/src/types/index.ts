export interface User {
  userId: number;
  username: string;
  role: string;
}

export interface SystemUser {
  userId: number;
  username: string;
  email: string;
  role: string;
  fullName?: string;
  isBlocked: boolean;
  isActive?: boolean; // сейчас в подписке SSE (активен в приложении)
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  username: string;
  role: string;
  userId: number;
}

export enum DeviceStatus {
  Inactive = 'inactive',
  Active = 'active',
  Fault = 'fault',
  Offline = 'offline'
}

/** Модель из каталога GET /devices/catalog */
export interface SupportedDeviceProduct {
  sku: string;
  displayName: string;
  manufacturer: string;
  type: string;
  suggestedName: string;
  category: string;
  features?: string[];
  tuyaProductLabel?: string;
}

export interface Device {
  deviceId: number;
  roomId: number;
  roomName: string;
  name: string;
  manufacturer?: string;
  /** SKU из каталога (дублируется в settings.catalogSku для старых записей). */
  productSku?: string;
  /** Уникальный идентификатор экземпляра устройства. */
  hardwareDeviceId?: string;
  /** MAC-адрес (с бэкенда). */
  macAddress?: string;
  type: string;
  ip?: string;
  status: string; // приходит как строка
  houseId?: number;
  houseAddress?: string;
  settings?: Record<string, any>;
  currentUserPermission?: string;
  outdoorTemp?: number;
  outdoorHumidity?: number;
  outdoorCo2?: number;
}

export interface House {
  houseId: number;
  address: string;
  ownerId?: number;
  currentUserRole?: string;
  minTemp?: number;
  maxTemp?: number;
  useTempRange?: boolean;
}

export interface Room {
  roomId: number;
  houseId: number;
  roomName: string;
  floor: number;
}

export interface HouseUser {
  userId: number;
  username: string;
  email: string;
  role: string;
  joinedAt?: string;
  canInvite?: boolean;
}

export interface UserDevicePermission {
  permissionId: number;
  userId: number;
  username: string;
  deviceId: number;
  permissionLevel: string; // 'viewer', 'user', 'admin'
}

export interface DeviceSchedule {
  id: number;
  deviceId: number;
  time: string; // "HH:mm"
  daysOfWeek: number[];
  actionOn: boolean; // true = ON
  isEnabled: boolean;
}

export interface SensorReading {
  readingId: number;
  deviceId: number;
  readingType: string;
  value: number;
  unit: string | null;
  recordedAt: string;
}

export interface ScenarioGroupCommand {
  deviceId: number;
  status: string;
  settings: Record<string, unknown>;
}

export interface ScenarioGroup {
  groupId: number;
  houseId: number;
  name: string;
  description: string;
  commands: ScenarioGroupCommand[];
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioGroupSchedule {
  scheduleId: number;
  groupId: number;
  time: string;
  daysOfWeek: number[];
  isEnabled: boolean;
}
