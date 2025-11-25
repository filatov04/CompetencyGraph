import axios from 'axios';
import { store } from '../store/store';
import { logout as logoutAction, updateTokens, updateUser } from '../store/authSlice';

// В production (Docker) используется относительный путь, который проксируется nginx на backend контейнер
// В development можно переопределить через VITE_API_URL для прямого обращения к backend
// Для локальной разработки определяем URL бэкенда автоматически
const isDevelopment = import.meta.env.DEV;
const baseURL = import.meta.env.VITE_API_URL || (isDevelopment ? 'http://localhost:80/api/v1' : '/api/v1');

console.log('customAxiosInstance: Base URL is', baseURL);
console.log('customAxiosInstance: Development mode:', isDevelopment);
console.log('customAxiosInstance: VITE_API_URL env var is', import.meta.env.VITE_API_URL);

const customAxiosInstance = axios.create({
  baseURL,
});

// Добавляем interceptor для автоматической отправки токена
customAxiosInstance.interceptors.request.use(
  (config) => {
    // Получаем токен из Redux store
    const state = store.getState();
    const token = state.auth.accessToken;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Добавляем interceptor для обработки ошибок авторизации
customAxiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // console.log('Interceptor: Got error', {
    //   status: error.response?.status,
    //   url: originalRequest?.url,
    //   method: originalRequest?.method
    // });

    // Пропускаем обработку ошибок для auth endpoints (login/register)
    // Эти ошибки должны обрабатываться формами напрямую
    if (
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/register')
    ) {
      // console.log('Interceptor: Skipping auth endpoint, passing error to form');
      return Promise.reject(error);
    }

    // Если получили 401 и это не повторный запрос и не запрос на refresh
    if (
      error.response?.status === 401 && 
      !originalRequest._retry && 
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      // Получаем refreshToken из Redux store
      const state = store.getState();
      const refreshToken = state.auth.refreshToken;
      
      // Если нет refresh_token, сразу редиректим на логин
      if (!refreshToken) {
        console.log('Interceptor: No refresh token, redirecting to login');
        
        // Диспатчим logout action в Redux
        store.dispatch(logoutAction());
        
        // Редиректим только если не на странице логина/регистрации
        if (!window.location.pathname.includes('/login') && 
            !window.location.pathname.includes('/register')) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        // Пытаемся обновить токен используя отдельный axios instance
        const response = await axios.post(`${baseURL}/auth/refresh`, {
          refresh_token: refreshToken
        });

        const { access_token, refresh_token: newRefreshToken, first_name, last_name } = response.data;
        
        // Обновляем токены через Redux
        store.dispatch(updateTokens({ 
          accessToken: access_token, 
          refreshToken: newRefreshToken 
        }));

        // Обновляем данные пользователя, если они пришли
        if (first_name && last_name) {
          store.dispatch(updateUser({ 
            first_name, 
            last_name 
          }));
        }

        // Обновляем заголовок оригинального запроса
        originalRequest.headers.Authorization = `Bearer ${access_token}`;

        // Повторяем оригинальный запрос
        return customAxiosInstance(originalRequest);
      } catch (refreshError) {
        // Если не удалось обновить токен - очищаем данные и перенаправляем
        console.error('Token refresh failed:', refreshError);
        
        // Диспатчим logout action в Redux
        store.dispatch(logoutAction());
        
        // Редиректим только если мы не на странице логина
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export { customAxiosInstance as api };