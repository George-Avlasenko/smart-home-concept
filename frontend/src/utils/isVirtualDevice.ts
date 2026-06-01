/** Устройства без Tuya LAN: виртуальные и демо-эмулятор (SN-*). */
export function isLocalOnlyDeviceId(id?: string | null): boolean {
  const s = (id ?? '').trim().toUpperCase();
  if (!s) return false;
  return s.startsWith('VIRTUAL-') || s.startsWith('SN-');
}

export function isLocalOnlyDevice(device: {
  hardwareDeviceId?: string | null;
  settings?: Record<string, unknown> | null;
}): boolean {
  if (isLocalOnlyDeviceId(device.hardwareDeviceId)) return true;
  const tuya = device.settings?.tuya as { deviceId?: string } | undefined;
  return isLocalOnlyDeviceId(tuya?.deviceId);
}

/** @deprecated используй isLocalOnlyDevice */
export const isVirtualDevice = isLocalOnlyDevice;

/** Есть ли полный набор для LAN (иначе не дергаем tuya-service). */
export function hasTuyaLanConfig(device: {
  hardwareDeviceId?: string | null;
  ip?: string | null;
  settings?: Record<string, unknown> | null;
}): boolean {
  if (isLocalOnlyDevice(device)) return false;
  const tuya = (device.settings?.tuya ?? {}) as Record<string, unknown>;
  if (tuya.enabled !== true && tuya.enabled !== 'true') return false;
  const localKey = String(tuya.localKey ?? '').trim();
  const ip = String(tuya.ip ?? device.ip ?? '').trim();
  const deviceId = String(tuya.deviceId ?? device.hardwareDeviceId ?? '').trim();
  return localKey.length > 0 && ip.length > 0 && deviceId.length > 0;
}

export function shouldSkipTuyaLan(device: {
  hardwareDeviceId?: string | null;
  settings?: Record<string, unknown> | null;
}): boolean {
  return isLocalOnlyDevice(device);
}
