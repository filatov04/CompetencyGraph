import React, { useEffect, useState, useRef, useCallback } from "react";
import * as d3 from "d3";
import styles from "./GraphPage.module.css";
import { NewTripleMenu } from "./NewTriplet";
import OntologyManager, { type OntologyNode } from "../../shared/types/OntologyManager";
import PredicateManager from "../../shared/types/PredicateManager";
import type { RDFLink } from "../../shared/types/graphTypes";
import NodePopup from "./NodePopup";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { ErrorDisplay } from "./components/ErrorDisplay";
import { useGraphData } from "./hooks/useGraphData";
import { useGraphActions } from "./hooks/useGraphActions";
import { useGraphRenderer } from "./hooks/useGraphRenderer";
import { useFileUpload } from "./hooks/useFileUpload";



const GraphPage: React.FC = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [showMenu, setShowMenu] = useState(false);
  const [predicates, setPredicates] = useState<string[]>([]);
  const [nodes, setNodes] = useState<OntologyNode[]>([]);
  const [links, setLinks] = useState<RDFLink[]>([]);
  const [selectedNode, setSelectedNode] = useState<OntologyNode | null>(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

  // Хук для управления данными графа
  const { isLoading, loadError, initializeData } = useGraphData();

  // Функция обновления данных из менеджера
  // Используем useCallback без зависимостей для стабильности ссылки
  const updateDataFromManager = useCallback(() => {
    console.log('GraphPage: updateDataFromManager called');
    const allNodes = OntologyManager.getAllNodes();
    const allLinks = OntologyManager.getAllLinks();
    const allPredicates = OntologyManager.getAvailablePredicates();

    console.log('GraphPage: Data from manager:', {
      nodes: allNodes.length,
      links: allLinks.length,
      predicates: allPredicates.length
    });

    // Просто обновляем состояние - React оптимизирует это
    setNodes(allNodes);
    setLinks(allLinks);
    setPredicates(allPredicates);

    console.log('GraphPage: State updated');
  }, []);

  // Хук для действий с графом (сохранение, добавление)
  const { isSaving, handleSaveGraph, handleAddTriple } = useGraphActions(
    updateDataFromManager
  );

  // Хук для загрузки файлов
  const { handleFileUpload, handleUploadClick } = useFileUpload(
    fileInputRef,
    updateDataFromManager
  );

  // Хук для рендеринга графа
  const { renderTree } = useGraphRenderer(
    svgRef,
    nodes,
    links,
    isSaving,
    setSelectedNode,
    setPopupPosition,
    handleSaveGraph,
    handleUploadClick,
    setShowMenu
  );

  // Инициализация данных при монтировании
  useEffect(() => {
    console.log('GraphPage: Component mounted, initializing data...');
    initializeData();

    return () => {
      console.log('GraphPage: Component unmounting, cleaning up...');
      const svgElement = svgRef.current;
      if (svgElement) {
        d3.select(svgElement).selectAll("*").remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Выполняется только при монтировании/размонтировании

  // Обновление данных из менеджера после завершения загрузки
  useEffect(() => {
    console.log('GraphPage: Loading state changed', { isLoading, loadError });
    if (!isLoading && !loadError) {
      console.log('GraphPage: Loading complete, updating data from manager...');
      updateDataFromManager();
    }
  }, [isLoading, loadError, updateDataFromManager]);

  // Рендеринг дерева при изменении узлов или связей
  useEffect(() => {
    console.log('GraphPage: Render effect triggered. Nodes:', nodes.length, 'Links:', links.length);
    if (nodes.length > 0) {
      console.log('GraphPage: Calling renderTree...');
      renderTree();
    } else {
      console.log('GraphPage: No nodes to render');
    }
  }, [nodes, links, isSaving, renderTree]); // Убираем renderTree из зависимостей, но оставляем nodes и links

  // Обработка клика вне popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectedNode && !(e.target as HTMLElement).closest(`.${styles.nodePopup}`)) {
        setSelectedNode(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [selectedNode]);

  // Обработчик добавления объекта
  const handleAddObject = useCallback((objectLabel: string) => {
    console.log("Добавляем узел: ", objectLabel)
    const newNode = {
      id: OntologyManager.generateNodeId(objectLabel),  // Генерируем валидный URI
      label: objectLabel,
      type: 'class' as const,
      children: [] as OntologyNode[]
    };

    OntologyManager.addNode(newNode);
    const updatedNodes = OntologyManager.getAllNodes();
    setNodes(updatedNodes);
    console.log('Все узлы после добавления:', updatedNodes);
    return newNode;
  }, []);

  // Обработчик добавления предиката
  const handleAddPredicate = useCallback((pred: string) => {
    // registerPredicate автоматически преобразует в URI
    PredicateManager.registerPredicate(pred);
    setPredicates(OntologyManager.getAvailablePredicates());
  }, []);

  return (
    <div className={styles["graph-page"]}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".json,application/json"
        style={{ display: 'none' }}
      />

      {/* Индикатор загрузки */}
      {isLoading && <LoadingSpinner />}

      {/* Отображение ошибки */}
      {loadError && !isLoading && (
        <ErrorDisplay
          error={loadError}
          onRetry={initializeData}
          onUploadFile={handleUploadClick}
        />
      )}

      <div className={styles["graph-page__content"]}>
        <svg
          ref={svgRef}
          className={styles["graph-page__svg"]}
          width="100%"
          height="100%"
          style={{ opacity: (isLoading || loadError) ? 0.3 : 1 }}
        />
      </div>

      {/* Меню создания нового триплета */}
      {showMenu && (
        <NewTripleMenu
          onClose={() => setShowMenu(false)}
          predicates={predicates}
          subjects={nodes.map(n => n.label)}
          objects={nodes.map(n => n.label)}
          onAddPredicate={handleAddPredicate}
          onAddObject={handleAddObject}
          onAddTriple={handleAddTriple}
        />
      )}

      {/* Popup узла */}
      {selectedNode && (
        <NodePopup
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          position={popupPosition}
          onUpdate={updateDataFromManager}
          setSelectedNode={setSelectedNode}
        />
      )}
    </div>
  );
};

export default GraphPage;
