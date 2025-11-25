import React from 'react';
import styles from './LoadingSpinner.module.css';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className={styles.loadingContainer}>
      <div className={styles.spinnerWrapper}>
        <img 
          src="/misis-logo.png" 
          alt="Loading" 
          className={styles.logo}
        />
      </div>
      <div className={styles.loadingText}>
        Загрузка графа компетенций...
      </div>
    </div>
  );
};

