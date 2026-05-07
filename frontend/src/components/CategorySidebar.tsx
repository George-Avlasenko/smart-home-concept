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
import BoltIcon from '@mui/icons-material/Bolt';

export type DeviceCategory = 
  | 'all'
  | 'lighting'
  | 'climate'
  | 'energy'
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
  /** Растянуть колонку на высоту родителя (диалог выбора устройств). */
  stretchColumn?: boolean;
}

const categories: Array<{
  id: DeviceCategory;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'all', label: 'Все устройства', icon: <AllInclusiveIcon /> },
  { id: 'lighting', label: 'Освещение', icon: <LightbulbIcon /> },
  { id: 'climate', label: 'Климат', icon: <ThermostatIcon /> },
  { id: 'energy', label: 'Энергия', icon: <BoltIcon /> },
  { id: 'security', label: 'Безопасность', icon: <SecurityIcon /> },
  { id: 'appliances', label: 'Бытовая техника', icon: <CoffeeIcon /> },
  { id: 'cameras', label: 'Камеры', icon: <VideocamIcon /> },
  { id: 'other', label: 'Прочее', icon: <PowerSettingsNewIcon /> },
];

function classifyDeviceCategory(device: any): DeviceCategory {
  const type = String(device?.type ?? '').toLowerCase();
  const sku = String(device?.productSku ?? device?.settings?.catalogSku ?? '').toLowerCase();
  const name = String(device?.name ?? '').toLowerCase();
  const energyLike =
    type === 'outlet' ||
    sku.startsWith('sh-meter-') ||
    sku.startsWith('sh-breaker-') ||
    /\b(meter|breaker|счетчик|счётчик|энерг|газ|вода|автомат)\b/.test(name);
  const securitySensorLike = /\b(flood|smoke|gas-detector|детектор|затоп|дым)\b/.test(sku);

  if (type === 'light') return 'lighting';
  if (type === 'camera') return 'cameras';
  if (type === 'lock' || type === 'window' || securitySensorLike) return 'security';
  if (energyLike) return 'energy';
  if (['thermostat', 'humidifier', 'ventilation'].includes(type)) return 'climate';
  if (type === 'sensor') return 'sensors';
  if (['kettle', 'vacuum', 'switch'].includes(type)) return 'appliances';
  return 'other';
}

export const CategorySidebar: React.FC<CategorySidebarProps> = ({
  selectedCategory,
  onCategoryChange,
  deviceCounts = {},
  compact = false,
  stretchColumn = false,
}) => {
  const width = compact ? 72 : 240;
  return (
    <Box
      sx={{
        width,
        minWidth: width,
        height: '100%',
        minHeight: stretchColumn ? '100%' : undefined,
        alignSelf: stretchColumn ? 'stretch' : undefined,
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
      
      <List
        sx={{
          flexGrow: stretchColumn ? 0 : 1,
          flexShrink: 0,
          pt: 1,
        }}
      >
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
      {stretchColumn && <Box sx={{ flex: 1, minHeight: 0, width: '100%' }} aria-hidden />}
    </Box>
  );
};

// Функция для фильтрации устройств по категории
export const filterDevicesByCategory = (
  devices: any[],
  category: DeviceCategory
): any[] => {
  if (category === 'all') return devices;
  
  return devices.filter((device) => classifyDeviceCategory(device) === category);
};

/** Сколько устройств попадает в каждую категорию (для боковой панели). */
export function computeDeviceCategoryCounts(devices: { type: string }[]): Record<DeviceCategory, number> {
  const ids: DeviceCategory[] = [
    'all',
    'lighting',
    'climate',
    'energy',
    'security',
    'appliances',
    'sensors',
    'cameras',
    'other',
  ];
  const result = {} as Record<DeviceCategory, number>;
  for (const id of ids) {
    result[id] = id === 'all' ? devices.length : filterDevicesByCategory(devices, id).length;
  }
  return result;
}

