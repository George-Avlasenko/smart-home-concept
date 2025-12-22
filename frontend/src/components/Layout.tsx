import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Container } from '@mui/material';
import { useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeIcon from '@mui/icons-material/Home';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import PeopleIcon from '@mui/icons-material/People';

export const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ flexGrow: 1, cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            Умный Дом
          </Typography>
          
          <Button color="inherit" onClick={() => navigate('/')} startIcon={<HomeIcon />}>
            Дашборд
          </Button>

          <Button color="inherit" onClick={() => navigate('/admin/houses')} startIcon={<SettingsIcon />}>
            Управление
          </Button>

          {user?.role === 'admin' && (
            <Button color="inherit" onClick={() => navigate('/admin/users')} startIcon={<PeopleIcon />}>
              Пользователи
            </Button>
          )}

          <Button color="inherit" onClick={() => navigate('/profile')} startIcon={<PersonIcon />}>
            Профиль
          </Button>

          <Button color="inherit" onClick={logout} startIcon={<LogoutIcon />}>
            Выход
          </Button>
        </Toolbar>
      </AppBar>
      
      <Box component="main" sx={{ flexGrow: 1, p: 2, width: '100%', overflowX: 'hidden' }}>
        <Outlet />
      </Box>
    </>
  );
};

