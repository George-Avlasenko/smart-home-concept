import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import DevicesIcon from '@mui/icons-material/Devices';
import SettingsIcon from '@mui/icons-material/Settings';
import PeopleIcon from '@mui/icons-material/People';
import PersonIcon from '@mui/icons-material/Person';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  onClick?: () => void;
}

export const GlassNavigation: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const navItems: NavItem[] = [
    { icon: <HomeIcon />, label: 'Дашборд', path: '/' },
    { icon: <DevicesIcon />, label: 'Все девайсы', path: '/devices' },
    { icon: <SettingsIcon />, label: 'Управление', path: '/admin/houses' },
    ...(user?.role === 'admin' 
      ? [{ icon: <PeopleIcon />, label: 'Пользователи', path: '/admin/users' } as NavItem]
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
        width: 80,
        minWidth: 80,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 3,
        gap: 2,
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'relative',
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
                ? 'rgba(255, 107, 53, 0.3)'
                : 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
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
    </Box>
  );
};

