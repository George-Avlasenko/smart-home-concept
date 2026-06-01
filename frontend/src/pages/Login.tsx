import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import type { AuthResponse } from '../types';
import { Box, Button, TextField, Typography, Container, Paper, Alert } from '@mui/material';
import { glassAuthTextFieldSx } from './authTextFieldStyles';
import './authAutofill.css';
import { ACCOUNT_BLOCKED_FLAG } from '../utils/accountBlocked';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({ username: false, password: false });
  const { login } = useAuth();
  const navigate = useNavigate();

  // Проверяем, истек ли токен
  useEffect(() => {
    const tokenExpired = sessionStorage.getItem('tokenExpired');
    if (tokenExpired === 'true') {
      setError('Сессия истекла. Пожалуйста, войдите снова.');
      sessionStorage.removeItem('tokenExpired');
    }
    const accountBlocked = sessionStorage.getItem(ACCOUNT_BLOCKED_FLAG);
    if (accountBlocked === 'true') {
      setError('Ваш аккаунт заблокирован администратором.');
      sessionStorage.removeItem(ACCOUNT_BLOCKED_FLAG);
    }
  }, []);

  const isUsernameValid = username.trim().length > 0;
  const isPasswordValid = password.length >= 1; 

  const handleBlur = (field: keyof typeof touched) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await api.post<AuthResponse>('/auth/login', { username, password });
      const { token, ...user } = response.data;
      
      login(token, user);
      navigate('/'); // Переход на главную после входа
    } catch (err: any) {
      const data = err.response?.data;
      let msg = 'Ошибка входа';
      
      if (typeof data === 'string') {
        msg = data;
      } else if (data) {
        // ASP.NET Core может возвращать ошибку в разных форматах
        msg = data.error || data.value || data.title || data.message || 'Ошибка входа';
      } else if (err.message) {
        msg = err.message;
      }
      
      setError(msg);
    }
  };

  return (
    <Container component="main" maxWidth="xs" className="auth-screen">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            position: 'relative',
            p: 4,
            width: '100%',
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 2,
          }}
        >
          <Typography component="h1" variant="h5" align="center" mb={2} sx={{ color: '#fff' }}>
            Умный Дом Вход
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2, bgcolor: 'rgba(255, 107, 107, 0.2)', color: '#fff' }}>
              {error}
            </Alert>
          )}

          <Box component="form" autoComplete="off" onSubmit={handleSubmit} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              label="Имя пользователя"
              name="sh_login_uid"
              autoComplete="off"
              autoFocus
              value={username}
              onChange={(e) => {
                const val = e.target.value;
                if (val.length <= 30) {
                  setUsername(val);
                }
              }}
              onBlur={() => handleBlur('username')}
              error={touched.username && !isUsernameValid}
              helperText={touched.username && !isUsernameValid ? "Введите имя пользователя" : `${username.length}/30`}
              inputProps={{ maxLength: 30, autoComplete: 'off', spellCheck: false }}
              sx={glassAuthTextFieldSx}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Пароль"
              name="sh_login_secret"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => {
                const val = e.target.value;
                if (val.length <= 50) {
                  setPassword(val);
                }
              }}
              onBlur={() => handleBlur('password')}
              error={touched.password && !isPasswordValid}
              helperText={touched.password && !isPasswordValid ? "Введите пароль" : `${password.length}/50`}
              inputProps={{ maxLength: 50, autoComplete: 'off', spellCheck: false }}
              sx={glassAuthTextFieldSx}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2, bgcolor: '#F08B5C', color: '#fff', '&:hover': { bgcolor: '#D97A45' } }}
              disabled={!isUsernameValid || !isPasswordValid}
            >
              Войти
            </Button>
            <Button
              fullWidth
              variant="text"
              onClick={() => navigate('/register')}
              sx={{ color: 'rgba(255, 255, 255, 0.8)' }}
            >
              Нет аккаунта? Регистрация
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

