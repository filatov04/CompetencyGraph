import { api } from './customAxiosInstance';
import type { OntologyNode } from '../types/OntologyManager';
import type { RDFLink} from '../types/graphTypes';

interface GraphData {
  nodes: Omit<OntologyNode, 'children'>[];
  links: RDFLink[];
}


const postGraph = async (graphData: GraphData) => {
  return api.post('/competencies/graph', graphData);
}

const deleteNode = async (nodeId: string) => {
  return api.delete(`/competencies/node`, {
    params: { node_id: nodeId },
  });
};

const deleteTriple = async (subject: string, predicate: string, objectValue: string) => {
  return api.delete(`/competencies/triple`, {
    params: {
      subject: subject,
      predicate: predicate,
      object: objectValue
    },
  });
};

const getGraph = async () => {
  return api.get<GraphData>('/competencies/graph');
}

export { postGraph, getGraph, deleteNode, deleteTriple };
export type { GraphData };
