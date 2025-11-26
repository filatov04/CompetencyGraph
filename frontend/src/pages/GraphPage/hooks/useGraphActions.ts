import { useCallback, useState } from 'react';
import { postGraph } from '../../../shared/api/graphApi';
import { api } from '../../../shared/api/customAxiosInstance';
import OntologyManager, { type NodeType } from '../../../shared/types/OntologyManager';
import PredicateManager from '../../../shared/types/PredicateManager';

export const useGraphActions = (
  updateDataFromManager: () => void
) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveGraph = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      // Удаляем висячие узлы перед сохранением
      const deletedCount = OntologyManager.removeOrphanedNodes();
      if (deletedCount > 0) {
        console.log(`Removed ${deletedCount} orphaned nodes before saving`);
        updateDataFromManager();
      }

      const currentNodes = OntologyManager.getAllNodes();
      const currentLinks = OntologyManager.getAllLinks();

      const nodesToSave = currentNodes.map(({ children, ...rest }) => rest);

      const nodeUris = nodesToSave.map(n => n.id);
      let versions: Record<string, number> = {};

      try {
        const versionsResponse = await api.post<{ versions: Array<{ node_uri: string; version: number }> }>(
          '/competencies/nodes/versions',
          nodeUris
        );

        versions = versionsResponse.data.versions.reduce((acc: Record<string, number>, v: { node_uri: string; version: number }) => {
          acc[v.node_uri] = v.version;
          return acc;
        }, {} as Record<string, number>);

        console.log('Loaded versions for nodes:', versions);
      } catch (versionError) {
        console.warn('Failed to load versions, saving without version check:', versionError);
        // Продолжаем без проверки версий если не удалось их загрузить
      }

      const graphData: any = {
        nodes: nodesToSave,
        links: currentLinks,
        versions: versions
      };

      console.log('Saving graph:', { nodes: nodesToSave.length, links: currentLinks.length, versions: Object.keys(versions).length });
      const response = await postGraph(graphData);
      console.log('Graph saved successfully:', response);

      alert('Граф успешно сохранен!');
    } catch (error: any) {
      console.error('Ошибка при сохранении графа:', error);

      if (error?.response?.status === 409) {
        const conflicts = error.response.data?.detail?.conflicts || [];
        const message = error.response.data?.detail?.message || 'Обнаружен конфликт версий';

        let conflictDetails = `${message}\n\n`;
        if (conflicts.length > 0) {
          conflictDetails += 'Изменённые другим пользователем узлы:\n';
          conflicts.forEach((c: any) => {
            const author = c.last_modified_by?.full_name || 'Неизвестный';
            conflictDetails += `• ${c.node_label} (изменил: ${author})\n`;
          });
          conflictDetails += '\n⚠️ Пожалуйста, обновите страницу и повторите изменения.';
        }

        alert(conflictDetails);
      } else {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Неизвестная ошибка';
      alert(`Не удалось сохранить граф: ${errorMessage}`);
      }
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, updateDataFromManager]);

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
