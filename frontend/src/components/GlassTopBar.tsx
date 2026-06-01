import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import AddIcon from '@mui/icons-material/Add';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';
import { useMediaQuery } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
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
  /** Поиск на странице устройств: контролируемые значение и колбэк */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** Без backdrop-filter: только rgba (быстрее скролл, страница устройств) */
  alphaGlass?: boolean;
}

export const GlassTopBar: React.FC<GlassTopBarProps> = ({
  items,
  selectedIndex,
  onItemChange,
  onAddClick,
  onLogout,
  searchValue: controlledSearchValue,
  onSearchChange,
  alphaGlass = true,
}) => {
  const hideProfileBlock = useMediaQuery('(max-width:800px)');
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [internalSearch, setInternalSearch] = useState('');
  const searchValue = onSearchChange != null && controlledSearchValue !== undefined ? controlledSearchValue : internalSearch;
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);
  const chipsScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const handleProfileClick = (event: React.MouseEvent<HTMLElement>) => {
    setProfileMenuAnchor(event.currentTarget);
  };

  const handleProfileClose = () => {
    setProfileMenuAnchor(null);
  };

  const updateScrollButtons = () => {
    const el = chipsScrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const left = el.scrollLeft;
    const eps = 2;
    setCanScrollLeft(left > eps);
    setCanScrollRight(max - left > eps);
  };

  useEffect(() => {
    updateScrollButtons();
    const el = chipsScrollRef.current;
    if (!el) return;
    const onScroll = () => updateScrollButtons();
    el.addEventListener('scroll', onScroll, { passive: true });
    const onWheel = (e: WheelEvent) => {
      // Колёсико мыши: вертикальный скролл переводим в горизонтальный (как вкладки в браузере)
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    const ro = new ResizeObserver(() => updateScrollButtons());
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onWheel);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    // при смене списка домов/комнат пересчитать
    updateScrollButtons();
  }, [items.length, selectedIndex]);

  const scrollByPx = (dir: -1 | 1) => {
    const el = chipsScrollRef.current;
    if (!el) return;
    // Уменьшаем шаг: прокрутка становится "медленнее" и меньше просаживает рендер.
    const step = Math.max(90, Math.floor(el.clientWidth * 0.25));
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  const showScrollArrows = useMemo(() => items.length > 0 && (canScrollLeft || canScrollRight), [items.length, canScrollLeft, canScrollRight]);

  const barGlass = alphaGlass
    ? {
        // Без blur: светлая «матовая» полоса как раньше, не тёмный блок
        background: 'rgba(255, 255, 255, 0.12)',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
      }
    : {
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      };

  const chipGlass = alphaGlass
    ? { backdropFilter: 'none', WebkitBackdropFilter: 'none' as const }
    : { backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' as const };

  const smallGlass = alphaGlass
    ? {
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
      }
    : {
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      };

  const menuPaperGlass = alphaGlass
    ? {
        // Тёмнее полосы, но не «чёрная»: белый текст остаётся читаемым
        background: 'rgba(36, 42, 72, 0.94)',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
      }
    : {
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      };

  return (
    <Box
      sx={{
        height: 80,
        display: 'flex',
        alignItems: 'center',
        px: 4,
        gap: 3,
        ...barGlass,
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Переключатель (дома или комнаты) - капсульные кнопки */}
      <Box sx={{ display: 'flex', gap: 1, flexGrow: 1, alignItems: 'center', minWidth: 0 }}>
        {showScrollArrows && (
          <IconButton
            onClick={() => scrollByPx(-1)}
            disabled={!canScrollLeft}
            size="small"
            sx={{
              width: 30,
              height: 30,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: 'rgba(255,255,255,0.9)',
              '&:hover': { background: 'rgba(255,255,255,0.12)' },
              '&.Mui-disabled': { opacity: 0.35, color: 'rgba(255,255,255,0.6)' },
            }}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        )}

        <Box
          ref={chipsScrollRef}
          sx={{
            display: 'flex',
            gap: 1.5,
            alignItems: 'center',
            flex: 1,
            minWidth: 0,
            overflowX: 'auto',
            overflowY: 'hidden',
            flexWrap: 'nowrap',
            scrollBehavior: 'smooth',
            px: 1,
            py: 0.75,
            overscrollBehaviorX: 'contain',
            // прячем скроллбар, но оставляем скролл
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {items.map((item, index) => (
            <Chip
              key={item.id}
              label={item.label}
              onClick={() => onItemChange(index)}
              sx={{
                height: 40,
                borderRadius: 4,
                flex: '0 0 auto',
                background: selectedIndex === index
                  ? alphaGlass ? 'rgba(240, 139, 92, 0.45)' : 'rgba(240, 139, 92, 0.3)'
                  : alphaGlass ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.1)',
                ...chipGlass,
                border: selectedIndex === index
                  ? '1px solid rgba(240, 139, 92, 0.5)'
                  : '1px solid rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                fontWeight: selectedIndex === index ? 600 : 400,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
                boxShadow: selectedIndex === index
                  ? '0 0 8px rgba(240, 139, 92, 0.35)'
                  : 'none',
                '&:hover': {
                  background: 'rgba(240, 139, 92, 0.4)',
                  boxShadow: '0 0 10px rgba(240, 139, 92, 0.45)',
                  transform: 'translateY(-2px)',
                },
              }}
            />
          ))}
        </Box>

        {showScrollArrows && (
          <IconButton
            onClick={() => scrollByPx(1)}
            disabled={!canScrollRight}
            size="small"
            sx={{
              width: 30,
              height: 30,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: 'rgba(255,255,255,0.9)',
              '&:hover': { background: 'rgba(255,255,255,0.12)' },
              '&.Mui-disabled': { opacity: 0.35, color: 'rgba(255,255,255,0.6)' },
            }}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        )}

        {onAddClick && (
          <IconButton
            onClick={onAddClick}
            sx={{
              width: 40,
              height: 40,
              borderRadius: 4,
              background: alphaGlass ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.1)',
              ...smallGlass,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              flex: '0 0 auto',
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
        onChange={(e) => (onSearchChange ? onSearchChange(e.target.value) : setInternalSearch(e.target.value))}
        sx={{
          width: 300,
          '& .MuiOutlinedInput-root': {
            borderRadius: 4,
            background: alphaGlass ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.1)',
            ...smallGlass,
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
        }}
      />

      {/* Блок пользователя */}
      {!hideProfileBlock && (
        <Box
          onClick={handleProfileClick}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 1,
            borderRadius: 12,
            background: alphaGlass ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.1)',
            ...smallGlass,
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
            key={user?.avatarUrl ?? 'letter'}
            src={user?.avatarUrl || undefined}
            sx={{
              width: 36,
              height: 36,
              bgcolor: 'rgba(240, 139, 92, 0.5)',
            }}
          >
            {!user?.avatarUrl && (user?.username?.[0]?.toUpperCase() || 'U')}
          </Avatar>
          <Typography variant="body2" sx={{ color: '#FFFFFF', fontWeight: 500 }}>
            {user?.username || 'User'}
          </Typography>
          <KeyboardArrowDownIcon sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 20 }} />
        </Box>
      )}

      {!hideProfileBlock && (
        <Menu
          anchorEl={profileMenuAnchor}
          open={Boolean(profileMenuAnchor)}
          onClose={handleProfileClose}
          PaperProps={{
            sx: {
              ...menuPaperGlass,
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
      )}
    </Box>
  );
};

