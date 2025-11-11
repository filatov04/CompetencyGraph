import { useCallback, useState } from 'react';
import { postGraph, type GraphData } from '../../../shared/api/graphApi';
import OntologyManager, { type OntologyNode, type NodeType } from '../../../shared/types/OntologyManager';
import PredicateManager from '../../../shared/types/PredicateManager';
import type { RDFLink } from '../../../shared/types/graphTypes';

export const useGraphActions = (
  nodes: OntologyNode[],
  links: RDFLink[],
  updateDataFromManager: () => void
) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveGraph = useCallback(async () => {
    if (isSaving) return; 

    setIsSaving(true);
    try {
      const nodesToSave = nodes.map(({ children, ...rest }) => rest);
      const graphData: GraphData = {
        nodes: nodesToSave,
        links: links,
      };

      console.log('Saving graph:', { nodes: nodesToSave.length, links: links.length });
      const response = await postGraph(graphData);
      console.log('Graph saved successfully:', response);

      alert('Граф успешно сохранен!');
    } catch (error: any) {
      console.error('Ошибка при сохранении графа:', error);
      const errorMessage = error?.response?.data?.detail || error?.message || 'Неизвестная ошибка';
      alert(`Не удалось сохранить граф: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  }, [nodes, links, isSaving]);

  const handleAddTriple = useCallback((
    subjectLabel: string,
    predicateLabel: string,
    objectLabel: string
  ) => {
    const subject = OntologyManager.getNodeByLabel(subjectLabel);
    const object = OntologyManager.getNodeByLabel(objectLabel);
    console.log("subject", subject, "object", object);
    
    if (!subject || !object) {
      console.error("Не найдены узлы для субъекта или объекта");
      return false;
    }
    
    if (predicateLabel === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
      if (!subject.type) {
        console.error("Субъект не имеет типа для наследования");
        return false;
      }

      let type = 'literal';

      if (subject.label === 'Class') {
        type = 'class';
      }

      if (subject.label === 'Property') {
        type = 'property';
      }

      const typeUpdated = OntologyManager.updateNodeType(object.id, type as NodeType);
      if (!typeUpdated) {
        console.error("Не удалось изменить тип объекта");
        return false;
      }
    }
    const predicateUri = PredicateManager.generatePredicateUri(predicateLabel);
    const linkAdded = OntologyManager.addLink(subject.id, object.id, predicateUri);
    if (linkAdded) {
      updateDataFromManager();
      return true;
    }
    
    return false;
  }, [updateDataFromManager]);

  return {
    isSaving,
    handleSaveGraph,
    handleAddTriple
  };
};

