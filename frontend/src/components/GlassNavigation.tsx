import React, { useEffect, useMemo, useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import DevicesIcon from '@mui/icons-material/Devices';
import SettingsIcon from '@mui/icons-material/Settings';
import PeopleIcon from '@mui/icons-material/People';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import PersonIcon from '@mui/icons-material/Person';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSelectedHouse } from '../context/SelectedHouseContext';
import { api } from '../api/client';
import type { House } from '../types';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  onClick?: () => void;
}

export const GlassNavigation: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { selectedHouseId } = useSelectedHouse();
  const [houses, setHouses] = useState<House[]>([]);

  useEffect(() => {
    if (!user) {
      setHouses([]);
      return;
    }
    void api
      .get<House[]>('/houses')
      .then((r) => setHouses(r.data ?? []))
      .catch(() => setHouses([]));
  }, [user?.userId]);

  const roleForSelected = useMemo(() => {
    if (selectedHouseId == null) return null as string | null;
    return houses.find((h) => h.houseId === selectedHouseId)?.currentUserRole ?? null;
  }, [houses, selectedHouseId]);

  const showGroupsNav =
    user?.role === 'admin' ||
    selectedHouseId == null ||
    roleForSelected === 'owner' ||
    roleForSelected === 'admin';

  const navItems: NavItem[] = [
    { icon: <HomeIcon />, label: 'Дашборд', path: '/' },
    { icon: <DevicesIcon />, label: 'Все девайсы', path: '/devices' },
    ...(showGroupsNav ? [{ icon: <GroupWorkIcon />, label: 'Сценарии', path: '/groups' } as NavItem] : []),
    { icon: <SettingsIcon />, label: 'Управление', path: '/admin/houses' },
    ...(user?.role === 'admin' 
      ? [
          { icon: <PeopleIcon />, label: 'Пользователи', path: '/admin/users' } as NavItem,
          { icon: <CloudSyncIcon />, label: 'Интеграции', path: '/admin/integrations' } as NavItem,
        ]
      : []
    ),
    { icon: <PersonIcon />, label: 'Профиль', path: '/profile' },
  ];

  const handleClick = (item: NavItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: 80,
        minWidth: 80,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 3,
        gap: 2,
        background: 'rgba(255, 255, 255, 0.12)',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 10,
      }}
    >
      {navItems.map((item, index) => (
        <Tooltip key={index} title={item.label} placement="right">
          <IconButton
            onClick={() => handleClick(item)}
            sx={{
              width: 56,
              height: 56,
              borderRadius: '4px',
              background: window.location.pathname === item.path
                ? 'rgba(255, 107, 53, 0.4)'
                : 'rgba(255, 255, 255, 0.14)',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              border: window.location.pathname === item.path
                ? '1px solid rgba(255, 107, 53, 0.5)'
                : '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              transition: 'all 0.08s ease',
              '&:hover': {
                background: 'rgba(255, 107, 53, 0.4)',
                boxShadow: '0 0 20px rgba(255, 107, 53, 0.5)',
                transform: 'scale(1.1)',
                border: '1px solid rgba(255, 107, 53, 0.6)',
              },
            }}
          >
            {item.icon}
          </IconButton>
        </Tooltip>
      ))}

      <Box sx={{ flex: 1 }} />

      <Tooltip title="Выйти" placement="right">
        <IconButton
          onClick={logout}
          sx={{
            width: 56,
            height: 56,
            borderRadius: '4px',
            background: 'rgba(255, 255, 255, 0.14)',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#FFFFFF',
            transition: 'all 0.08s ease',
            mb: 1,
            '&:hover': {
              background: 'rgba(255, 107, 53, 0.4)',
              boxShadow: '0 0 20px rgba(255, 107, 53, 0.5)',
              transform: 'scale(1.1)',
              border: '1px solid rgba(255, 107, 53, 0.6)',
            },
          }}
        >
          <LogoutIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

