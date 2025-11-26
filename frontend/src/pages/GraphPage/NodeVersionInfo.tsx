import React, { useEffect, useState } from 'react';
import { getNodeVersion, getNodeHistory, type NodeVersion, type NodeHistoryItem, type UserInfo } from '../../shared/api/versionApi';
import styles from './NodeVersionInfo.module.css';

interface NodeVersionInfoProps {
  nodeId: string;
  onClose: () => void;
}

const NodeVersionInfo: React.FC<NodeVersionInfoProps> = ({ nodeId, onClose }: NodeVersionInfoProps) => {
  const [version, setVersion] = useState<NodeVersion | null>(null);
  const [history, setHistory] = useState<NodeHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Функция для форматирования имени в формат "Фамилия И.О."
  const formatUserName = (user: UserInfo | null): string => {
    if (!user || !user.first_name || !user.last_name) {
      return 'Неизвестный пользователь';
    }

    // Разбиваем first_name на части (может содержать "Имя Отчество")
    const nameParts = user.first_name.trim().split(/\s+/);
    const firstNameInitial = nameParts[0]?.charAt(0).toUpperCase() || '';
    const middleNameInitial = nameParts[1]?.charAt(0).toUpperCase() || '';

    // Формат: "Фамилия И.О." или "Фамилия И." если нет отчества
    if (middleNameInitial) {
      return `${user.last_name} ${firstNameInitial}.${middleNameInitial}.`;
    }
    return `${user.last_name} ${firstNameInitial}.`;
  };

  useEffect(() => {
    const fetchVersionInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const versionData = await getNodeVersion(nodeId);
        setVersion(versionData);
      } catch (err) {
        console.error('Error fetching version:', err);
        setError('Не удалось загрузить информацию о версии');
      } finally {
        setLoading(false);
      }
    };

    fetchVersionInfo();
  }, [nodeId]);

  const fetchHistory = async () => {
    if (history.length > 0) {
      setShowHistory(!showHistory);
      return;
    }

    try {
      const historyData = await getNodeHistory(nodeId, 20);
      setHistory(historyData);
      setShowHistory(true);
    } catch (err) {
      console.error('Error fetching history:', err);
      setError('Не удалось загрузить историю изменений');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getChangeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CREATE: 'Создание',
      UPDATE: 'Изменение',
      DELETE: 'Удаление'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className={styles.versionInfo}>
        <div className={styles.header}>
          <h3>Информация о версии</h3>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        <div className={styles.loading}>Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.versionInfo}>
        <div className={styles.header}>
          <h3>Информация о версии</h3>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.versionInfo}>
      <div className={styles.header}>
        <h3>Информация о версии</h3>
        <button onClick={onClose} className={styles.closeButton}>×</button>
      </div>

      <div className={styles.content}>
        <div className={styles.versionBlock}>
          <div className={styles.versionLabel}>Текущая версия:</div>
          <div className={styles.versionNumber}>v{version?.version || 0}</div>
        </div>

        {version?.last_modified && (
          <div className={styles.modifiedBlock}>
            <div className={styles.label}>Последнее изменение:</div>
            <div className={styles.value}>{formatDate(version.last_modified)}</div>
          </div>
        )}

        {version?.last_modified_by && (
          <div className={styles.modifiedBlock}>
            <div className={styles.label}>Автор изменения:</div>
            <div className={styles.value}>{formatUserName(version.last_modified_by)}</div>
          </div>
        )}

        <button
          onClick={fetchHistory}
          className={styles.historyButton}
          disabled={version?.version === 0}
        >
          {showHistory ? 'Скрыть историю' : 'Показать историю изменений'}
        </button>

        {showHistory && history.length > 0 && (
          <div className={styles.historyList}>
            <h4>История изменений:</h4>
            {history.map((item: NodeHistoryItem) => (
              <div key={item.id} className={styles.historyItem}>
                <div className={styles.historyHeader}>
                  <span className={styles.historyVersion}>v{item.version}</span>
                  <span className={styles.historyType}>
                    {getChangeTypeLabel(item.change_type)}
                  </span>
                  <span className={styles.historyDate}>
                    {formatDate(item.changed_at)}
                  </span>
                </div>
                <div className={styles.historyUser}>
                  Автор: {formatUserName(item.user)}
                </div>
                {item.old_value && (
                  <div className={styles.historyValue}>
                    <strong>Было:</strong> {JSON.stringify(item.old_value, null, 2)}
                  </div>
                )}
                {item.new_value && (
                  <div className={styles.historyValue}>
                    <strong>Стало:</strong> {JSON.stringify(item.new_value, null, 2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {showHistory && history.length === 0 && (
          <div className={styles.noHistory}>История изменений пуста</div>
        )}
      </div>
    </div>
  );
};

export default NodeVersionInfo;
