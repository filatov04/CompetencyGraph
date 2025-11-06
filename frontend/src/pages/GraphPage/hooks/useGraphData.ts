import { useState, useCallback } from 'react';
import { getGraph } from '../../../shared/api/graphApi';
import OntologyManager, { type OntologyNode, type NodeType } from '../../../shared/types/OntologyManager';

export const useGraphData = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const initializeData = useCallback(async () => {
    console.log('useGraphData: Starting initializeData...');
    setIsLoading(true);
    setLoadError(null);
    
    console.log('useGraphData: Clearing OntologyManager...');
    OntologyManager.clear();
    console.log('useGraphData: OntologyManager cleared. Current nodes:', OntologyManager.getAllNodes().length);
    
    try {
      console.log('useGraphData: Fetching graph from server...');
      const response = await getGraph();
      const data = response.data;
      console.log('useGraphData: Данные получены с сервера:', data);
      console.log('useGraphData: Nodes from server:', data.nodes?.length, 'Links:', data.links?.length);

      // Проверяем что данные корректны
      if (!data || !data.nodes || !Array.isArray(data.nodes) || !data.links || !Array.isArray(data.links)) {
        throw new Error('Сервер вернул данные в некорректном формате');
      }
      
      // Если граф пустой (новый пользователь или база данных пуста)
      if (data.nodes.length === 0 && data.links.length === 0) {
        console.log('Граф пуст - создаём начальный узел');
        const fallbackNode: OntologyNode = {
          id: "http://example.org/competencies#Class",
          label: "Class",
          type: "class",
          children: [],
        };
        OntologyManager.addNode(fallbackNode);
        setIsLoading(false);
        return;
      }

      // Загружаем данные с сервера
      console.log('useGraphData: Adding nodes to OntologyManager...');
      
      data.nodes.forEach(node => {
        OntologyManager.addNode({
          id: node.id,
          label: node.label,
          type: node.type as NodeType,
          children: []
        });
      });

      console.log('useGraphData: Adding links to OntologyManager...');
      
      data.links.forEach(link => {
        OntologyManager.addLink(link.source, link.target, link.predicate);
      });

      console.log('useGraphData: Data loaded successfully. Total nodes in manager:', OntologyManager.getAllNodes().length);
      console.log('useGraphData: Total links in manager:', OntologyManager.getAllLinks().length);
      setIsLoading(false);
    } catch (error) {
      console.error('Ошибка при загрузке графа с сервера:', error);
      
      // Формируем понятное сообщение об ошибке
      let errorMessage = 'Не удалось загрузить граф компетенций с сервера.';
      
      if (error instanceof Error) {
        errorMessage += ` ${error.message}`;
      }
      
      setLoadError(errorMessage);
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    loadError,
    initializeData
  };
};

