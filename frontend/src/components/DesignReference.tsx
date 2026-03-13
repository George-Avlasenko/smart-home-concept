import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import designImage from '../assets/Tetiana Praetorius.jpg';

export const DesignReference = () => {
  return (
    <Paper sx={{ p: 3, m: 2 }}>
      <Typography variant="h6" gutterBottom>
        Референс дизайна
      </Typography>
      <Box
        component="img"
        src={designImage}
        alt="Design Reference"
        sx={{
          maxWidth: '100%',
          height: 'auto',
          border: '1px solid #ddd',
          borderRadius: 2,
        }}
      />
    </Paper>
  );
};



