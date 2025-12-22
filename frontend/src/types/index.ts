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

export interface Device {
  deviceId: number;
  roomId: number;
  roomName: string;
  name: string;
  manufacturer?: string;
  serialNumber?: string;
  type: string;
  ip?: string;
  status: string; // приходит как строка
  houseId?: number;
  houseAddress?: string;
  settings?: Record<string, any>;
  currentUserPermission?: string; // 'viewer', 'user', 'admin'
}

export interface House {
  houseId: number;
  address: string;
  ownerId?: number;
  currentUserRole?: string; // 'owner', 'admin', 'member', 'viewer'
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
