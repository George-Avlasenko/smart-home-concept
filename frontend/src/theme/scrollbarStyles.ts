import type { SxProps, Theme } from '@mui/material/styles';

/** Единый скролл как на странице устройств: тонкий, без стрелок, полупрозрачный thumb */
export const scrollbarLikeDevicesSx: SxProps<Theme> = {
  scrollbarWidth: 'thin !important',
  scrollbarColor: 'rgba(255,255,255,0.28) transparent !important',
  '&::-webkit-scrollbar': {
    width: '10px !important',
    height: '10px !important',
    background: 'transparent !important',
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent !important',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(255, 255, 255, 0.28) !important',
    borderRadius: '999px !important',
    border: '2px solid transparent !important',
    backgroundClip: 'content-box !important',
  },
  '&::-webkit-scrollbar-button': {
    display: 'none !important',
    WebkitAppearance: 'none',
    background: 'transparent',
    width: '0 !important',
    height: '0 !important',
  },
  '&::-webkit-scrollbar-button:single-button': {
    display: 'none !important',
    WebkitAppearance: 'none',
    background: 'transparent',
    width: '0 !important',
    height: '0 !important',
  },
  '&::-webkit-scrollbar-button:vertical:start:decrement': {
    display: 'none !important',
    WebkitAppearance: 'none',
    background: 'transparent',
    width: '0 !important',
    height: '0 !important',
  },
  '&::-webkit-scrollbar-button:vertical:end:increment': {
    display: 'none !important',
    WebkitAppearance: 'none',
    background: 'transparent',
    width: '0 !important',
    height: '0 !important',
  },
  '&::-webkit-scrollbar-button:horizontal:start:decrement': {
    display: 'none !important',
    WebkitAppearance: 'none',
    background: 'transparent',
    width: '0 !important',
    height: '0 !important',
  },
  '&::-webkit-scrollbar-button:horizontal:end:increment': {
    display: 'none !important',
    WebkitAppearance: 'none',
    background: 'transparent',
    width: '0 !important',
    height: '0 !important',
  },
};
