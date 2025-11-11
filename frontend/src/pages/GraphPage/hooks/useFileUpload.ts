import { useCallback, type RefObject } from 'react';
import OntologyManager, { type NodeType } from '../../../shared/types/OntologyManager';
import { postGraph, type GraphData } from '../../../shared/api/graphApi';

export const useFileUpload = (
  fileInputRef: RefObject<HTMLInputElement | null>,
  updateDataFromManager: () => void
) => {
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
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

        console.log('%c[useFileUpload] Загружаю файл...', 'color: cyan; font-weight: bold');
        OntologyManager.clear();

        jsonData.nodes.forEach((node: any) => {
          let normalizedType: NodeType = 'literal';
          if (node.type?.includes('Class')) normalizedType = 'class';
          else if (node.type?.includes('Property')) normalizedType = 'property';

          OntologyManager.addNode({
            id: node.id,
            label: node.label,
            type: normalizedType,
            children: []
          });
        });
        jsonData.links.forEach((link: any) => {
          OntologyManager.addLink(link.source, link.target, link.predicate);
        });
        const allNodes = OntologyManager.getAllNodes();
        const allLinks = OntologyManager.getAllLinks();
        console.log('%c[useFileUpload] Загружено в OntologyManager:', 'color: lime; font-weight: bold', {
          nodes: allNodes.length,
          links: allLinks.length
        });

        updateDataFromManager();

        const nodesToSave = allNodes.map(({ children, ...rest }) => rest);
        const graphData: GraphData = {
          nodes: nodesToSave,
          links: allLinks,
        };

        console.log('%c[useFileUpload] Отправляю на сервер:', 'color: orange; font-weight: bold', graphData);
        const response = await postGraph(graphData);
        console.log('%c[useFileUpload] Ответ сервера:', 'color: lightgreen; font-weight: bold', response);

        alert('Граф успешно загружен из файла и сохранён на сервере!');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error: any) {
        console.error('Ошибка при чтении или сохранении файла:', error);
        const msg = error?.response?.data?.detail || error?.message || 'Неизвестная ошибка';
        alert(`Не удалось обработать или сохранить файл: ${msg}`);
      }
    };

    reader.readAsText(file);
  }, [updateDataFromManager, fileInputRef]);

  const handleUploadClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [fileInputRef]);

  return {
    handleFileUpload,
    handleUploadClick,
  };
};
