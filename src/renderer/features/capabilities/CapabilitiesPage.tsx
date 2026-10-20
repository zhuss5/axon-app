import { ExpertsPage } from '../experts/ExpertsPage';

export type CapabilityTab = 'experts' | 'skills' | 'connectors';

export function CapabilitiesPage({ capabilityTab, onTabChange }: {
  capabilityTab: CapabilityTab;
  onTabChange(tab: CapabilityTab): void;
}) {
  return <div className="axon-content axon-expert-center"><div className="axon-capability-tabs" role="tablist" aria-label="能力类型">
    {([['experts', '专家'], ['skills', '技能'], ['connectors', '连接器']] as const).map(([id, label]) =>
      <button key={id} id={`tab-${id}`} role="tab" className={capabilityTab === id ? 'active' : ''} aria-selected={capabilityTab === id} aria-controls="capability-panel" onClick={() => onTabChange(id)}>{label}</button>)}
  </div><section id="capability-panel" role="tabpanel" aria-labelledby={`tab-${capabilityTab}`}>
    {capabilityTab === 'experts' ? <ExpertsPage /> : <div className="axon-empty"><h2>{capabilityTab === 'skills' ? '技能' : '连接器'}</h2><p>暂无平台{capabilityTab === 'skills' ? '技能' : '连接器'}</p></div>}
  </section></div>;
}
