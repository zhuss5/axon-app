import { useEffect, useRef, useState } from 'react';
import type { ConnectorGroup, ConnectorItem } from '../../../shared/runtime/connectors';
import { mergeConnectorItems } from '../../../shared/runtime/connectors';
import { platform } from '../../platform/hostApi';
import './connectors.css';

const PAGE_SIZE = 20;
// 401/未设置 token 时 AxonAuthManager 抛出的消息前缀，渲染层据此区分登录引导与网络故障
const AUTH_REQUIRED = 'AuthRequired';

type SectionStatus = 'loading' | 'ready' | 'error' | 'login';

interface SectionState {
  status: SectionStatus;
  items: ConnectorItem[];
  pageNum: number;
  totalPages: number;
  total: number;
  skipped: number;
  message: string;
  busy: boolean;
}

const INITIAL: SectionState = { status: 'loading', items: [], pageNum: 1, totalPages: 1, total: 0, skipped: 0, message: '', busy: false };

function maskNamespace(value: string) {
  return value.length > 4 ? `${value.slice(0, 2)}***${value.slice(-2)}` : '***';
}

function ConnectorSection({ group }: { group: ConnectorGroup }) {
  const [keyword, setKeyword] = useState('');
  const [state, setState] = useState<SectionState>(INITIAL);
  const seq = useRef(0);
  const mounted = useRef(false);

  async function load(pageNum: number, replace: boolean, kw: string) {
    const id = ++seq.current;
    setState(s => ({ ...s, busy: true, message: '', status: s.items.length ? s.status : 'loading' }));
    try {
      const result = await platform.connectorsList({ group, pageNum, pageSize: PAGE_SIZE, ...(kw.trim() ? { keyword: kw.trim() } : {}) });
      if (id !== seq.current) return;
      setState(s => ({
        status: 'ready',
        items: replace ? result.items : mergeConnectorItems(s.items, result.items),
        pageNum: result.pageNum,
        totalPages: result.totalPages,
        total: result.total,
        skipped: replace ? result.skipped : s.skipped + result.skipped,
        message: '',
        busy: false,
      }));
    } catch (error) {
      if (id !== seq.current) return;
      const message = String(error);
      setState(s => ({ ...s, status: message.includes(AUTH_REQUIRED) ? 'login' : 'error', message, busy: false }));
    }
  }

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      void load(1, true, '');
      return;
    }
    const timer = setTimeout(() => void load(1, true, keyword), 300);
    return () => clearTimeout(timer);
    // load 是组件内闭包，仅依赖 keyword 变化触发防抖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

  const namespaceHint = group === 'mine' && state.items[0]?.namespace ? maskNamespace(state.items[0].namespace) : '';
  const retry = () => void load(1, true, keyword);

  return <section className="axon-connector-section" aria-label={group === 'mine' ? '我的 MCP' : '公共 MCP'}>
    <header className="axon-connector-header">
      <h3>{group === 'mine' ? '我的 MCP' : '公共 MCP'}
        {namespaceHint && <span className="axon-connector-ns">{namespaceHint}</span>}
      </h3>
      <div className="axon-connector-tools">
        <input type="search" placeholder="按名称搜索" aria-label={`搜索${group === 'mine' ? '我的' : '公共'} MCP`} value={keyword}
          onChange={event => setKeyword(event.target.value)} />
        <button type="button" disabled={state.busy} onClick={retry}>刷新</button>
      </div>
    </header>
    {state.status === 'login'
      ? <p className="axon-connector-state">请先在首页设置 accessToken，然后返回此页点击刷新。</p>
      : state.status === 'error'
        ? <div className="axon-connector-state"><p className="am-error">{state.message}</p><button type="button" onClick={retry}>重试</button></div>
        : state.status === 'loading'
          ? <p className="axon-connector-state">加载中…</p>
          : state.items.length === 0
            ? <p className="axon-connector-state">{keyword ? '无搜索结果' : '暂无连接器'}</p>
            : <>
              <div className="axon-connector-grid">
                {state.items.map(item => <article key={item.id} className={`axon-connector-card${item.enabled ? '' : ' is-disabled'}`}>
                  <header><span className="axon-connector-name">{item.name}</span>{item.version && <span className="axon-connector-version">v{item.version}</span>}</header>
                  <div className="axon-connector-badges">
                    {item.frontProtocol && <span className="axon-connector-badge">{item.frontProtocol}</span>}
                    {!item.enabled && <span className="axon-connector-badge is-off">已停用</span>}
                  </div>
                  {item.description && <p className="axon-connector-desc">{item.description}</p>}
                  <footer className="axon-connector-meta">
                    {[item.author, item.releaseDate?.slice(0, 10), ...item.tags].filter(Boolean).join(' · ')}
                  </footer>
                </article>)}
              </div>
              <footer className="axon-connector-footer">
                <span>共 {state.total} 条{state.skipped > 0 ? `，已跳过 ${state.skipped} 条异常数据` : ''}</span>
                {state.pageNum < state.totalPages
                  && <button type="button" disabled={state.busy} onClick={() => void load(state.pageNum + 1, false, keyword)}>加载更多</button>}
              </footer>
            </>}
  </section>;
}

export function ConnectorsPanel() {
  return <div className="axon-connectors">
    <ConnectorSection group="mine" />
    <ConnectorSection group="public" />
  </div>;
}
