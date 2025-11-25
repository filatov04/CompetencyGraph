import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../../shared/types/authTypes';
import { authApi } from '../../shared/api';
import { useAppDispatch, useAppSelector, loginSuccess, logout as logoutAction, setLoading } from '../../shared/store';
import { store } from '../../shared/store/store';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const dispatch = useAppDispatch();
  const { user, isLoading, isAuthenticated, accessToken } = useAppSelector((state) => state.auth);

  useEffect(() => {
    const initAuth = async () => {
      dispatch(setLoading(true));
      
      // Если нет токена - сразу завершаем загрузку
      if (!accessToken) {
        dispatch(setLoading(false));
        return;
      }
      
      // Если есть токен - валидация произойдет автоматически 
      // при первом API-запросе через interceptor
      dispatch(setLoading(false));
    };

    initAuth();
  }, [dispatch, accessToken]);

  const login = (user: User, accessToken: string, refreshToken: string) => {
    dispatch(loginSuccess({ user, accessToken, refreshToken }));
  };

  const logout = async () => {
    try {
      // Получаем refreshToken напрямую из store
      const state = store.getState();
      const refreshToken = state.auth.refreshToken;
      
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch(logoutAction());
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

