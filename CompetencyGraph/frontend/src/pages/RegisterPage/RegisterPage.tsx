import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { RegisterForm } from '../../features/auth';
import { authApi } from '../../shared/api';
import { useAuth } from '../../app/providers';
import type { RegisterRequest } from '../../shared/types/authTypes';
import styles from './RegisterPage.module.css';

export const RegisterPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  // Если пользователь уже авторизован, перенаправляем на главную
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleRegister = async (data: RegisterRequest) => {
    setIsLoading(true);
    try {
      const response = await authApi.register(data);
      const { access_token, refresh_token, first_name, last_name } = response.data;
      
      // Создаем объект пользователя из ответа бэкенда
      const user = {
        id: 0,
        email: data.email,
        first_name: first_name,
        last_name: last_name
      };
      
      // Используем функцию login из AuthProvider для обновления состояния
      login(user, access_token, refresh_token);
      
      navigate('/');
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <RegisterForm onSubmit={handleRegister} isLoading={isLoading} />
        <div className={styles.footer}>
          <p className={styles.footerText}>
            Уже есть аккаунт?{' '}
            <Link to="/login" className={styles.link}>
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

