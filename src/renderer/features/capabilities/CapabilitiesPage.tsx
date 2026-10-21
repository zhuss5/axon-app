import { ExpertsPage } from '../experts/ExpertsPage';
import { ConnectorsPanel } from './ConnectorsPanel';

export type CapabilityTab = 'experts' | 'skills' | 'connectors';

export function CapabilitiesPage({ capabilityTab, onTabChange }: {
  capabilityTab: CapabilityTab;
  onTabChange(tab: CapabilityTab): void;
}) {
  return <div className="axon-content axon-expert-center"><div className="axon-capability-tabs" role="tablist" aria-label="能力类型">
    {([['experts', '专家'], ['skills', '技能'], ['connectors', '连接器']] as const).map(([id, label]) =>
      <button key={id} id={`tab-${id}`} role="tab" className={capabilityTab === id ? 'active' : ''} aria-selected={capabilityTab === id} aria-controls="capability-panel" onClick={() => onTabChange(id)}>{label}</button>)}
  </div><section id="capability-panel" role="tabpanel" aria-labelledby={`tab-${capabilityTab}`}>
    {capabilityTab === 'experts' ? <ExpertsPage />
      : capabilityTab === 'connectors' ? <ConnectorsPanel />
      : <div className="axon-empty"><h2>技能</h2><p>暂无平台技能</p></div>}
  </section></div>;
}
