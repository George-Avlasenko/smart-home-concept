import React from 'react';
import { Box, Typography, Button } from '@mui/material';

export const PowerOff = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0A0E27',
        color: 'rgba(255,255,255,0.8)',
        p: 3,
        textAlign: 'center',
      }}
    >
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        Питание отключено
      </Typography>
      <Typography variant="body1" sx={{ mb: 3, maxWidth: 320 }}>
        Модуль не работает. Нажмите кнопку ниже, чтобы снова запустить приложение.
      </Typography>
      <Button
        variant="outlined"
        onClick={() => { window.location.href = '/'; }}
        sx={{ borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}
      >
        Запустить снова
      </Button>
    </Box>
  );
};
