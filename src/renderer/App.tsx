import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { applyAppearance, normalizeAppearance } from '../shared/settings/appearance';
import { HomePage } from './features/home/HomePage';
import { CapabilitiesPage, type CapabilityTab } from './features/capabilities/CapabilitiesPage';
import { WorkflowsPage } from './features/workflows/WorkflowsPage';
import { PipelinePage } from './features/workflows/PipelinePage';
import { LibraryPage } from './features/library/LibraryPage';
import { platform } from './platform/hostApi';
import type { PlatformState } from '../shared/runtime/platform';

type Page = 'home' | 'skills' | 'workflows' | 'pipeline' | 'library';
const navigationItems = [
  ['home', '首页'],
  ['skills', '专家·技能·连接器'],
  ['workflows', '工作流'],
  ['pipeline', '流水线'],
  ['library', '资料库'],
] as const;
const appearanceKey = 'axon.simple.appearance.v1';
function loadAppearance() {
  try { return normalizeAppearance(JSON.parse(localStorage.getItem(appearanceKey) ?? '{}')); }
  catch { return normalizeAppearance(undefined); }
}

export function StandaloneAgentManagerApp() {
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [page, setPage] = useState<Page>('home');
  const [capabilityTab, setCapabilityTab] = useState<CapabilityTab>('experts');
  const [appearance, setAppearance] = useState(loadAppearance);
  const [state, setState] = useState<PlatformState>();
  const [error, setError] = useState('');
  useLayoutEffect(() => {
    applyAppearance(appearance);
    try { localStorage.setItem(appearanceKey, JSON.stringify(appearance)); }
    catch { setError('外观设置未能保存'); }
  }, [appearance]);
  async function refresh() { setState(await platform.getState()); }
  useEffect(() => { void refresh().catch(error => setError(String(error))); }, []);
  function navigateTo(id: Page) { setPage(id); }
  const title = navigationItems.find(([id]) => id === page)![1];
  return <>
    <div className="axon-overlay-titlebar">灵犀平台 · 集成示例</div>
    <main className="am-shell" style={{ '--sidebar-width': `${sidebarCollapsed ? 64 : sidebarWidth}px` } as CSSProperties}>
      <aside className="am-sidebar" aria-label="侧栏">
        <div className="axon-sidebar-actions"><button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>{sidebarCollapsed ? '展开' : '收起侧栏'}</button></div>
        {!sidebarCollapsed && <>
          <div className="axon-brand">平台集成示例</div>
          <nav className="axon-nav" aria-label="主导航">{navigationItems.map(([id, label]) =>
            <button key={id} className={page === id ? 'active' : ''} aria-current={page === id ? 'page' : undefined} onClick={() => navigateTo(id)}>{label}</button>)}</nav>
          <div className="axon-sidebar-footer">
            <label>主题<select aria-label="主题" value={appearance.theme} onChange={event => setAppearance({ ...appearance, theme: event.target.value as 'light' | 'dark' })}><option value="light">浅色</option><option value="dark">深色</option></select></label>
            <label>字号<select aria-label="字号" value={appearance.fontSize} onChange={event => setAppearance({ ...appearance, fontSize: Number(event.target.value) })}>{Array.from({ length: 9 }, (_, i) => i + 12).map(size => <option key={size} value={size}>{size} px</option>)}</select></label>
            <label className="axon-simple-sidebar-width">侧栏宽度：{sidebarWidth}<input aria-label="侧栏宽度" type="range" min="220" max="520" step="10" value={sidebarWidth} onChange={event => setSidebarWidth(Number(event.target.value))} /></label>
          </div>
        </>}
      </aside>
      <div className="axon-pane-divider axon-sidebar-divider" aria-hidden="true" />
      <section className="am-center">
        <header className="am-center-header"><h2>{title}</h2><span className="axon-preview-badge">开发示例</span></header>
        {error && <p className="am-error" role="alert">{error}</p>}
        {!state ? <p className="am-empty">正在读取平台配置…</p> : <>
          {page === 'home' ? <HomePage state={state} refresh={refresh} />
            : page === 'skills' ? <CapabilitiesPage capabilityTab={capabilityTab} onTabChange={setCapabilityTab} />
            : page === 'workflows' ? <WorkflowsPage />
            : page === 'pipeline' ? <PipelinePage />
            : <LibraryPage />}
        </>}
      </section>
    </main>
  </>;
}
