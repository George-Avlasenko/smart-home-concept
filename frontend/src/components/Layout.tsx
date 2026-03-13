import React from 'react';
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { GlassNavigation } from './GlassNavigation';
import { BackgroundBlur } from './BackgroundBlur';

export const Layout = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        background: '#0A0E27',
      }}
    >
      <BackgroundBlur />
      {/* Левая навигационная панель */}
      <GlassNavigation />
      
      {/* Основной контент */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: '100%',
          minHeight: '100vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

