import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { Card, CardContent } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

interface TemperatureControlProps {
  currentTemp?: number;
  targetTemp?: number;
  onTempChange?: (temp: number) => void;
}

export const TemperatureControl: React.FC<TemperatureControlProps> = ({
  currentTemp = 22,
  targetTemp = 22,
  onTempChange,
}) => {
  const handleIncrease = () => {
    if (onTempChange && targetTemp < 30) {
      onTempChange(targetTemp + 0.5);
    }
  };

  const handleDecrease = () => {
    if (onTempChange && targetTemp > 16) {
      onTempChange(targetTemp - 0.5);
    }
  };

  // Расчет угла для дуги (0-360 градусов, где 0 = 16°C, 360 = 30°C)
  const angle = ((targetTemp - 16) / (30 - 16)) * 360;
  const radius = 80;
  const centerX = 100;
  const centerY = 100;

  return (
    <Card
      sx={{
        height: '100%',
        background: 'rgba(255, 255, 255, 0.14)',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 4,
      }}
    >
      <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 4 }}>
        Температура
      </Typography>
      
      <Box
        sx={{
          position: 'relative',
          width: 200,
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Круглый индикатор */}
        <svg width="200" height="200" style={{ position: 'absolute', top: 0, left: 0 }}>
          {/* Фоновая дуга */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="8"
            strokeDasharray={`${2 * Math.PI * radius}`}
            strokeDashoffset={2 * Math.PI * radius * 0.75}
            transform={`rotate(-135 ${centerX} ${centerY})`}
          />
          {/* Активная дуга */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke="#F08B5C"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * radius}`}
            strokeDashoffset={2 * Math.PI * radius * (1 - (angle / 360) * 0.75)}
            transform={`rotate(-135 ${centerX} ${centerY})`}
            style={{
              filter: 'drop-shadow(0 0 10px rgba(255, 107, 53, 0.8))',
            }}
          />
        </svg>
        
        {/* Центральное значение */}
        <Box sx={{ textAlign: 'center', zIndex: 1 }}>
          <Typography
            variant="h2"
            sx={{
              color: '#FFFFFF',
              fontWeight: 700,
              lineHeight: 1,
              mb: 0.5,
            }}
          >
            {targetTemp.toFixed(1)}
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '1rem',
            }}
          >
            °C
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(255, 255, 255, 0.5)',
              display: 'block',
              mt: 1,
            }}
          >
            Текущая: {currentTemp}°C
          </Typography>
        </Box>
      </Box>

      {/* Кнопки управления */}
      <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
        <IconButton
          onClick={handleDecrease}
          sx={{
            width: 48,
            height: 48,
            borderRadius: '4px',
            background: 'rgba(255, 255, 255, 0.14)',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#FFFFFF',
            '&:hover': {
              background: 'rgba(255, 107, 53, 0.3)',
              boxShadow: '0 0 15px rgba(255, 107, 53, 0.4)',
            },
          }}
        >
          <RemoveIcon />
        </IconButton>
        <IconButton
          onClick={handleIncrease}
          sx={{
            width: 48,
            height: 48,
            borderRadius: '4px',
            background: 'rgba(255, 255, 255, 0.14)',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#FFFFFF',
            '&:hover': {
              background: 'rgba(255, 107, 53, 0.3)',
              boxShadow: '0 0 15px rgba(255, 107, 53, 0.4)',
            },
          }}
        >
          <AddIcon />
        </IconButton>
      </Box>
    </Card>
  );
};

