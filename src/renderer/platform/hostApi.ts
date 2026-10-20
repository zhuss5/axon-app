import type { PlatformAPI } from '../../shared/runtime/platform';

declare global { interface Window { agentManagerHost: { platformApi: PlatformAPI } } }
export const platform = window.agentManagerHost.platformApi;
