import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  InputAdornment, 
  Avatar, 
  Typography, 
  IconButton,
  Chip,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import MicIcon from '@mui/icons-material/Mic';
import AddIcon from '@mui/icons-material/Add';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export interface TopBarItem {
  id: number;
  label: string;
}

interface GlassTopBarProps {
  /** Дома (Dashboard) или комнаты (AllDevices) */
  items: TopBarItem[];
  selectedIndex: number;
  onItemChange: (index: number) => void;
  onAddClick?: () => void;
  onLogout?: () => void;
}

export const GlassTopBar: React.FC<GlassTopBarProps> = ({
  items,
  selectedIndex,
  onItemChange,
  onAddClick,
  onLogout,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);

  const handleProfileClick = (event: React.MouseEvent<HTMLElement>) => {
    setProfileMenuAnchor(event.currentTarget);
  };

  const handleProfileClose = () => {
    setProfileMenuAnchor(null);
  };

  return (
    <Box
      sx={{
        height: 80,
        display: 'flex',
        alignItems: 'center',
        px: 4,
        gap: 3,
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Переключатель (дома или комнаты) - капсульные кнопки */}
      <Box sx={{ display: 'flex', gap: 1.5, flexGrow: 1, alignItems: 'center' }}>
        {items.map((item, index) => (
          <Chip
            key={item.id}
            label={item.label}
            onClick={() => onItemChange(index)}
            sx={{
              height: 40,
              borderRadius: 4,
              background: selectedIndex === index
                ? 'rgba(240, 139, 92, 0.3)'
                : 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              border: selectedIndex === index
                ? '1px solid rgba(240, 139, 92, 0.5)'
                : '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              fontWeight: selectedIndex === index ? 600 : 400,
              transition: 'transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
              boxShadow: selectedIndex === index
                ? '0 0 15px rgba(240, 139, 92, 0.4)'
                : 'none',
              '&:hover': {
                background: 'rgba(240, 139, 92, 0.4)',
                boxShadow: '0 0 20px rgba(240, 139, 92, 0.5)',
                transform: 'translateY(-2px)',
              },
            }}
          />
        ))}
        {onAddClick && (
          <IconButton
            onClick={onAddClick}
            sx={{
              width: 40,
              height: 40,
              borderRadius: 4,
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              '&:hover': {
                background: 'rgba(240, 139, 92, 0.3)',
                boxShadow: '0 0 15px rgba(240, 139, 92, 0.4)',
              },
            }}
          >
            <AddIcon />
          </IconButton>
        )}
      </Box>

      {/* Строка поиска */}
      <TextField
        placeholder="Поиск..."
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        sx={{
          width: 300,
          '& .MuiOutlinedInput-root': {
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#FFFFFF',
            '& fieldset': {
              border: 'none',
            },
            '&:hover': {
              background: 'rgba(255, 255, 255, 0.15)',
            },
            '&.Mui-focused': {
              background: 'rgba(255, 255, 255, 0.2)',
              boxShadow: '0 0 15px rgba(240, 139, 92, 0.3)',
            },
          },
          '& .MuiInputBase-input': {
            color: '#FFFFFF',
            '&::placeholder': {
              color: 'rgba(255, 255, 255, 0.5)',
              opacity: 1,
            },
          },
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton size="small" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                <MicIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      {/* Блок пользователя */}
      <Box
        onClick={handleProfileClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1,
          borderRadius: 12,
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
          '&:hover': {
            background: 'rgba(255, 255, 255, 0.15)',
            boxShadow: '0 0 15px rgba(240, 139, 92, 0.3)',
          },
        }}
      >
        <Avatar
          sx={{
            width: 36,
            height: 36,
            bgcolor: 'rgba(240, 139, 92, 0.5)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
          }}
        >
          {user?.username?.[0]?.toUpperCase() || 'U'}
        </Avatar>
        <Typography variant="body2" sx={{ color: '#FFFFFF', fontWeight: 500 }}>
          {user?.username || 'User'}
        </Typography>
        <KeyboardArrowDownIcon sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 20 }} />
      </Box>

      <Menu
        anchorEl={profileMenuAnchor}
        open={Boolean(profileMenuAnchor)}
        onClose={handleProfileClose}
        PaperProps={{
          sx: {
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 4,
            mt: 1,
            minWidth: 200,
          },
        }}
      >
        <MenuItem 
          onClick={() => { navigate('/profile'); handleProfileClose(); }}
          sx={{ color: '#FFFFFF' }}
        >
          <PersonIcon sx={{ mr: 2, fontSize: 20 }} />
          Профиль
        </MenuItem>
        <MenuItem 
          onClick={() => { navigate('/admin/houses'); handleProfileClose(); }}
          sx={{ color: '#FFFFFF' }}
        >
          <SettingsIcon sx={{ mr: 2, fontSize: 20 }} />
          Управление
        </MenuItem>
        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.2)', my: 1 }} />
        <MenuItem 
          onClick={() => { 
            handleProfileClose();
            if (onLogout) {
              onLogout();
            } else {
              logout();
            }
          }}
          sx={{ color: '#FF6B6B' }}
        >
          <LogoutIcon sx={{ mr: 2, fontSize: 20 }} />
          Выход
        </MenuItem>
      </Menu>
    </Box>
  );
};

