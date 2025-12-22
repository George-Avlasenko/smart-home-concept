import axios from 'axios';

const API_URL = '/api'; // Используем относительный путь (через Vite proxy)

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерцептор для добавления токена к каждому запросу
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Если токен истек - сохраняем сообщение и перенаправляем на страницу входа
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      sessionStorage.setItem('tokenExpired', 'true');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

