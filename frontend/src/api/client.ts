import axios from 'axios';
import { forceLogoutBlocked, isAccountBlockedResponse } from '../utils/accountBlocked';

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
  // Глобальный Content-Type: application/json ломает multipart: boundary не подставляется
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    if (isAccountBlockedResponse(status, data)) {
      forceLogoutBlocked();
      return Promise.reject(error);
    }
    if (status === 401) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      sessionStorage.setItem('tokenExpired', 'true');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

