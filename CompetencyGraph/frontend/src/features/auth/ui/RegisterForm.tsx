import { useState } from 'react';
import type { FormEvent } from 'react';
import type { RegisterRequest } from '../../../shared/types/authTypes';
import { Input, Button } from '../../../shared/ui';
import styles from './AuthForm.module.css';

interface RegisterFormProps {
  onSubmit: (data: RegisterRequest) => Promise<void>;
  isLoading?: boolean;
}

export const RegisterForm = ({ onSubmit, isLoading = false }: RegisterFormProps) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError('Пожалуйста, заполните все поля');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    try {
      await onSubmit({ 
        first_name: firstName, 
        last_name: lastName, 
        email, 
        password 
      });
    } catch (err: any) {
      // Показываем детальное сообщение от сервера, если оно есть
      const errorMessage = err?.response?.data?.detail || 
                          err?.response?.data?.message ||
                          err?.message ||
                          'Ошибка регистрации. Возможно, пользователь уже существует';
      setError(errorMessage);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 className={styles.title}>Регистрация</h2>
      
      {error && <div className={styles.error}>{error}</div>}
      
      <div className={styles.field}>
        <label htmlFor="firstName" className={styles.label}>
          Имя
        </label>
        <Input
          id="firstName"
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Иван"
          disabled={isLoading}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="lastName" className={styles.label}>
          Фамилия
        </label>
        <Input
          id="lastName"
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Иванов"
          disabled={isLoading}
        />
      </div>

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

      <div className={styles.field}>
        <label htmlFor="confirmPassword" className={styles.label}>
          Подтверждение пароля
        </label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          disabled={isLoading}
        />
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
      </Button>
    </form>
  );
};

