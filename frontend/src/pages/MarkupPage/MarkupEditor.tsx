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
import { getGraph } from '../../shared/api/graphApi';
import type { CommentInterface } from '../../shared/types/markupTypes';
import { postTriple } from '../../shared/api/generalApi';
import type { TripleSend } from '../../shared/types/graphTypes';
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
  const textContainerRef = useRef<HTMLDivElement>(null);

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

    // Загружаем subjects и predicates через getGraph
    try {
      const { data } = await getGraph();
      const loadedSubjects = Array.isArray(data.nodes) ? data.nodes.map((n: any) => n.label) : [];
      const loadedPredicates = Array.isArray(data.links) ? data.links.map((l: any) => l.predicate) : [];
      setSubjects(loadedSubjects.length > 0 ? loadedSubjects : MOCK_SUBJECTS);
      setPredicates(
        loadedPredicates.length > 0
          ? Array.from(new Set(loadedPredicates))
          : MOCK_PREDICATES
      );
    } catch (e) {
      setSubjects(MOCK_SUBJECTS);
      setPredicates(MOCK_PREDICATES);
    }

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

  // 1. Иерархическая связь: Субъект -> Предикат -> Объект
  const triple1: TripleSend = {
    subject: OntologyManager.generateNodeId(subject),
    predicate, 
    object: OntologyManager.generateNodeId(objectText)
  };
  
  try {
    await postTriple(triple1);
    console.log('Первый триплет (иерархия) успешно отправлен:', triple1);
  } catch (error) {
    console.error('Ошибка при отправке первого триплета:', error);
    alert("Первый триплет не удалось сохранить")
  }

  // 2. Тип объекта: Объект -> rdf:type -> rdfs:Class
  const triple2: TripleSend = {
    subject: OntologyManager.generateNodeId(objectText), 
    predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    object: "http://www.w3.org/2000/01/rdf-schema#Class"
  };

  try {
    await postTriple(triple2);
    console.log('Второй триплет (тип) успешно отправлен:', triple2);
  } catch (error) {
    console.error('Ошибка при отправке второго триплета:', error);
    alert("Второй триплет не удалось сохранить");
  }

  // 3. Лейбл объекта: Объект -> rdfs:label -> "название"
  const triple3: TripleSend = {
    subject: OntologyManager.generateNodeId(objectText), 
    predicate: "http://www.w3.org/2000/01/rdf-schema#label",
    object: `"${objectText}"`
  };

  try {
    await postTriple(triple3);
    console.log('Третий триплет (лейбл) успешно отправлен:', triple3);
  } catch (error) {
    console.error('Ошибка при отправке третьего триплета:', error);
    alert("Третий триплет не удалось сохранить");
  }

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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, marginTop: 16 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <FileHTMLToString onFileRead={handleFileRead} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
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
              marginRight: 0,
              position: 'relative',
              transition: 'background 0.2s',
            }}
          >
            {isSaving ? (
              <span className={styles.loader} />
            ) : (
              '💾'
            )}
          </button>
          {saveSuccess && (
            <span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: 18, marginTop: 8 }}>✔ Разметка успешно сохранена</span>
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