import React from 'react';
import { SvgIcon, type SvgIconProps } from '@mui/material';

export function isDeskLamp(deviceLike: { name?: string; productSku?: string; settings?: Record<string, any> } | null | undefined): boolean {
  const name = String(deviceLike?.name ?? '').toLowerCase();
  const sku = String(deviceLike?.productSku ?? deviceLike?.settings?.catalogSku ?? '').toLowerCase();
  return sku.startsWith('sh-desk-') || name.includes('настоль') || name.includes('desk');
}

export function isBreakerSwitch(deviceLike: { name?: string; productSku?: string; settings?: Record<string, any> } | null | undefined): boolean {
  const name = String(deviceLike?.name ?? '').toLowerCase();
  const sku = String(deviceLike?.productSku ?? deviceLike?.settings?.catalogSku ?? '').toLowerCase();
  return sku.startsWith('sh-breaker-') || /\b(автомат|breaker|щит)\b/.test(name);
}

export const DeskLampIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 -960 960 960">
    <path d="M520-120v-80h320v80H520ZM221-600h139v-160h-69l-70 160Zm419 360v-400q0-17-11.5-28.5T600-680H440v120q0 17-11.5 28.5T400-520H160q-22 0-34-18t-3-38l95-216q10-22 29.5-35t43.5-13h69q33 0 56.5 23.5T440-760h160q50 0 85 35t35 85v400h-80ZM221-600h139-139Z" />
  </SvgIcon>
);

export const SwitchLeverIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 -960 960 960">
    <path d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h480q33 0 56.5 23.5T800-800v640q0 33-23.5 56.5T720-80H240Zm0-80h480v-640H240v640Zm80-120h320v-400H320v400Zm80-80v-160h160v160H400Zm80-350q13 0 21.5-8.5T510-740q0-13-8.5-21.5T480-770q-13 0-21.5 8.5T450-740q0 13 8.5 21.5T480-710Zm0 520q13 0 21.5-8.5T510-220q0-13-8.5-21.5T480-250q-13 0-21.5 8.5T450-220q0 13 8.5 21.5T480-190Zm0-290Z" />
  </SvgIcon>
);
