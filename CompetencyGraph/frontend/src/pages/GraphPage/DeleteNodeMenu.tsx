import React, { useState } from 'react';
import styles from './GraphPage.module.css';
import { type OntologyNode } from '../../shared/types/OntologyManager';
import OntologyManager from '../../shared/types/OntologyManager';


interface DeleteNodeMenuProps {
  onClose: () => void;
  triples: {
    subject: string;
    predicate: string;
    object: string;
    subjectUri: string;
    predicateUri: string;
    objectUri: string;
  }[];
  onUpdate: (node: OntologyNode, newLabel: string) => void;
  node: OntologyNode;
}

export const DeleteNodeMenu: React.FC<DeleteNodeMenuProps> = ({
  onClose,
  triples,
  onUpdate,
  node,
}) => {

  const [selectedTriples, setSelectedTriples] = useState<Set<number>>(new Set());

  const toggleTriple = (index: number) => {
    const newSelected = new Set(selectedTriples);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTriples(newSelected);
  };

  const handleDeleteTriples = () => {
    if (selectedTriples.size === 0) {
      alert('Выберите хотя бы одну связь для удаления');
      return;
    }

    try {
      const triplesToDelete = Array.from(selectedTriples).map(index => triples[index]);

      // Удаляем только локально, без отправки на сервер
      for (const triple of triplesToDelete) {
        console.log(`Удаление связи локально: ${triple.subjectUri} -> ${triple.predicateUri} -> ${triple.objectUri}`);

        // Удаляем связь только из OntologyManager
        OntologyManager.removeLink(triple.subjectUri, triple.objectUri, triple.predicateUri);
      }

      alert(`Удалено связей: ${triplesToDelete.length}. Нажмите "Сохранить" для применения изменений.`);
      onUpdate(node, node.label);
      onClose();
    } catch (error) {
      console.error('Ошибка при удалении связей:', error);
      alert('Произошла ошибка при удалении связей');
    }
  };

  const handleDeleteNode = () => {
    console.log('Удаление узла локально:', node.id);
    // Удаляем узел только локально из памяти
    OntologyManager.deleteNode(node.id);
    onUpdate(node, node.label); // Обновляем граф
    alert('Узел удалён локально. Нажмите "Сохранить" для применения изменений.');
    onClose(); // Закрываем окно
  };

 return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.deleteModalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.deleteModalHeader}>
          <h3>Удаление связей узла "{node.label}"</h3>
          <button onClick={onClose} className={styles.closeButton}>
            &times;
          </button>
        </div>

        <div className={styles.deleteModalBody}>
          {triples.length > 0 ? (
            <>
              <p>Выберите связи для удаления (узлы останутся):</p>
              <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                💡 После удаления нажмите "Сохранить" в главном меню
              </p>
              <div className={styles.affectedTriples}>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {triples.map((triple, index) => (
                    <li
                      key={index}
                      style={{
                        padding: '8px',
                        margin: '4px 0',
                        backgroundColor: selectedTriples.has(index) ? '#ffebee' : '#f5f5f5',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      onClick={() => toggleTriple(index)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTriples.has(index)}
                        onChange={() => toggleTriple(index)}
                        style={{ marginRight: '8px' }}
                      />
                      <span style={{ fontSize: '12px' }}>
                        {triple.subject} → {triple.predicate} → {triple.object}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <>
              <p>У узла "{node.label}" нет связей.</p>
              <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                ✅ Узел изолирован и может быть удалён
              </p>
            </>
          )}
        </div>

        <div className={styles.deleteModalFooter}>
          <button onClick={onClose} className={styles.cancelButton}>
            Отмена
          </button>
          {triples.length > 0 ? (
            <button
              onClick={handleDeleteTriples}
              className={styles.saveButton}
              disabled={selectedTriples.size === 0}
            >
              Удалить связи ({selectedTriples.size})
            </button>
          ) : (
            <button
              onClick={handleDeleteNode}
              className={styles.deleteButton}
            >
              Удалить узел
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
