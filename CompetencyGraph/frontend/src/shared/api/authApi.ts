import { api } from './customAxiosInstance';
import type { LoginRequest, RegisterRequest, AuthResponse } from '../types/authTypes';

export const authApi = {
  login: async (credentials: LoginRequest) => {
    return api.post<AuthResponse>('/auth/login', credentials);
  },

  register: async (data: RegisterRequest) => {
    return api.post<AuthResponse>('/auth/register', data);
  },

  logout: async (refreshToken: string) => {
    return api.post('/auth/logout', { refresh_token: refreshToken });
  },

  refresh: async (refreshToken: string) => {
    return api.post<AuthResponse>('/auth/refresh', { refresh_token: refreshToken });
  },
};

