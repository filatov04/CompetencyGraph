import { useState } from 'react';
import type { FormEvent } from 'react';
import type { LoginRequest } from '../../../shared/types/authTypes';
import { Input, Button } from '../../../shared/ui';
import styles from './AuthForm.module.css';

interface LoginFormProps {
  onSubmit: (credentials: LoginRequest) => Promise<void>;
  isLoading?: boolean;
}

export const LoginForm = ({ onSubmit, isLoading = false }: LoginFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Пожалуйста, заполните все поля');
      return;
    }

    try {
      await onSubmit({ email, password });
    } catch (err: any) {
      // Показываем детальное сообщение от сервера, если оно есть
      const errorMessage = err?.response?.data?.detail || 
                          err?.response?.data?.message ||
                          err?.message ||
                          'Ошибка входа. Проверьте email и пароль';
      setError(errorMessage);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 className={styles.title}>Вход в систему</h2>
      
      {error && <div className={styles.error}>{error}</div>}
      
      <div className={styles.field}>
        <label htmlFor="email" className={styles.label}>
          Email
        </label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="m1234567@misis.ru"
          disabled={isLoading}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="password" className={styles.label}>
          Пароль
        </label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          disabled={isLoading}
        />
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Вход...' : 'Войти'}
      </Button>
    </form>
  );
};

