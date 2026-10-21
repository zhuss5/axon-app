import type { ConnectorGroup, ConnectorItem, ConnectorListResult } from '../../../shared/runtime/connectors';

export interface ConnectorServiceDeps {
  baseUrl: string;
  systemNamespace: string;
  // 由 main.ts 注入 manager.request：自动附带 Bearer、Origin 校验与 401 清理
  request(url: string, init: RequestInit): Promise<Response>;
}

interface NormalizedQuery {
  group: ConnectorGroup;
  pageNum: number;
  pageSize: number;
  keyword?: string;
}

export function validateListInput(input: unknown): NormalizedQuery {
  if (!input || typeof input !== 'object') throw new Error('请求格式无效');
  const { group, pageNum, pageSize, keyword } = input as Record<string, unknown>;
  if (group !== 'mine' && group !== 'public') throw new Error('请求格式无效');
  if (typeof pageNum !== 'number' || !Number.isInteger(pageNum) || pageNum < 1) throw new Error('请求格式无效');
  if (typeof pageSize !== 'number' || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('请求格式无效');
  if (keyword !== undefined && (typeof keyword !== 'string' || keyword.length > 64)) throw new Error('请求格式无效');
  const trimmed = typeof keyword === 'string' ? keyword.trim() : '';
  return { group, pageNum, pageSize, ...(trimmed ? { keyword: trimmed } : {}) };
}

export function buildRegistryUrl(baseUrl: string, namespace: string, pageNum: number, pageSize: number, keyword?: string) {
  const url = new URL('/api/registry/mcps', baseUrl);
  url.searchParams.set('namespace', namespace);
  url.searchParams.set('pageNum', String(pageNum));
  url.searchParams.set('pageSize', String(pageSize));
  if (keyword) url.searchParams.set('keyword', keyword);
  return url.href;
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeConnectorItem(raw: unknown, group: ConnectorGroup, expectedNamespace: string): ConnectorItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as Record<string, unknown>;
  const name = text(entry.name);
  if (!name) return null;
  // 接口文档响应示例用 content，字段说明写 metadata；两者兼容读取，待平台确认后收敛
  const meta = (entry.content && typeof entry.content === 'object' ? entry.content : entry.metadata) as Record<string, unknown> | undefined;
  const id = meta ? text(meta.id) : '';
  if (!id) return null;
  const namespace = text(entry.namespace);
  if (namespace && namespace !== expectedNamespace) return null;
  const tags = Array.isArray(entry.tags) ? entry.tags.filter((tag): tag is string => typeof tag === 'string') : [];
  return {
    group,
    id,
    name,
    namespace: namespace || expectedNamespace,
    version: text(entry.version),
    description: text(entry.description),
    author: text(entry.author),
    tags,
    protocol: text(entry.protocol),
    frontProtocol: text(entry.frontProtocol),
    enabled: entry.enabled !== false,
    releaseDate: meta ? text(meta.release_date) || null : null,
    isLatest: !!meta && meta.is_latest === true,
  };
}

export function parseRegistryResponse(bodyText: string, group: ConnectorGroup, expectedNamespace: string) {
  let payload: unknown;
  try { payload = JSON.parse(bodyText); } catch { throw new Error('平台响应不是有效 JSON'); }
  const envelope = payload as { code?: unknown; message?: unknown; data?: unknown } | null;
  if (!envelope || typeof envelope !== 'object' || envelope.code !== 200
    || !envelope.data || typeof envelope.data !== 'object') {
    const detail = envelope && typeof envelope === 'object' && typeof envelope.message === 'string' ? `（${envelope.message}）` : '';
    throw new Error(`平台响应格式异常${detail}`);
  }
  const page = envelope.data as Record<string, unknown>;
  const rawItems = Array.isArray(page.items) ? page.items : [];
  const items: ConnectorItem[] = [];
  let skipped = 0;
  for (const raw of rawItems) {
    const item = normalizeConnectorItem(raw, group, expectedNamespace);
    if (item) items.push(item); else skipped++;
  }
  const toCount = (value: unknown) => (Number.isInteger(value) && (value as number) >= 0 ? value as number : 0);
  return { items, skipped, total: toCount(page.total), totalPages: Math.max(1, toCount(page.totalPages)) };
}

export async function listConnectors(deps: ConnectorServiceDeps, input: unknown): Promise<ConnectorListResult> {
  const query = validateListInput(input);
  const namespace = query.group === 'public' ? 'public' : deps.systemNamespace;
  const response = await deps.request(
    buildRegistryUrl(deps.baseUrl, namespace, query.pageNum, query.pageSize, query.keyword),
    { method: 'GET', headers: { Accept: 'application/json' } },
  );
  const parsed = parseRegistryResponse(await response.text(), query.group, namespace);
  return { ...parsed, pageNum: query.pageNum, pageSize: query.pageSize };
}
