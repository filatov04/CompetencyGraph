import { api } from './customAxiosInstance';

interface UserInfo {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  full_name: string;
}

interface NodeVersion {
  node_uri: string;
  version: number;
  last_modified: string | null;
  last_modified_by: UserInfo | null;
}

interface NodeHistoryItem {
  id: number;
  node_uri: string;
  user_id: number;
  change_type: 'CREATE' | 'UPDATE' | 'DELETE';
  old_value: any;
  new_value: any;
  version: number;
  changed_at: string;
  user: UserInfo | null;
}

interface UpdateNodeData {
  version: number;
  old_value: any;
  new_value: any;
}

const getNodeVersion = async (nodeId: string): Promise<NodeVersion> => {
  const response = await api.get<NodeVersion>('/competencies/node/version', {
    params: { node_id: nodeId }
  });
  return response.data;
};

const getNodeHistory = async (nodeId: string, limit: number = 10): Promise<NodeHistoryItem[]> => {
  const response = await api.get<NodeHistoryItem[]>('/competencies/node/history', {
    params: { node_id: nodeId, limit }
  });
  return response.data;
};

const updateNodeWithVersion = async (
  nodeId: string,
  data: UpdateNodeData
): Promise<{ status: string; node_uri: string; version: number }> => {
  const response = await api.post('/competencies/node/update', data, {
    params: { node_id: nodeId }
  });
  return response.data;
};

export { getNodeVersion, getNodeHistory, updateNodeWithVersion };
export type { NodeVersion, NodeHistoryItem, UpdateNodeData, UserInfo };
