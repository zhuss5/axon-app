export type ConnectorGroup = 'mine' | 'public';

export interface ConnectorItem {
  group: ConnectorGroup;
  id: string;
  name: string;
  namespace: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  protocol: string;
  frontProtocol: string;
  enabled: boolean;
  releaseDate: string | null;
  isLatest: boolean;
}

export interface ConnectorListInput {
  group: ConnectorGroup;
  pageNum: number;
  pageSize: number;
  keyword?: string;
}

export interface ConnectorListResult {
  items: ConnectorItem[];
  pageNum: number;
  pageSize: number;
  total: number;
  totalPages: number;
  skipped: number;
}

export function mergeConnectorItems(previous: ConnectorItem[], incoming: ConnectorItem[]) {
  const seen = new Set(previous.map(item => item.id));
  const merged = previous.slice();
  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}
