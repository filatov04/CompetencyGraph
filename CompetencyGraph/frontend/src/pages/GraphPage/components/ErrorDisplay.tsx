import React from 'react';
import styles from './ErrorDisplay.module.css';

interface ErrorDisplayProps {
  error: string;
  onRetry: () => void;
  onUploadFile: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onRetry, onUploadFile }) => {
  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorIcon}>⚠️</div>
      <h3 className={styles.errorTitle}>Ошибка загрузки</h3>
      <p className={styles.errorMessage}>{error}</p>
      <button onClick={onRetry} className={styles.retryButton}>
        🔄 Повторить попытку
      </button>
      <div className={styles.uploadButtonWrapper}>
        <button onClick={onUploadFile} className={styles.uploadButton}>
          📁 Загрузить граф из файла
        </button>
      </div>
    </div>
  );
};

