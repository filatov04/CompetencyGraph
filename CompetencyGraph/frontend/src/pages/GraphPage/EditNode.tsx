import React, { useState } from 'react';
import styles from './GraphPage.module.css';
import OntologyManager, { type OntologyNode } from '../../shared/types/OntologyManager';

interface EditNodeProps {
  onClose: () => void;
  currentNode: OntologyNode;
  onUpdate: (node: OntologyNode, newLabel: string) => void;

}

export const EditNode: React.FC<EditNodeProps> = ({
  onClose,
  currentNode,
  onUpdate,
}) => {
  const [editedLabel, setEditedLabel] = useState(currentNode.label);


const triples = OntologyManager.getAllTriplesWithNode(currentNode.label);

  const handleSubmitNodeName = (e: React.FormEvent) => {
    e.preventDefault();
    if (editedLabel.trim() !== currentNode.label) {
      onUpdate(currentNode, editedLabel); 
    }

  };

const handleSubmitTriple = () => {
    onClose();
  };
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button 
          onClick={onClose} 
          className={styles.closeButton}
          aria-label="Закрыть"
        >
          &times;
        </button>

        <div className = {styles.editMenuHeader}>
            <h3>Редактирование узла</h3>
        </div>

        <form onSubmit={handleSubmitNodeName} className={styles.editForm}>
          <div className={styles.formRow}>
            <span className={styles.label}>Название узла:</span>
            <input
              type="text"
              value={editedLabel}
              onChange={(e) => setEditedLabel(e.target.value)}
              className={styles.editInput}
              autoFocus
            />
            <button type="submit" className={styles.saveButton}>
              Сохранить
            </button>
          </div>
        </form>

        <div className = {styles.editMenuHeader}>
            <h3>Связанные триплеты</h3>
        </div>

        <div className = {styles.tripleContainer}>
            <form onSubmit={handleSubmitTriple} className = {styles.editForm}>
                <div className={styles.formRow}>
                    


                        {triples.length > 0 ? (
                        <ul className={styles.triplesListEditMode}>
                            {triples.map((triple, index) => (
                                <div key={index} className={styles.tripleItemEditMode}>
                                    <input
                                        type="text"
                                        value={triple.subject}
                                        onChange={(e) => setEditedLabel(e.target.value)}
                                        className={styles.tripleSubjectEditMode}
                                        autoFocus
                                    />
                                     <input
                                        type="text"
                                        value={triple.predicate}
                                        onChange={(e) => setEditedLabel(e.target.value)}
                                        className={styles.triplePredicateEditMode}
                                        autoFocus
                                    />

                                     <input
                                        type="text"
                                        value={triple.object}
                                        onChange={(e) => setEditedLabel(e.target.value)}
                                        className={styles.tripleObjectEditMode}
                                        autoFocus
                                    />
                                    
                                    <button type="submit" className={styles.saveButton}>
                                        Сохранить
                                    </button>


                                </div>
                            ))}
                        </ul>
                    ) : (
                        <p>Нет связанных триплетов</p>
                    )}
                </div> 


            </form>
        </div>
        
      </div>
    </div>
  );
};