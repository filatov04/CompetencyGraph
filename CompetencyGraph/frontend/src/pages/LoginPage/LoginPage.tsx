import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LoginForm } from '../../features/auth';
import { authApi } from '../../shared/api';
import { useAuth } from '../../app/providers';
import type { LoginRequest } from '../../shared/types/authTypes';
import styles from './LoginPage.module.css';

export const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  // Если пользователь уже авторизован, перенаправляем на главную
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (credentials: LoginRequest) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(credentials);
      const { access_token, refresh_token, first_name, last_name } = response.data;
      
      // Создаем объект пользователя из ответа бэкенда
      const user = {
        id: 0,
        email: credentials.email,
        first_name: first_name,
        last_name: last_name
      };
      
      // Используем функцию login из AuthProvider для обновления состояния
      login(user, access_token, refresh_token);
      
      navigate('/');
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <LoginForm onSubmit={handleLogin} isLoading={isLoading} />
        <div className={styles.footer}>
          <p className={styles.footerText}>
            Нет аккаунта?{' '}
            <Link to="/register" className={styles.link}>
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

