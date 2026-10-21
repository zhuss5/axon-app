// 本地 aihub 目录 mock：仅实现 GET /api/registry/mcps（契约见《mcp接口文档》与连接器设计文档 4.1）
// 鉴权：Bearer 任意非空 token；token=expired 模拟 401；namespace=FORBIDDEN-403 / BROKEN-500 模拟错误
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const HOST = '127.0.0.1';
const PORT = 18080;
const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString();

function entry(namespace, name, description, { version = '1.0.0', author = 'lingxi-official', tags = ['TOOL'], enabled = true, metaStyle = 'content', releaseDays = 30 } = {}) {
  const meta = { id: randomUUID(), version, is_latest: true, release_date: daysAgo(releaseDays), approvalStatus: 'APPROVED' };
  return {
    name, type: 'MCP', namespace, version, description, author, tags,
    protocol: 'http', frontProtocol: 'mcp-streamable', enabled,
    ...(metaStyle === 'content' ? { content: meta } : { metadata: { id: meta.id, release_date: meta.release_date, is_latest: true } }),
  };
}

const PUBLIC = [
  entry('public', 'fetch-web', '抓取网页并转为 Markdown，供模型引用。', { tags: ['web'] }),
  entry('public', 'code-search', '在代码仓库中执行语义与关键字检索。', { tags: ['dev'], releaseDays: 12 }),
  entry('public', 'doc-reader', '解析常见文档格式并抽取结构化文本。', { tags: ['doc'], releaseDays: 8 }),
  entry('public', 'chart-render', '按数据规格生成图表并返回图片。', { version: '2.1.0', tags: ['viz'] }),
  entry('public', 'db-query', '对受控数据源执行只读查询。', { tags: ['data'] }),
  entry('public', 'notify-push', '向平台消息中心投递业务通知。', { tags: ['msg'], enabled: false, releaseDays: 3 }),
  ...Array.from({ length: 19 }, (_, i) =>
    entry('public', `public-tool-${String(i + 1).padStart(2, '0')}`, `公共联调占位连接器 ${i + 1}。`, { releaseDays: 60 + i })),
];

const MINE = [
  entry('TEST-101', 'sys-test-mcp', 'TEST-101 系统级 MCP 联调验证', { author: 'admin' }),
  entry('TEST-101', 'team-git-helper', '组内代码库操作辅助工具。', { author: 'u_zhang', tags: ['dev'] }),
  entry('TEST-101', 'report-generator', '按模板生成周报与专项报告。', { author: 'u_li', enabled: false, releaseDays: 5 }),
  entry('TEST-101', 'legacy-metadata', '旧字段结构联调条目（metadata 形态）。', { author: 'u_wang', metaStyle: 'metadata' }),
  entry('TEST-101', 'sys-log-tail', '跟踪系统日志尾部输出。', { author: 'admin', releaseDays: 20 }),
  // 描述含标记文本：验证客户端按纯文本渲染，不解释 HTML
  entry('TEST-101', 'plain-text-check', '纯文本校验：<b>加粗</b> 与 <img src=x onerror=alert(1)> 应原样显示', { author: 'qa', tags: ['qa'] }),
  // 故意损坏的条目：缺 name / 缺 id，用于验证客户端逐条跳过并计数
  { namespace: 'TEST-101', description: '缺 name 的损坏条目', content: { id: randomUUID() } },
  { name: 'broken-no-id', namespace: 'TEST-101', description: '缺 id 的损坏条目' },
];

const server = createServer((req, res) => {
  const send = (status, payload) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
  };
  let url;
  try { url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`); } catch { return send(400, { code: 400, message: 'bad request' }); }
  if (req.method !== 'GET' || url.pathname !== '/api/registry/mcps') return send(404, { code: 404, message: 'not found' });

  const auth = (req.headers.authorization ?? '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return send(401, { code: 401, message: 'missing bearer token' });
  if (token === 'expired') return send(401, { code: 401, message: 'token expired' });

  const namespace = url.searchParams.get('namespace') || 'public';
  if (namespace === 'FORBIDDEN-403') return send(403, { code: 403, message: 'no permission to namespace' });
  if (namespace === 'BROKEN-500') return send(500, { code: 500, message: 'aihub internal error' });

  const pool = namespace === 'public' ? PUBLIC : MINE;
  const keyword = (url.searchParams.get('keyword') ?? '').trim().toLowerCase();
  const filtered = keyword ? pool.filter(item => String(item.name).toLowerCase().includes(keyword)) : pool;
  const pageNum = Math.max(1, Number(url.searchParams.get('pageNum')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 12));
  const total = filtered.length;
  const items = filtered.slice((pageNum - 1) * pageSize, pageNum * pageSize);
  send(200, { code: 200, message: 'success', data: { items, pageNum, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
});

server.listen(PORT, HOST, () => console.log(
  `aihub mock 就绪: http://${HOST}:${PORT}/api/registry/mcps\n`
  + '  鉴权: Bearer 任意非空 token；token=expired 模拟 401\n'
  + '  错误模拟: namespace=FORBIDDEN-403 / BROKEN-500；TEST-101 列表内含损坏条目',
));
