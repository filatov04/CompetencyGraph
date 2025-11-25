import React, { useRef, useState } from "react";

interface FileHTMLToStringProps {
  onFileRead: (content: string, filename?: string) => void;
}

const FileHTMLToString: React.FC<FileHTMLToStringProps> = ({ onFileRead }) => {
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    setProgress(0);
    if (!file) {
      setFileName("");
      return;
    }
    if (!file.name.endsWith('.html')) {
      setError('Пожалуйста, выберите файл с расширением .html');
      setFileName("");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    reader.onload = () => {
      setProgress(100);
      if (typeof reader.result === 'string') {
        // Передаем содержимое файла и его имя
        onFileRead(reader.result, file.name);
      }
    };
    reader.onerror = () => {
      setError('Ошибка при чтении файла');
    };
    reader.readAsText(file);
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <input
        ref={inputRef}
        type="file"
        accept=".html"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button
        onClick={handleButtonClick}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          fontWeight: '500',
          color: '#fff',
          backgroundColor: '#007aff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          minWidth: '150px',
        }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#0056b3')}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#007aff')}
      >
        Выбрать файл
      </button>
      <span style={{ 
        fontSize: '14px', 
        color: fileName ? '#333' : '#999',
        fontWeight: fileName ? '500' : '400',
      }}>
        {fileName || 'Файл не выбран'}
      </span>
      {progress > 0 && progress < 100 && (
        <div style={{ fontSize: '14px', color: '#007aff', fontWeight: '500' }}>
          Загрузка: {progress}%
        </div>
      )}
      {error && (
        <div style={{ fontSize: '14px', color: '#dc3545', fontWeight: '500' }}>
          {error}
        </div>
      )}
    </div>
  );
};

export { FileHTMLToString };
