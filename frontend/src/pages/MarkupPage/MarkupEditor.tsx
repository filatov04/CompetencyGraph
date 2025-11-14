import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import type { FC, ReactNode } from 'react';
import styles from './MarkupEditor.module.css';
import { FileHTMLToString } from '../../features/FileHTMLToString/FileHTMLToString';
import { getMarkup, postMarkup } from '../../shared/api/markupApi';
import type { CommentInterface } from '../../shared/types/markupTypes';
import OntologyManager from '../../shared/types/OntologyManager';

const MOCK_SUBJECTS = ['Субъект 1', 'Субъект 2', 'Субъект 3', 'Другой Субъект'];
const MOCK_PREDICATES = ['является частью', 'имеет свойство', 'относится к', 'создан из'];

const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

interface SelectionData {
  startIndex: number;
  endIndex: number;
  rect: DOMRect;
}

interface HoveredCommentData {
  comment: CommentInterface;
  rect: DOMRect;
}

interface CommentInputPopupProps {
  position: { x: number; y: number };
  onSave: (subject: string, predicate: string) => void;
  onCancel: () => void;
  subjects: string[];
  predicates: string[];
}

const CommentInputPopup: FC<CommentInputPopupProps> = ({ position, onSave, onCancel, subjects, predicates }) => {
  const [subject, setSubject] = useState<string>(subjects[0] || '');
  const [predicate, setPredicate] = useState<string>(predicates[0] || '');

  useEffect(() => {
    setSubject(subjects[0] || '');
  }, [subjects]);
  useEffect(() => {
    setPredicate(predicates[0] || '');
  }, [predicates]);

  const handleSave = () => {
    if (subject && predicate) {
      onSave(subject, predicate);
    }
  };

  return (
    <div className={styles.commentPopup} style={{ top: position.y, left: position.x }}>
      <div className={styles.commentPopupSelects}>
        <label>
          <span>Субъект:</span>
          <select className={styles.commentPopupSelectsSelect} id='subject' value={subject} onChange={(e) => setSubject(e.target.value)}>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>
          <span>Предикат:</span>
          <select className={styles.commentPopupSelectsSelect} id='predicate' value={predicate} onChange={(e) => setPredicate(e.target.value)}>
            {predicates.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>
      <div className={styles.commentPopupActions}>
        <button onClick={handleSave}>Сохранить</button>
        <button onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
};


interface CommentTooltipProps {
  comment: CommentInterface;
  position: { x: number; y: number };
}

const CommentTooltip: FC<CommentTooltipProps> = ({ comment, position }) => {
  return (
    <div className={styles.commentTooltip} style={{ top: position.y, left: position.x }}>
      <div><strong>Субъект:</strong> {comment.subject}</div>
      <div><strong>Предикат:</strong> {comment.predicate}</div>
      <div><strong>Объект:</strong> {comment.object}</div>
    </div>
  );
};

interface MarkupEditorProps {}

const MarkupEditor: FC<MarkupEditorProps> = () => {
  const [comments, setComments] = useState<CommentInterface[]>([]);
  const [selection, setSelection] = useState<SelectionData | null>(null);
  const [hoveredComment, setHoveredComment] = useState<HoveredCommentData | null>(null);
  const [rawHtml, setRawHtml] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [subjects, setSubjects] = useState<string[]>(MOCK_SUBJECTS);
  const [predicates, setPredicates] = useState<string[]>(MOCK_PREDICATES);
  const [currentFilename, setCurrentFilename] = useState<string>('');
  const [loadedGraphNodes, setLoadedGraphNodes] = useState<any[]>([]);
  const [loadedGraphLinks, setLoadedGraphLinks] = useState<any[]>([]);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const graphFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileRead = async (content: string, filename?: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    setRawHtml(doc.body.innerHTML);
    setComments([]);
    setSelection(null);
    setHoveredComment(null);
    setSaveSuccess(false);

    // Генерируем filename если не предоставлен (используем timestamp или хеш)
    const fileIdentifier = filename || `file_${Date.now()}`;
    setCurrentFilename(fileIdentifier);

    // Загружаем существующие комментарии для этого файла
    try {
      const { data: loadedComments } = await getMarkup(fileIdentifier);
      if (Array.isArray(loadedComments) && loadedComments.length > 0) {
        const sortedComments = loadedComments.sort((a: CommentInterface, b: CommentInterface) => a.startIndex - b.startIndex);
        setComments(sortedComments);
        console.log('Загруженные комментарии:', sortedComments);
      } else {
        console.log('Комментарии для файла не найдены, начинаем с пустого списка');
      }
    } catch (error: any) {
      // Если комментарии не найдены (404), это нормально для нового файла
      if (error.response?.status === 404) {
        console.log('Файл новый, комментариев пока нет');
      } else {
        console.error('Ошибка при загрузке разметки:', error);
      }
    }
  };

  const handleGraphFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const jsonData = JSON.parse(content);

        if (!jsonData.nodes || !jsonData.links) {
          alert("Неверный формат файла. Ожидаются поля 'nodes' и 'links'.");
          return;
        }

        // Извлекаем субъекты из nodes (по полю label)
        const loadedSubjects = Array.isArray(jsonData.nodes)
          ? jsonData.nodes.map((n: any) => n.label).filter(Boolean)
          : [];

        // Извлекаем предикаты из links (по полю predicate, убираем дубликаты)
        const loadedPredicates = Array.isArray(jsonData.links)
          ? Array.from(new Set(jsonData.links.map((l: any) => l.predicate).filter(Boolean))) as string[]
          : [];

        // Обновляем состояния
        setSubjects(loadedSubjects.length > 0 ? loadedSubjects : MOCK_SUBJECTS);
        setPredicates(loadedPredicates.length > 0 ? loadedPredicates : MOCK_PREDICATES);
        
        // Сохраняем загруженный граф для последующего экспорта
        setLoadedGraphNodes(jsonData.nodes || []);
        setLoadedGraphLinks(jsonData.links || []);

        console.log('Загружены субъекты:', loadedSubjects);
        console.log('Загружены предикаты:', loadedPredicates);

        alert(`Граф успешно загружен!\nСубъектов: ${loadedSubjects.length}\nПредикатов: ${loadedPredicates.length}`);

        // Очищаем input
        if (graphFileInputRef.current) {
          graphFileInputRef.current.value = '';
        }
      } catch (error: any) {
        console.error('Ошибка при чтении файла графа:', error);
        alert(`Не удалось обработать файл: ${error.message || 'Неизвестная ошибка'}`);
      }
    };

    reader.readAsText(file);
  };

  const handleGraphUploadClick = () => {
    if (graphFileInputRef.current) {
      graphFileInputRef.current.click();
    }
  };

  const handleExportGraph = () => {
    if (comments.length === 0) {
      alert('Нет комментариев для экспорта');
      return;
    }

    // Создаем копии загруженных данных
    const exportNodes = [...loadedGraphNodes];
    const exportLinks = [...loadedGraphLinks];

    // Множества для отслеживания уже добавленных узлов и связей
    const existingNodeIds = new Set(exportNodes.map((n: any) => n.id));
    const existingNodeLabels = new Set(exportNodes.map((n: any) => n.label));

    // Обрабатываем каждый комментарий
    comments.forEach((comment) => {
      // Генерируем ID для субъекта, если его еще нет
      let subjectId = exportNodes.find((n: any) => n.label === comment.subject)?.id;
      if (!subjectId) {
        subjectId = OntologyManager.generateNodeId(comment.subject);
        if (!existingNodeIds.has(subjectId)) {
          exportNodes.push({
            id: subjectId,
            label: comment.subject,
            type: 'class'
          });
          existingNodeIds.add(subjectId);
          existingNodeLabels.add(comment.subject);
        }
      }

      // Генерируем ID для объекта (текст выделения)
      let objectId = exportNodes.find((n: any) => n.label === comment.object)?.id;
      if (!objectId) {
        objectId = OntologyManager.generateNodeId(comment.object);
        if (!existingNodeIds.has(objectId)) {
          exportNodes.push({
            id: objectId,
            label: comment.object,
            type: 'class'
          });
          existingNodeIds.add(objectId);
          existingNodeLabels.add(comment.object);
        }
      }

      // Находим или создаем ID предиката
      let predicateId = exportLinks.find((l: any) => l.predicate === comment.predicate)?.predicate;
      if (!predicateId) {
        // Предикат может быть как URI, так и label
        const predicateNode = exportNodes.find((n: any) => n.label === comment.predicate);
        predicateId = predicateNode?.id || comment.predicate;
      }

      // Добавляем связь субъект -> предикат -> объект
      const linkExists = exportLinks.some(
        (l: any) => l.source === subjectId && l.target === objectId && l.predicate === predicateId
      );

      if (!linkExists) {
        exportLinks.push({
          source: subjectId,
          target: objectId,
          predicate: predicateId
        });
      }
    });

    // Создаем JSON для экспорта
    const exportData = {
      nodes: exportNodes,
      links: exportLinks
    };

    // Скачиваем файл
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `graph_with_markup_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('Экспортированный граф:', exportData);
    alert(`Граф успешно экспортирован!\nУзлов: ${exportNodes.length}\nСвязей: ${exportLinks.length}`);
  };

  const handleMouseUp = (): void => {
    const currentSelection = window.getSelection();
    if (
      !currentSelection ||
      currentSelection.isCollapsed ||
      !textContainerRef.current
    ) {
      setSelection(null);
      return;
    }

    const range = currentSelection.getRangeAt(0);

    if (!textContainerRef.current.contains(range.commonAncestorContainer)) {
      return;
    }

    const getTextOffset = (node: Node, offset: number): number => {
      let textOffset = 0;
      const walker = document.createTreeWalker(
        textContainerRef.current!,
        NodeFilter.SHOW_TEXT,
        null
      );
      let currentNode = walker.nextNode();
      while (currentNode) {
        if (currentNode === node) {
          textOffset += offset;
          break;
        }
        textOffset += currentNode.textContent?.length || 0;
        currentNode = walker.nextNode();
      }
      return textOffset;
    };

    const startIndex = getTextOffset(range.startContainer, range.startOffset);
    const endIndex = getTextOffset(range.endContainer, range.endOffset);

    if (startIndex >= endIndex) {
      setSelection(null);
      return;
    }

    const isOverlapping = comments.some(
      (c) => startIndex < c.endIndex && endIndex > c.startIndex
    );

    if (isOverlapping) {
      alert(
        'Нельзя создавать комментарии, пересекающиеся с другими. Попробуйте выделить другой фрагмент.'
      );
      window.getSelection()?.removeAllRanges();
      return;
    }

    setSelection({
      startIndex,
      endIndex,
      rect: range.getBoundingClientRect(),
    });
  };

const handleSaveComment = async (
  subject: string,
  predicate: string
): Promise<void> => {
  if (!selection || !currentFilename) return;

  const objectText = textContainerRef.current?.textContent?.substring(selection.startIndex, selection.endIndex) || '';

  const newComment: CommentInterface = {
    id: Date.now(),
    startIndex: selection.startIndex,
    endIndex: selection.endIndex,
    subject,
    predicate,
    object: objectText,
    filename: currentFilename,
    createdAt: new Date().toISOString(),
    author: '',
  };

  setComments((prevComments) => {
    const updated = [...prevComments, newComment].sort((a, b) => a.startIndex - b.startIndex);
    console.log('Комментарии:', updated);
    return updated;
  });

  setSelection(null);
  window.getSelection()?.removeAllRanges();
};
  const handleSaveMarkup = async () => {
    if (!currentFilename) {
      alert('Сначала загрузите файл');
      return;
    }

    if (comments.length === 0) {
      alert('Нет комментариев для сохранения');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);
    try {
      // Отправляем только новые комментарии (без id или с временным id)
      const commentsToSave = comments
        .filter(c => !c.id || c.id > 1000000000000)
        .map(c => ({
          filename: c.filename,
          startIndex: c.startIndex,
          endIndex: c.endIndex,
          subject: c.subject,
          predicate: c.predicate,
          object: c.object,
          // Не отправляем id, author и createdAt - они будут установлены бэкендом
        }));
      
      console.log('Комментарии для сохранения:', commentsToSave);
      
      if (commentsToSave.length > 0) {
        const { data: savedComments } = await postMarkup(commentsToSave);
        
        // Обновляем комментарии с реальными ID от бэкенда
        setComments(prevComments => {
          const updatedComments = [...prevComments];
          const tempComments = prevComments.filter(c => !c.id || c.id > 1000000000000);
          
          tempComments.forEach((tempComment, index) => {
            const idx = updatedComments.findIndex(c => c.id === tempComment.id);
            if (idx !== -1 && savedComments[index]) {
              updatedComments[idx] = savedComments[index];
            }
          });
          return updatedComments.sort((a, b) => a.startIndex - b.startIndex);
        });
        
        setSaveSuccess(true);
        console.log('Разметка успешно сохранена:', savedComments);
      } else {
        alert('Все комментарии уже сохранены');
      }
    } catch (e: any) {
      setSaveSuccess(false);
      console.error('Ошибка при сохранении разметки:', e);
      console.error('Response data:', e.response?.data);
      console.error('Response status:', e.response?.status);
      
      // Показываем более детальную информацию об ошибке
      const errorMessage = e.response?.data?.detail || e.message || 'Неизвестная ошибка';
      alert(`Ошибка при сохранении разметки: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const renderedHtml = useMemo(() => {
    if (!rawHtml) {
      return null;
    }

    const root = new DOMParser().parseFromString(rawHtml, 'text/html').body;
    let textOffset = 0;

    const highlightNodes = (node: Node): ReactNode => {
      if (node.nodeType === Node.TEXT_NODE) {
        const nodeText = node.textContent || '';
        const segments: ReactNode[] = [];
        let lastIndex = 0;

        const relevantComments = comments
          .filter(
            (c) =>
              c.startIndex < textOffset + nodeText.length &&
              c.endIndex > textOffset
          )
          .sort((a, b) => a.startIndex - b.startIndex);

        relevantComments.forEach((comment) => {
          const start = Math.max(0, comment.startIndex - textOffset);
          const end = Math.min(nodeText.length, comment.endIndex - textOffset);

          if (start > lastIndex) {
            segments.push(nodeText.substring(lastIndex, start));
          }
          if (end > start) {
            segments.push(
              <span
                key={comment.id}
                className={styles.highlightedText}
                data-comment-id={comment.id}
              >
                {nodeText.substring(start, end)}
              </span>
            );
          }
          lastIndex = Math.max(lastIndex, end);
        });

        if (lastIndex < nodeText.length) {
          segments.push(nodeText.substring(lastIndex));
        }
        textOffset += nodeText.length;
        return <>{segments}</>;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const nodeName = node.nodeName.toLowerCase();
        
        const props: { [key: string]: any } = {};
        for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            const propName = attr.name === 'class' ? 'className' : attr.name;
            if (propName === 'style') {
                const styleObj: {[key: string]: string} = {};
                attr.value.split(';').forEach(style => {
                    const [key, value] = style.split(':');
                    if (key && value) {
                      const camelCasedKey = key.trim().replace(/-./g, c => c.substring(1).toUpperCase());
                      styleObj[camelCasedKey] = value.trim();
                    }
                });
                props.style = styleObj;
            } else {
                 props[propName] = attr.value;
            }
        }

        if (VOID_ELEMENTS.has(nodeName)) {
            return React.createElement(nodeName, props);
        }

        const children = Array.from(node.childNodes).map((child, i) => (
          <React.Fragment key={i}>{highlightNodes(child)}</React.Fragment>
        ));

        return React.createElement(nodeName, props, children);
      }
      return null;
    };

    return Array.from(root.childNodes).map((node, i) => (
        <React.Fragment key={i}>{highlightNodes(node)}</React.Fragment>
    ));
  }, [rawHtml, comments]);


  useEffect(() => {
    const container = textContainerRef.current;
    if (!container) return;

    const handleMouseEnter = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement;
      const highlightSpan = target.closest(`.${styles.highlightedText}`) as HTMLElement;

      if (highlightSpan) {
        const commentId = Number(highlightSpan.dataset.commentId);
        const comment = comments.find((c) => c.id === commentId);
        if (comment) {
          setHoveredComment({
            comment,
            rect: highlightSpan.getBoundingClientRect(),
          });
        }
      }
    };

    const handleMouseLeave = (event: globalThis.MouseEvent) => {
       const target = event.target as HTMLElement;
       if (target.closest(`.${styles.highlightedText}`)){
           setHoveredComment(null);
       }
    };

    container.addEventListener('mouseover', handleMouseEnter);
    container.addEventListener('mouseout', handleMouseLeave);

    return () => {
      container.removeEventListener('mouseover', handleMouseEnter);
      container.removeEventListener('mouseout', handleMouseLeave);
    };
  }, [comments]);


  return (
    <div className={styles.commentableContainer}>
      <input
        type="file"
        ref={graphFileInputRef}
        onChange={handleGraphFileUpload}
        accept=".json,application/json"
        style={{ display: 'none' }}
      />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, marginTop: 16 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <FileHTMLToString onFileRead={handleFileRead} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleGraphUploadClick}
              style={{
                padding: '8px 16px',
                height: 48,
                borderRadius: 12,
                background: '#3498db',
                color: 'white',
                border: 'none',
                fontSize: 14,
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'background 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#2980b9')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#3498db')}
              title="Загрузить JSON с графом для субъектов и предикатов"
            >
              📊 Загрузить граф
            </button>
            <button
              onClick={handleSaveMarkup}
              disabled={isSaving}
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: '#27ae60',
                color: 'white',
                border: 'none',
                fontSize: 24,
                fontWeight: 'bold',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                position: 'relative',
                transition: 'background 0.2s',
              }}
              title="Сохранить разметку"
            >
              {isSaving ? (
                <span className={styles.loader} />
              ) : (
                '💾'
              )}
            </button>
            <button
              onClick={handleExportGraph}
              disabled={comments.length === 0}
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: comments.length === 0 ? '#95a5a6' : '#9b59b6',
                color: 'white',
                border: 'none',
                fontSize: 24,
                fontWeight: 'bold',
                cursor: comments.length === 0 ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
              title="Скачать граф с комментариями"
              onMouseEnter={(e) => {
                if (comments.length > 0) {
                  e.currentTarget.style.background = '#8e44ad';
                }
              }}
              onMouseLeave={(e) => {
                if (comments.length > 0) {
                  e.currentTarget.style.background = '#9b59b6';
                }
              }}
            >
              📥
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#7f8c8d', textAlign: 'right', maxWidth: 300 }}>
            📊 Загрузить граф → 💾 Сохранить разметку → 📥 Скачать обновленный граф
          </div>
          {saveSuccess && (
            <span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: 18 }}>✔ Разметка успешно сохранена</span>
          )}
        </div>
      </div>
      <div
        ref={textContainerRef}
        className={styles.textContent}
        onMouseUp={handleMouseUp}
      >
        {renderedHtml}
      </div>

      {selection && (
        <CommentInputPopup
          position={{
            x: selection.rect.left,
            y: selection.rect.bottom + window.scrollY + 5,
          }}
          onSave={handleSaveComment}
          onCancel={() => setSelection(null)}
          subjects={subjects}
          predicates={predicates}
        />
      )}

      {hoveredComment && (
        <CommentTooltip
          comment={hoveredComment.comment}
          position={{
            x: hoveredComment.rect.left,
            y: hoveredComment.rect.bottom + window.scrollY + 5,
          }}
        />
      )}
    </div>
  );
};

export { MarkupEditor };