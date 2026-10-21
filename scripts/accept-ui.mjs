// 连接器页 UI 验收驱动：通过 CDP 操控运行中的 Electron 渲染进程（--remote-debugging-port=9222）
// 用法：node accept-ui.mjs A   （正常命名空间场景） | node accept-ui.mjs B   （AXON_CONNECTOR_NAMESPACE=BROKEN-500 场景）
const CDP = 'http://127.0.0.1:9222';
const phase = process.argv[2] || 'A';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
let currentStep = '连接 CDP';
const step = name => { currentStep = name; if (process.env.ACCEPT_TRACE) console.log(`  … ${name}`); };
setTimeout(() => { console.error(`看门狗超时：卡在「${currentStep}」`); process.exit(3); }, 60000).unref();
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  —  ${detail}` : ''}`);
}

async function connect() {
  const targets = await (await fetch(`${CDP}/json/list`)).json();
  const page = targets.find(t => t.type === 'page' && t.url.includes('index.html'));
  if (!page) throw new Error('未找到渲染页面 target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async expression => {
    step(`求值 ${expression.slice(0, 70)}`);
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
    return r.result?.result?.value;
  };
  return { evaluate, close: () => ws.close() };
}

// 注入到页面内的查询/操作助手
function installHelpers() {
  const sec = g => document.querySelector(`[aria-label="${g === 'mine' ? '我的 MCP' : '公共 MCP'}"]`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  window.__q = {
    cards: g => sec(g).querySelectorAll('.axon-connector-card').length,
    names: g => [...sec(g).querySelectorAll('.axon-connector-name')].map(e => e.textContent),
    text: g => sec(g).innerText,
    hasBtn: (g, label) => [...sec(g).querySelectorAll('button')].some(b => b.textContent.trim() === label),
    clickBtn: (g, label) => { const b = [...sec(g).querySelectorAll('button')].find(x => x.textContent.trim() === label); if (!b) throw new Error('无按钮 ' + label); b.click(); return true; },
    type: (g, value) => { const i = sec(g).querySelector('input[type=search]'); setter.call(i, value); i.dispatchEvent(new Event('input', { bubbles: true })); return true; },
    nav: label => { const b = [...document.querySelectorAll('.axon-nav button')].find(x => x.textContent.trim() === label); if (!b) throw new Error('无导航 ' + label); b.click(); return true; },
    tab: label => { const b = [...document.querySelectorAll('[role=tab]')].find(x => x.textContent.trim() === label); if (!b) throw new Error('无 tab ' + label); b.click(); return true; },
    card: (g, name) => { const c = [...sec(g).querySelectorAll('.axon-connector-card')].find(x => x.querySelector('.axon-connector-name').textContent === name); if (!c) return null; const d = c.querySelector('.axon-connector-desc'); return { text: d?.innerText ?? '', html: d?.innerHTML ?? '', imgs: c.querySelectorAll('img').length, disabled: c.classList.contains('is-disabled') }; },
    api: () => window.agentManagerHost.platformApi,
  };
  return true;
}

const { evaluate, close } = await connect();
for (let i = 0; i < 40 && !(await evaluate('!!document.querySelector(".axon-nav")')); i++) await sleep(250);
await evaluate(`(${installHelpers})()`);
const q = (expr) => evaluate(`window.__q.${expr}`);
const api = (expr) => evaluate(`window.__q.api().${expr}`);

if (phase === 'A') {
  // 状态重置：清 token、回首页再进连接器页（强制重挂载面板，丢弃上一次运行残留的搜索词与列表）
  step('重置应用状态');
  await api(`setAccessToken('')`);
  await q(`nav('首页')`); await sleep(150);
  await q(`nav('专家·技能·连接器')`); await q(`tab('连接器')`); await sleep(700);
  const loginMine = await q(`text('mine')`), loginPub = await q(`text('public')`);
  check('1a 未登录两组显示登录引导', loginMine.includes('请先在首页设置 accessToken') && loginPub.includes('请先在首页设置 accessToken'));
  check('1a 未登录无数据卡片', (await q(`cards('mine')`)) === 0 && (await q(`cards('public')`)) === 0);

  // 2. 设置 token 后刷新：列表正常、损坏条目跳过、命名空间脱敏、停用置灰
  await api(`setAccessToken('dev-token')`);
  await q(`clickBtn('mine','刷新')`); await q(`clickBtn('public','刷新')`); await sleep(900);
  const mineText = await q(`text('mine')`), pubText = await q(`text('public')`);
  check('1b 设置 token 后我的 MCP 加载 6 条有效条目', (await q(`cards('mine')`)) === 6, `cards=${await q(`cards('mine')`)}`);
  check('1b 公共 MCP 首页 20 条且显示共 25 条', (await q(`cards('public')`)) === 20 && pubText.includes('共 25 条'));
  check('1b 登录引导消失', !mineText.includes('请先在首页设置') && !pubText.includes('请先在首页设置'));
  check('3  损坏条目被跳过并计数', mineText.includes('已跳过 2 条异常数据'));
  check('2  系统编号脱敏展示（TE***01）', mineText.includes('TE***01'));
  const disabledMine = await q(`card('mine','report-generator')`), disabledPub = await q(`card('public','notify-push')`);
  check('7  enabled=false 条目置灰并标注已停用', disabledMine?.disabled && disabledPub?.disabled && mineText.includes('已停用'));
  check('7  legacy metadata 形态条目正常展示', (await q(`names('mine')`)).includes('legacy-metadata'));

  // 3. 搜索：防抖、过滤、无结果空态、清空恢复
  await q(`type('mine','git')`); await sleep(750);
  check('4  搜索过滤生效（git → team-git-helper）', (await q(`cards('mine')`)) === 1 && (await q(`names('mine')`))[0] === 'team-git-helper');
  check('4  搜索不影响另一分组', (await q(`cards('public')`)) === 20);
  await q(`type('mine','zzz-none')`); await sleep(750);
  check('4  无匹配显示“无搜索结果”而非错误', (await q(`cards('mine')`)) === 0 && (await q(`text('mine')`)).includes('无搜索结果'));
  await q(`type('mine','')`); await sleep(750);
  check('4  清空搜索恢复全部', (await q(`cards('mine')`)) === 6);

  // 4. 翻页：加载更多、按 id 去重、用尽后隐藏
  await q(`clickBtn('public','加载更多')`); await sleep(900);
  const pubNames = await q(`names('public')`);
  check('5  加载更多追加到 25 条', pubNames.length === 25, `cards=${pubNames.length}`);
  check('5  翻页无重复条目', new Set(pubNames).size === pubNames.length);
  check('5  totalPages 用尽后隐藏加载更多', !(await q(`hasBtn('public','加载更多')`)));

  // 5. 纯文本渲染：HTML 标记原样显示、不生成元素
  const xss = await q(`card('mine','plain-text-check')`);
  check('8  描述中的 HTML 按纯文本显示', !!xss && xss.text.includes('<b>加粗</b>') && xss.html.includes('&lt;b&gt;') && xss.imgs === 0, xss ? `imgs=${xss.imgs}` : '未找到条目');

  // 6. IPC 入参注入：非法枚举/非对象被拒，伪造 namespace 被忽略，主进程不崩溃
  const bad1 = await api(`connectorsList({ group: 'evil', pageNum: 1, pageSize: 20 }).then(() => 'resolved', e => String(e))`);
  const bad2 = await api(`connectorsList('garbage').then(() => 'resolved', e => String(e))`);
  const bad3 = await api(`connectorsList({ group: 'public', pageNum: 1, pageSize: 500 }).then(() => 'resolved', e => String(e))`);
  check('3  非法 group / 非对象 / 超限 pageSize 被“请求格式无效”拒绝', [bad1, bad2, bad3].every(m => m.includes('请求格式无效')), `${bad1} | ${bad2} | ${bad3}`);
  const forged = await api(`connectorsList({ group: 'public', pageNum: 1, pageSize: 5, namespace: 'TEST-101' }).then(r => r.items.map(i => i.namespace), e => String(e))`);
  check('3  伪造 namespace 字段被忽略（仍返回 public）', Array.isArray(forged) && forged.length > 0 && forged.every(n => n === 'public'), JSON.stringify(forged).slice(0, 60));
  check('3  注入后应用仍存活', (await q(`cards('mine')`)) === 6);

  // 7. Token 失效（401）：清空 token、登录引导横幅、保留已加载数据；重设后恢复
  await api(`setAccessToken('expired')`);
  await q(`clickBtn('mine','刷新')`); await sleep(900);
  const afterExpired = await q(`text('mine')`);
  const stateAfter = await api(`getState()`);
  check('6  401 后显示登录引导横幅', afterExpired.includes('请先在首页设置 accessToken'));
  check('6  401 后保留上次成功数据不误显示为空', (await q(`cards('mine')`)) === 6, `cards=${await q(`cards('mine')`)}`);
  check('6  401 后主进程自动清空失效 token', stateAfter.hasAccessToken === false);
  check('6  一侧 401 不影响另一侧', (await q(`cards('public')`)) === 25);
  await api(`setAccessToken('dev-token')`);
  await q(`clickBtn('mine','刷新')`); await sleep(900);
  check('6  重设 token 刷新后恢复正常', (await q(`cards('mine')`)) === 6 && !(await q(`text('mine')`)).includes('请先在首页设置'));
} else {
  // B：我的 MCP 命名空间指向 BROKEN-500 → 该组 5xx 错误态 + 重试，公共组正常
  await q(`nav('专家·技能·连接器')`); await q(`tab('连接器')`); await sleep(900);
  const mineText = await q(`text('mine')`);
  check('6  5xx 分组显示平台错误并提供重试', mineText.includes('AXON 平台请求失败（500）') && (await q(`hasBtn('mine','重试')`)), mineText.split('\n').slice(0, 3).join(' / '));
  check('6  5xx 分组不出现“暂无连接器”空态误导', !mineText.includes('暂无连接器'));
  check('6  另一分组不受影响（公共 20 条）', (await q(`cards('public')`)) === 20, `cards=${await q(`cards('public')`)}`);
  await q(`clickBtn('mine','重试')`); await sleep(700);
  check('6  重试后仍为错误态且应用存活', (await q(`text('mine')`)).includes('（500）') && (await q(`cards('public')`)) === 20);
}

close();
const failed = results.filter(r => !r.ok);
console.log(`\n阶段 ${phase}：${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length ? 1 : 0);
