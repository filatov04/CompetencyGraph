import React, { useState, useMemo, useEffect } from 'react';
import styles from './GraphPage.module.css';

interface NewTripleMenuProps {
  onClose: () => void;
  subjects: string[];
  predicates: string[];
  objects: string[];
  onAddPredicate: (newPredicate: string) => void;
  onAddObject: (newObject: string) => { label: string; type?: string; children: any[] };
  onAddTriple: (subject: string, predicate: string, object: string) => void;
}

export const NewTripleMenu: React.FC<NewTripleMenuProps> = ({
  onClose,
  subjects,
  predicates: initialPredicates,
  objects: initialObjects,
  onAddPredicate,
  onAddObject,
  onAddTriple
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedPredicate, setSelectedPredicate] = useState<string | null>(null);
  const [selectedObject, setSelectedObject] = useState<string | null>(null);

  const [isDropdownSubOpen, setIsDropDownSubOpen] = useState(false);
  const [isDropdownOpen, setIsDropDownOpen] = useState(false);
  const [isDropdownObjOpen, setIsDropDownObjOpen] = useState(false);

  const [newPredicate, setNewPredicate] = useState('');
  const [newObject, setNewObject] = useState('');
  const [error, setError] = useState('');

  const allItems = useMemo(() => {
    const merged = [...subjects, ...initialPredicates, ...initialObjects];
    const cleaned = merged.map((x) => x.split(/[#/]/).pop() || x); 
    return Array.from(new Set(cleaned)); 
  }, [subjects, initialPredicates, initialObjects]);

  const [subjectSearch, setSubjectSearch] = useState('');
  const [predicateSearch, setPredicateSearch] = useState('');
  const [objectSearch, setObjectSearch] = useState('');

  const filteredSubjects = useMemo(() => {
    return allItems.filter((x) => x.toLowerCase().includes(subjectSearch.toLowerCase()));
  }, [allItems, subjectSearch]);

  const filteredPredicates = useMemo(() => {
    return allItems.filter((x) => x.toLowerCase().includes(predicateSearch.toLowerCase()));
  }, [allItems, predicateSearch]);

  const filteredObjects = useMemo(() => {
    return allItems.filter((x) => x.toLowerCase().includes(objectSearch.toLowerCase()));
  }, [allItems, objectSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(`.${styles.scrollableDropdownMenu}`) &&
        !target.closest(`.${styles.predicateDropdownTrigger}`)
      ) {
        setIsDropDownSubOpen(false);
        setIsDropDownOpen(false);
        setIsDropDownObjOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSubmitPredicate = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = newPredicate.trim();
    if (!trimmed) return setError('Введите название предиката');

    const shortName = trimmed.split(/[#/]/).pop()!;
    if (allItems.includes(shortName)) return setError('Такой предикат уже существует');

    onAddPredicate(shortName);
    setNewPredicate('');
    setError('');
    setSelectedPredicate(shortName);
  };

  const handleSubmitObject = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = newObject.trim();
    if (!trimmed) return setError('Введите название объекта');

    try {
      const addedNode = onAddObject(trimmed);
      if (!addedNode) throw new Error('Не удалось добавить узел');

      const shortName = addedNode.label.split(/[#/]/).pop()!;
      setNewObject('');
      setError('');
      setSelectedObject(shortName);
    } catch (error) {
      console.error('Ошибка добавления:', error);
      setError('Ошибка при создании объекта');
    }
  };

  const handleApply = () => {
    if (selectedSubject && selectedPredicate && selectedObject) {
      onAddTriple(selectedSubject, selectedPredicate, selectedObject);
      onClose();
    } else {
      setError('Выберите субъект, предикат и объект');
    }
  };
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className={styles.closeButton} aria-label="Закрыть">
          &times;
        </button>

        <div className={styles.contentArea}>
          <div className={styles.rectContainer}>
            <div className={styles.rectRow}>

              {/* Субъект */}
              <div className={styles.smallRect}>
                <h3 className={styles.rectTitle}>Субъект</h3>
                <div className={styles.predicateDropdownContainer}>
                  <div
                    className={styles.predicateDropdownTrigger}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDropDownSubOpen((p) => !p);
                      setSubjectSearch('');
                      setIsDropDownOpen(false);
                      setIsDropDownObjOpen(false);
                    }}
                  >
                    {selectedSubject || 'Выберите субъект'}
                    <span className={styles.arrow}>{isDropdownSubOpen ? '▲' : '▼'}</span>
                  </div>

                  {isDropdownSubOpen && (
                    <div className={styles.scrollableDropdownMenu}>
                      <input
                        type="text"
                        placeholder="Поиск..."
                        className={styles.searchInput}
                        value={subjectSearch}
                        onChange={(e) => setSubjectSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                      {filteredSubjects.length > 0 ? (
                        filteredSubjects.map((subject) => (
                          <div
                            key={subject}
                            className={`${styles.predicateOption} ${
                              selectedSubject === subject ? styles.selected : ''
                            }`}
                            onClick={() => {
                              setSelectedSubject(subject);
                              setIsDropDownSubOpen(false);
                            }}
                          >
                            {subject}
                          </div>
                        ))
                      ) : (
                        <div className={styles.noItems}>Ничего не найдено</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Предикат */}
              <div className={styles.smallRect}>
                <h3 className={styles.rectTitle}>Предикат</h3>
                <div className={styles.predicateDropdownContainer}>
                  <div
                    className={styles.predicateDropdownTrigger}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDropDownOpen((p) => !p);
                      setPredicateSearch('');
                      setIsDropDownSubOpen(false);
                      setIsDropDownObjOpen(false);
                    }}
                  >
                    {selectedPredicate || 'Выберите предикат'}
                    <span className={styles.arrow}>{isDropdownOpen ? '▲' : '▼'}</span>
                  </div>

                  {isDropdownOpen && (
                    <div className={styles.scrollableDropdownMenu}>
                      <input
                        type="text"
                        placeholder="Поиск..."
                        className={styles.searchInput}
                        value={predicateSearch}
                        onChange={(e) => setPredicateSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                      {filteredPredicates.length > 0 ? (
                        filteredPredicates.map((predicate) => (
                          <div
                            key={predicate}
                            className={`${styles.predicateOption} ${
                              selectedPredicate === predicate ? styles.selected : ''
                            }`}
                            onClick={() => {
                              setSelectedPredicate(predicate);
                              setIsDropDownOpen(false);
                            }}
                          >
                            {predicate}
                          </div>
                        ))
                      ) : (
                        <div className={styles.noItems}>Ничего не найдено</div>
                      )}
                    </div>
                  )}
                </div>

                <form onSubmit={handleSubmitPredicate} className={styles.predicateForm}>
                  <input
                    type="text"
                    value={newPredicate}
                    onChange={(e) => {
                      setError('');
                      setNewPredicate(e.target.value);
                    }}
                    placeholder="Новый предикат"
                    className={styles.predicateInput}
                  />
                  <button type="submit" className={styles.addPredicateButton}>
                    Добавить
                  </button>
                </form>
              </div>

              {/* Объект */}
              <div className={styles.smallRect}>
                <h3 className={styles.rectTitle}>Объект</h3>
                <div className={styles.predicateDropdownContainer}>
                  <div
                    className={styles.predicateDropdownTrigger}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDropDownObjOpen((p) => !p);
                      setObjectSearch('');
                      setIsDropDownOpen(false);
                      setIsDropDownSubOpen(false);
                    }}
                  >
                    {selectedObject || 'Выберите объект'}
                    <span className={styles.arrow}>{isDropdownObjOpen ? '▲' : '▼'}</span>
                  </div>

                  {isDropdownObjOpen && (
                    <div className={styles.scrollableDropdownMenu}>
                      <input
                        type="text"
                        placeholder="Поиск..."
                        className={styles.searchInput}
                        value={objectSearch}
                        onChange={(e) => setObjectSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                      {filteredObjects.length > 0 ? (
                        filteredObjects.map((object) => (
                          <div
                            key={object}
                            className={`${styles.predicateOption} ${
                              selectedObject === object ? styles.selected : ''
                            }`}
                            onClick={() => {
                              setSelectedObject(object);
                              setIsDropDownObjOpen(false);
                            }}
                          >
                            {object}
                          </div>
                        ))
                      ) : (
                        <div className={styles.noItems}>Ничего не найдено</div>
                      )}
                    </div>
                  )}
                </div>

                <form onSubmit={handleSubmitObject} className={styles.predicateForm}>
                  <input
                    type="text"
                    value={newObject}
                    onChange={(e) => {
                      setError('');
                      setNewObject(e.target.value);
                    }}
                    placeholder="Новый объект"
                    className={styles.predicateInput}
                  />
                  <button type="submit" className={styles.addPredicateButton}>
                    Добавить
                  </button>
                </form>
              </div>
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            onClick={handleApply}
            className={styles.addButton}
            disabled={!selectedSubject || !selectedPredicate || !selectedObject}
          >
            Применить
          </button>
        </div>
      </div>
    </div>
  );
};
