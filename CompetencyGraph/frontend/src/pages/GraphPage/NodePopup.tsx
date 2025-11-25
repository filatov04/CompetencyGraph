import React, {useState} from 'react';
import styles from './GraphPage.module.css';
import OntologyManager, { type OntologyNode } from '../../shared/types/OntologyManager';
import { NewTripleMenu } from './NewTriplet';
import PredicateManager from '../../shared/types/PredicateManager';
import { EditNode } from './EditNode';
import { DeleteNodeMenu } from './DeleteNodeMenu';
import NodeVersionInfo from './NodeVersionInfo';


const NodePopup: React.FC<{
  node: OntologyNode;
  onClose: () => void;
  position: { x: number; y: number };
  onUpdate: () => void;
  setSelectedNode: (node: OntologyNode) => void;
}> = ({node, position, onUpdate, setSelectedNode}) => {
    const [showNewTripleMenu, setShowNewTripleMenu] = useState(false);
    const [showEditNoteMenu, setEditNodeMenu] = useState(false);
    const [showVersionInfo, setShowVersionInfo] = useState(false);
    const [predicates, setPredicates] = useState<string[]>([]);
    const [objects, setObjects] = useState<string[]>([]);

    const [nodeToDelete, setNodeToDelete] = useState<OntologyNode | null>(null);

    const updateData = () => {
        setPredicates(OntologyManager.getAvailablePredicates());
        setObjects(
            OntologyManager.getAllNodes()
                .filter(n => n.id !== node.id)
                .map(n => n.label)
        );
    };

    React.useEffect(() => {
        updateData();
    }, [node.id]);

    const handleAddTriple = (subject: string, predicate: string, object: string) => {
    const subjectNode = OntologyManager.getNodeByLabel(subject);
    const objectNode = OntologyManager.getNodeByLabel(object);

    if (!subjectNode || !objectNode) {
      console.error("Не найдены узлы для субъекта или объекта");
      return false;
    }

    if (predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
      if (!subjectNode.type) {
        console.error("Субъект не имеет типа для наследования");
        return false;
      }

      let type: 'class' | 'property' | 'literal' = 'literal';
      if (subjectNode.label === 'Class') type = 'class';
      if (subjectNode.label === 'Property') type = 'property';

      OntologyManager.updateNodeType(objectNode.id, type);
    }

    OntologyManager.addLink(subjectNode.id, objectNode.id, predicate);
    onUpdate();
    updateData();
    setShowNewTripleMenu(false);
    return true;
  };

  const handleChangeNodeNome = (node: OntologyNode, newLabel: string) => {
    if (!node){
        console.error("Узел не существует");
        return false;
    }
    if (newLabel.trim() === node.label) {
        return true;
     }

    const success = OntologyManager.updateNodeLabel(node.id, newLabel);
    if (success) {

        alert('Название успешно изменено');
        setSelectedNode({ ...node, label: newLabel });
        onUpdate();
        updateData();
    }

    console.log(OntologyManager.getAllNodes());
    console.log(OntologyManager.getAllLinks());

    return success;
  }
    const triples = OntologyManager.getAllTriplesWithNode(node.label);

    return (
        <div
            className={styles.nodePopup}
            style={{
                left: `${position.x + 30}px`,
                top: `${position.y - 30}px`
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className={styles.popupHeader}>
                <h4 className={styles.nodeTitle}>{node.label}</h4>
            </div>

            <div className={styles.popupContent}>
                {triples.length > 0 ? (
                    <ul className={styles.triplesList}>
                        {triples.map((triple, index) => (
                            <li key={index} className={styles.tripleItem}>
                                <span className={styles.tripleSubject}>{triple.subject}</span>
                                <span className={styles.triplePredicate}>{triple.predicate}</span>
                                <span className={styles.tripleObject}>{triple.object}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>Нет связанных триплетов</p>
                )}
            </div>

            <div className={styles.buttonRow}>
                <button
                    className={styles.menuButton}
                    onClick={() => setShowNewTripleMenu(true)}
                >
                    Создать триплет
                </button>
                <button
                    className={styles.menuButton}
                    onClick = {() => setEditNodeMenu(true)}
                >
                    Редактировать
                </button>
                <button
                    className={styles.menuButton}
                    onClick = {() => setShowVersionInfo(true)}
                >
                    Версия
                </button>
                <button
                    className={styles.menuButton}
                    onClick = {() => setNodeToDelete(node)}
                >
                    Удалить триплет
                </button>
            </div>

            {showNewTripleMenu && (
                <NewTripleMenu
                    onClose={() => setShowNewTripleMenu(false)}
                    predicates={predicates}
                    subjects={[node.label]}
                    objects={objects}
                    onAddPredicate={(pred) => {
                        PredicateManager.registerPredicate(pred);
                        updateData();
                    }}
                    onAddObject={(objectLabel: string) => {
                        const newNode = {
                            id: OntologyManager.generateNodeId(objectLabel),
                            label: objectLabel,
                            type: 'literal' as const,
                            children: []
                        };
                        OntologyManager.addNode(newNode);
                        updateData();
                        return newNode;
                    }}
                    onAddTriple={handleAddTriple}
                />
            )}
            {showEditNoteMenu && (
                <EditNode
                    onClose={() => setEditNodeMenu(false)}
                    currentNode={node}
                    onUpdate={handleChangeNodeNome}
                />
            )}

            {nodeToDelete && (
                <DeleteNodeMenu
                    onClose={() => setNodeToDelete(null)}
                    triples={OntologyManager.getAllTriplesWithNode(nodeToDelete.label)}
                    node={nodeToDelete}
                    onUpdate={onUpdate}
                />
                )}


            {showVersionInfo && (
                <NodeVersionInfo
                    nodeId={node.id}
                    onClose={() => setShowVersionInfo(false)}
                />
            )}
        </div>
    );
};

export default NodePopup;
