import React from 'react';
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Divider } from '@mui/material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import SecurityIcon from '@mui/icons-material/Security';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import VideocamIcon from '@mui/icons-material/Videocam';
import CoffeeIcon from '@mui/icons-material/Coffee';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import WindowIcon from '@mui/icons-material/Window';
import CurtainsIcon from '@mui/icons-material/Curtains';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';

export type DeviceCategory = 
  | 'all'
  | 'lighting'
  | 'climate'
  | 'security'
  | 'appliances'
  | 'sensors'
  | 'cameras'
  | 'other';

interface CategorySidebarProps {
  selectedCategory: DeviceCategory;
  onCategoryChange: (category: DeviceCategory) => void;
  deviceCounts?: Record<DeviceCategory, number>;
  compact?: boolean; // Иконки только на узких экранах
}

const categories: Array<{
  id: DeviceCategory;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'all', label: 'Все устройства', icon: <AllInclusiveIcon /> },
  { id: 'lighting', label: 'Освещение', icon: <LightbulbIcon /> },
  { id: 'climate', label: 'Климат', icon: <ThermostatIcon /> },
  { id: 'security', label: 'Безопасность', icon: <SecurityIcon /> },
  { id: 'appliances', label: 'Бытовая техника', icon: <CoffeeIcon /> },
  { id: 'cameras', label: 'Камеры', icon: <VideocamIcon /> },
  { id: 'other', label: 'Прочее', icon: <PowerSettingsNewIcon /> },
];

export const CategorySidebar: React.FC<CategorySidebarProps> = ({
  selectedCategory,
  onCategoryChange,
  deviceCounts = {},
  compact = false,
}) => {
  const width = compact ? 72 : 240;
  return (
    <Box
      sx={{
        width,
        minWidth: width,
        height: '100%',
        bgcolor: 'rgba(255, 255, 255, 0.12)',
        borderRight: '1px solid',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {!compact && (
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
            Категории
          </Typography>
        </Box>
      )}
      
      <List sx={{ flexGrow: 1, pt: 1 }}>
        {categories.filter((category) => {
          const count = deviceCounts[category.id] || 0;
          return category.id === 'all' || count > 0;
        }).map((category) => {
          const count = deviceCounts[category.id] || 0;
          const isSelected = selectedCategory === category.id;
          
          return (
            <ListItem key={category.id} disablePadding>
              <ListItemButton
                selected={isSelected}
                onClick={() => onCategoryChange(category.id)}
                sx={{
                  mx: compact ? 0 : 1,
                  mb: compact ? 0.5 : 0.5,
                  borderRadius: 2,
                  justifyContent: compact ? 'center' : 'flex-start',
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'primary.contrastText',
                    },
                    '& .MuiListItemText-primary': {
                      fontWeight: 600,
                    },
                  },
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isSelected ? 'primary.contrastText' : 'text.secondary',
                    minWidth: compact ? 40 : 40,
                    width: compact ? 40 : undefined,
                  }}
                >
                  {category.icon}
                </ListItemIcon>
                {!compact && (
                  <ListItemText
                    primary={category.label}
                    secondary={count > 0 ? `${count} устройств` : undefined}
                    secondaryTypographyProps={{
                      sx: {
                        color: isSelected ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary',
                        fontSize: '0.75rem',
                      },
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

// Функция для фильтрации устройств по категории
export const filterDevicesByCategory = (
  devices: any[],
  category: DeviceCategory
): any[] => {
  if (category === 'all') return devices;
  
  const categoryMap: Record<DeviceCategory, string[]> = {
    all: [],
    lighting: ['light'],
    climate: ['thermostat', 'window', 'humidifier', 'ventilation', 'sensor'],
    security: ['lock'],
    appliances: ['kettle', 'vacuum', 'outlet', 'switch'],
    sensors: [],
    cameras: ['camera'],
    other: ['curtain'],
  };
  
  const types = categoryMap[category] || [];
  return devices.filter(device => 
    types.includes(device.type.toLowerCase())
  );
};

