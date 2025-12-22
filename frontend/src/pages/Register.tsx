import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Box, Button, TextField, Typography, Container, Paper, Alert } from '@mui/material';

export const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Состояние для отслеживания, был ли фокус на поле
  const [touched, setTouched] = useState({
    username: false,
    email: false,
    password: false
  });

  // Простая валидация
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPasswordValid = password.length >= 6;
  const isUsernameValid = username.trim().length > 0;
  
  const isFormValid = isEmailValid && isPasswordValid && isUsernameValid;

  const handleBlur = (field: keyof typeof touched) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      await api.post('/auth/register', { username, email, password });
      alert('Регистрация успешна! Теперь войдите.');
      navigate('/login');
    } catch (err: any) {
      const data = err.response?.data;
      let msg = 'Ошибка регистрации';
      
      if (typeof data === 'string') {
        msg = data;
      } else if (data) {
        // ASP.NET Core может возвращать ошибку в разных форматах
        msg = data.error || data.value || data.title || data.message || 'Ошибка регистрации';
      } else if (err.message) {
        msg = err.message;
      }
      
      setError(msg);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography component="h1" variant="h5" align="center" mb={2}>
            Регистрация
          </Typography>
          
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              label="Имя пользователя"
              value={username}
              onChange={(e) => {
                const val = e.target.value;
                if (val.length <= 30) {
                  setUsername(val);
                }
              }}
              onBlur={() => handleBlur('username')}
              error={touched.username && !isUsernameValid}
              helperText={touched.username && !isUsernameValid ? "Имя пользователя обязательно" : `${username.length}/30`}
              inputProps={{ maxLength: 30 }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => {
                const val = e.target.value;
                if (val.length <= 50) {
                  setEmail(val);
                }
              }}
              onBlur={() => handleBlur('email')}
              error={touched.email && !isEmailValid}
              helperText={touched.email && !isEmailValid ? "Введите корректный Email" : `${email.length}/50`}
              inputProps={{ maxLength: 50 }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Пароль"
              type="password"
              value={password}
              onChange={(e) => {
                const val = e.target.value;
                if (val.length <= 50) {
                  setPassword(val);
                }
              }}
              onBlur={() => handleBlur('password')}
              error={touched.password && !isPasswordValid}
              helperText={touched.password && !isPasswordValid ? "Пароль должен быть не менее 6 символов" : `${password.length}/50`}
              inputProps={{ maxLength: 50 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={!isFormValid}
            >
              Зарегистрироваться
            </Button>
            <Button
              fullWidth
              variant="text"
              onClick={() => navigate('/login')}
            >
              Уже есть аккаунт? Войти
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

