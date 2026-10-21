import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateListInput, buildRegistryUrl, normalizeConnectorItem, parseRegistryResponse, listConnectors } from './connectorService.ts';
import { mergeConnectorItems } from '../../../shared/runtime/connectors.ts';

test('validateListInput 拒绝非法入参', () => {
  for (const bad of [null, 'x', {}, { group: 'other', pageNum: 1, pageSize: 20 },
    { group: 'public', pageNum: 0, pageSize: 20 }, { group: 'public', pageNum: 1, pageSize: 101 },
    { group: 'public', pageNum: 1, pageSize: 20, keyword: 123 },
    { group: 'public', pageNum: 1, pageSize: 20, keyword: 'a'.repeat(65) }]) {
    assert.throws(() => validateListInput(bad), /请求格式无效/);
  }
});

test('validateListInput 归一化 keyword', () => {
  assert.deepEqual(
    validateListInput({ group: 'mine', pageNum: 2, pageSize: 20, keyword: '  fetch  ' }),
    { group: 'mine', pageNum: 2, pageSize: 20, keyword: 'fetch' },
  );
  assert.equal(validateListInput({ group: 'public', pageNum: 1, pageSize: 20, keyword: '   ' }).keyword, undefined);
});

test('buildRegistryUrl 拼接并编码查询参数', () => {
  const url = new URL(buildRegistryUrl('http://127.0.0.1:18080', 'TEST-101', 3, 20, '代码 搜索'));
  assert.equal(url.pathname, '/api/registry/mcps');
  assert.equal(url.searchParams.get('namespace'), 'TEST-101');
  assert.equal(url.searchParams.get('pageNum'), '3');
  assert.equal(url.searchParams.get('pageSize'), '20');
  assert.equal(url.searchParams.get('keyword'), '代码 搜索');
});

test('normalizeConnectorItem 兼容 content 与 metadata 并跳过缺字段条目', () => {
  const base = { name: 'a', namespace: 'TEST-101' };
  const byContent = normalizeConnectorItem({ ...base, content: { id: 'id-1', release_date: '2026-08-20T08:27:59Z', is_latest: true } }, 'mine', 'TEST-101');
  const byMetadata = normalizeConnectorItem({ ...base, metadata: { id: 'id-2' } }, 'mine', 'TEST-101');
  assert.equal(byContent?.id, 'id-1');
  assert.equal(byContent?.releaseDate, '2026-08-20T08:27:59Z');
  assert.equal(byContent?.isLatest, true);
  assert.equal(byMetadata?.id, 'id-2');
  assert.equal(normalizeConnectorItem({ namespace: 'TEST-101', content: { id: 'x' } }, 'mine', 'TEST-101'), null, '缺 name 跳过');
  assert.equal(normalizeConnectorItem({ name: 'a', content: {} }, 'mine', 'TEST-101'), null, '缺 id 跳过');
  assert.equal(normalizeConnectorItem({ ...base, content: { id: 'x' } }, 'mine', 'OTHER-NS'), null, 'namespace 与查询意图不符跳过');
  assert.equal(normalizeConnectorItem({ name: 'a', content: { id: 'x' }, enabled: false, tags: ['t', 1] }, 'mine', 'TEST-101')?.enabled, false, 'enabled 默认 true、tags 过滤非字符串');
});

test('parseRegistryResponse 校验信封并统计 skipped', () => {
  assert.throws(() => parseRegistryResponse('not json', 'public', 'public'), /有效 JSON/);
  assert.throws(() => parseRegistryResponse(JSON.stringify({ code: 500, message: 'boom', data: {} }), 'public', 'public'), /格式异常（boom）/);
  const body = JSON.stringify({
    code: 200, message: 'success',
    data: { items: [{ name: 'ok', namespace: 'public', content: { id: 'i1' } }, { broken: true }, {}], total: 2, totalPages: 1 },
  });
  const parsed = parseRegistryResponse(body, 'public', 'public');
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.skipped, 2);
  assert.equal(parsed.total, 2);
  assert.equal(parsed.totalPages, 1);
});

test('listConnectors 按 group 映射 namespace 并返回归一化结果', async () => {
  const calls = [];
  const deps = {
    baseUrl: 'http://127.0.0.1:18080',
    systemNamespace: 'TEST-101',
    request: url => {
      calls.push(url);
      return Promise.resolve(new Response(JSON.stringify({
        code: 200, message: 'success',
        data: { items: [{ name: 'sys-test-mcp', namespace: 'TEST-101', content: { id: 'i1' } }], total: 1, totalPages: 1 },
      })));
    },
  };
  const mine = await listConnectors(deps, { group: 'mine', pageNum: 1, pageSize: 20 });
  const pub = await listConnectors(deps, { group: 'public', pageNum: 1, pageSize: 20, keyword: 'f' });
  assert.match(calls[0], /namespace=TEST-101/);
  assert.match(calls[1], /namespace=public/);
  assert.match(calls[1], /keyword=f/);
  assert.equal(mine.items[0].group, 'mine');
  assert.equal(pub.totalPages, 1);
});

test('mergeConnectorItems 跨页按 id 去重', () => {
  const a = { group: 'public', id: '1', name: 'a' };
  const dup = { group: 'public', id: '1', name: 'a' };
  const b = { group: 'public', id: '2', name: 'b' };
  assert.equal(mergeConnectorItems([a], [dup, b]).length, 2);
});
