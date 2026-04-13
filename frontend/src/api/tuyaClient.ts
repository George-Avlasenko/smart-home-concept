import axios from 'axios';

/** Прокси: dev — vite → localhost:5055; prod — nginx → tuya-service */
export const tuyaApi = axios.create({
  baseURL: '/tuya',
  headers: { 'Content-Type': 'application/json' },
  timeout: 12000,
});

export type TuyaDevicePayload = {
  device_id: string;
  local_key: string;
  ip: string;
  version?: string;
  dps_switch?: number;
};
