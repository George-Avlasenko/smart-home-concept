import React, { useEffect, useState } from 'react';
import { Typography, Box, Avatar, Button, TextField, Alert, Divider, CircularProgress, useMediaQuery, useTheme } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import { api } from '../api/client';
import { GlassPage } from '../components/GlassPage';
import { Toast } from '../components/Toast';

interface UserProfile {
    userId: number;
    username: string;
    email: string;
    fullName?: string;
    avatarUrl?: string;
}

export const Profile = () => {
  const { user: _authUser, logout, patchUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  
  // Password form
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState({
    oldPassword: false,
    newPassword: false
  });
  
  // Password validation
  const isNewPasswordValid = newPassword.length >= 6;
  const isPasswordFormValid = oldPassword.length > 0 && isNewPasswordValid;

  useEffect(() => {
      fetchProfile();
  }, []);

  const fetchProfile = async () => {
      try {
          const res = await api.get<UserProfile>('/profile');
          setProfile(res.data);
          setFullName(res.data.fullName || '');
          setEmail(res.data.email || '');
          patchUser({ avatarUrl: res.data.avatarUrl || undefined });
      } catch (err) {
          setError('Не удалось загрузить профиль');
      } finally {
          setLoading(false);
      }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const file = input.files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);

      try {
          await api.post('/profile/avatar', formData);
          await fetchProfile();
          setSuccess('Фото профиля обновлено');
      } catch (err: unknown) {
          const ax = err as { response?: { status?: number; data?: unknown } };
          const data = ax.response?.data;
          const detail =
              typeof data === 'string'
                  ? data
                  : data && typeof data === 'object' && 'message' in data
                    ? String((data as { message?: string }).message)
                    : ax.response?.status === 413
                      ? 'Файл слишком большой для сервера'
                      : ax.response?.status
                        ? `Ошибка сервера (${ax.response.status})`
                        : '';
          setError(detail ? `Ошибка загрузки фото: ${detail}` : 'Ошибка загрузки фото');
      } finally {
          input.value = '';
      }
  };

  const handleDeleteAvatar = async () => {
      if (!window.confirm('Удалить фото профиля?')) return;
      try {
          await api.delete('/profile/avatar');
          await fetchProfile();
          setSuccess('Фото удалено');
      } catch (err) {
          setError('Ошибка удаления фото');
      }
  };

  const handleUpdateProfile = async () => {
      try {
          await api.put('/profile', { fullName, email });
          setSuccess('Профиль обновлен');
          fetchProfile();
      } catch (err: any) {
          setError(err.response?.data || 'Ошибка обновления профиля');
      }
  };

  const handleChangePassword = async () => {
      if (!isPasswordFormValid) {
          setPasswordTouched({ oldPassword: true, newPassword: true });
          return;
      }
      
      try {
          await api.put('/profile/password', { oldPassword, newPassword });
          setSuccess('Пароль успешно изменен');
          setOldPassword('');
          setNewPassword('');
          setError('');
          setPasswordTouched({ oldPassword: false, newPassword: false });
      } catch (err: any) {
          const data = err.response?.data;
          let msg = 'Ошибка изменения пароля';
          
          if (typeof data === 'string') {
              msg = data;
          } else if (data?.error) {
              msg = data.error;
          }
          
          setError(msg);
      }
  };

  const handleDeleteAccount = async () => {
      if (!window.confirm('Вы уверены, что хотите удалить свой аккаунт? Это действие необратимо.')) return;
      try {
          await api.delete('/profile');
          logout();
      } catch (err) {
          setError('Ошибка удаления аккаунта');
      }
  };

  if (loading) return <GlassPage><Box display="flex" justifyContent="center" py={6}><CircularProgress sx={{ color: '#F08B5C' }} /></Box></GlassPage>;
  if (!profile) return <GlassPage><Alert severity="error">Профиль не найден</Alert></GlassPage>;

  // Тот же origin, что и у страницы: /uploads проксируется на бэкенд (Vite / nginx)
  const avatarSrc = profile.avatarUrl || undefined;

  return (
    <GlassPage>
        <Toast
          open={!!error || !!success}
          message={error || success || ''}
          severity={error ? 'error' : 'success'}
          onClose={() => { setError(''); setSuccess(''); }}
        />

      <Box sx={{ p: 2 }}>
        <Box display="flex" flexDirection={isMobile ? 'column' : 'row'} gap={4}>
            {/* Левая колонка: Аватар */}
            <Box display="flex" flexDirection="column" alignItems="center" width={isMobile ? '100%' : '30%'}>
                <Avatar
                    key={avatarSrc ?? 'no-avatar'}
                    src={avatarSrc}
                    sx={{ width: 150, height: 150, mb: 2, bgcolor: 'primary.main', fontSize: 64 }}
                >
                    {!profile.avatarUrl && profile.username[0].toUpperCase()}
        </Avatar>
        
                <Button
                    variant="outlined"
                    component="label"
                    startIcon={<CloudUploadIcon />}
                    sx={{ mb: 1, width: '100%' }}
                >
                    Загрузить фото
                    <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleAvatarUpload}
                    />
                </Button>
                
                {profile.avatarUrl && (
                    <Button
                        variant="text"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={handleDeleteAvatar}
                        sx={{ width: '100%' }}
                    >
                        Удалить фото
                    </Button>
                )}
                
            </Box>

            {/* Правая колонка: Данные */}
            <Box flexGrow={1} width={isMobile ? '100%' : '70%'}>
                <Typography variant="h5" gutterBottom>Личные данные</Typography>
                <Box component="form" noValidate autoComplete="off" sx={{ mb: 4 }}>
                    <TextField
                        label="Имя пользователя"
                        value={profile.username}
                        fullWidth
                        disabled // Username менять обычно нельзя или сложно
                        margin="normal"
                        variant="filled"
                    />
                    <TextField
                        label="Email"
                        value={email}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.length <= 50) {
                            setEmail(val);
                          }
                        }}
                        fullWidth
                        margin="normal"
                        helperText={`${email.length}/50`}
                        inputProps={{ maxLength: 50 }}
                    />
                    <TextField
                        label="Полное имя"
                        value={fullName}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.length <= 50) {
                            setFullName(val);
                          }
                        }}
                        fullWidth
                        margin="normal"
                        helperText={`${fullName.length}/50`}
                        inputProps={{ maxLength: 50 }}
                    />
                    <Button 
                        variant="contained" 
                        onClick={handleUpdateProfile} 
                        startIcon={<SaveIcon />}
                        sx={{ mt: 2 }}
                        disabled={email === profile.email && fullName === profile.fullName}
                    >
                        Сохранить изменения
                    </Button>
          </Box>
          
                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" gutterBottom>Смена пароля</Typography>
                <Box component="form" noValidate autoComplete="off">
                    <TextField
                        label="Старый пароль"
                        type="password"
                        value={oldPassword}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val.length <= 50) {
                                setOldPassword(val);
                            }
                        }}
                        onBlur={() => setPasswordTouched(prev => ({ ...prev, oldPassword: true }))}
                        fullWidth
                        margin="normal"
                        error={passwordTouched.oldPassword && oldPassword.length === 0}
                        helperText={passwordTouched.oldPassword && oldPassword.length === 0 ? 'Введите старый пароль' : `${oldPassword.length}/50`}
                        inputProps={{ maxLength: 50 }}
                    />
                    <TextField
                        label="Новый пароль"
                        type="password"
                        value={newPassword}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val.length <= 50) {
                                setNewPassword(val);
                            }
                        }}
                        onBlur={() => setPasswordTouched(prev => ({ ...prev, newPassword: true }))}
                        fullWidth
                        margin="normal"
                        error={passwordTouched.newPassword && !isNewPasswordValid}
                        helperText={passwordTouched.newPassword && !isNewPasswordValid ? 'Пароль должен содержать не менее 6 символов' : `${newPassword.length}/50`}
                        inputProps={{ maxLength: 50 }}
                    />
                    <Button 
                        variant="outlined" 
                        color="primary"
                        onClick={handleChangePassword} 
                        sx={{ mt: 2 }}
                        disabled={!isPasswordFormValid}
                    >
                        Обновить пароль
                    </Button>
          </Box>
          
                <Divider sx={{ my: 3 }} />
                
                <Box>
                    <Typography variant="h6" color="error" gutterBottom>Опасная зона</Typography>
                    <Button 
              variant="outlined" 
                        color="error" 
                        onClick={handleDeleteAccount}
                    >
                        Удалить аккаунт
                    </Button>
                </Box>
          </Box>
        </Box>
      </Box>
    </GlassPage>
  );
};
