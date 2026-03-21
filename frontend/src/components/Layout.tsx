import React from 'react';
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { GlassNavigation } from './GlassNavigation';
import { BackgroundBlur } from './BackgroundBlur';
import { scrollbarLikeDevicesSx } from '../theme/scrollbarStyles';

export const Layout = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        height: '100dvh',
        minHeight: '100dvh',
        minWidth: 550,
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        background: '#0A0E27',
      }}
    >
      <BackgroundBlur />
      {/* Левая панель фиксирована; спейсер держит место в потоке */}
      <GlassNavigation />
      <Box sx={{ width: 80, flexShrink: 0 }} aria-hidden />
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          height: '100dvh',
          minHeight: 0,
          pr: '6px',
          mr: '6px',
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 1,
          WebkitOverflowScrolling: 'touch',
          ...scrollbarLikeDevicesSx,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

