import { useState } from 'react';
import type { PlatformRequest, PlatformState } from '../../../shared/runtime/platform';
import { platform } from '../../platform/hostApi';

export function HomePage({ state, refresh }: { state: PlatformState; refresh(): Promise<void> }) {
  const [token, setToken] = useState('');
  const [url, setUrl] = useState(state.allowedApiOrigins[0] + '/');
  const [method, setMethod] = useState<PlatformRequest['method']>('GET');
  const [body, setBody] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function saveToken(clear = false) {
    setBusy(true); setNotice('');
    try {
      await platform.setAccessToken(clear ? '' : token);
      setToken(''); await refresh(); setNotice(clear ? 'accessToken 已清除' : 'accessToken 已保存');
    } catch (error) { setNotice(String(error)); }
    finally { setBusy(false); }
  }
  async function request() {
    setBusy(true); setResult('请求中…');
    try {
      const response = await platform.request({ url, method, ...(method !== 'GET' && body ? { body } : {}) });
      let text = response.body;
      try { text = JSON.stringify(JSON.parse(text), null, 2); } catch { /* Display text responses verbatim. */ }
      setResult(`HTTP ${response.status}\n${text}`);
    } catch (error) { setResult(String(error)); }
    finally { await refresh().catch(() => {}); setBusy(false); }
  }
  return <div className="axon-content axon-simple-home"><div className="axon-simple-connection-grid">
    <section className="axon-simple-panel"><h2>平台连接</h2><p className="axon-simple-hint">手动设置平台 accessToken，供集成功能调用。</p>
      <form onSubmit={event => { event.preventDefault(); void saveToken(); }}>
        <label>accessToken <span className="axon-preview-badge">{state.hasAccessToken ? '已设置' : '未设置'}</span><input type="password" autoComplete="off" value={token} onChange={event => setToken(event.target.value)} placeholder="粘贴 accessToken" /></label>
        <div className="axon-simple-actions"><button type="submit" disabled={busy || !token.trim()}>保存 token</button><button type="button" disabled={busy || !state.hasAccessToken} onClick={() => void saveToken(true)}>清除 token</button></div>
      </form><p role="status">{notice}</p>
    </section>
    <section className="axon-simple-panel"><h2>请求调试</h2><p className="axon-simple-hint">允许的接口来源：{state.allowedApiOrigins.join('、')}</p>
      <form onSubmit={event => { event.preventDefault(); void request(); }}>
        <div className="axon-simple-request-line"><label>方法<select value={method} onChange={event => setMethod(event.target.value as PlatformRequest['method'])}>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(value => <option key={value}>{value}</option>)}</select></label><label>接口地址<input type="url" required value={url} onChange={event => setUrl(event.target.value)} /></label></div>
        {method !== 'GET' && <label>请求体（JSON）<textarea value={body} onChange={event => setBody(event.target.value)} placeholder={'{"example": true}'} /></label>}
        <button type="submit" disabled={busy || !state.hasAccessToken}>{busy ? '处理中…' : '发送请求'}</button>
      </form>{result && <pre aria-live="polite">{result}</pre>}
    </section>
    </div><details className="axon-simple-panel"><summary>资产目录</summary><p className="axon-simple-hint">目录由主进程通过系统 API 解析。</p>
      <div className="axon-simple-actions">{(['experts', 'skills', 'workflows'] as const).map((kind, index) => <button key={kind} disabled={busy} onClick={() => { void platform.openAssetDirectory(kind).catch(error => setNotice(String(error))); }}>打开{['专家', '技能', '工作流'][index]}目录</button>)}</div>
    </details>
  </div>;
}
