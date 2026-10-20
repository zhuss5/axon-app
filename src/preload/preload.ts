import { contextBridge, ipcRenderer } from 'electron';
import type { PlatformAPI } from '../shared/runtime/platform';

const platform: PlatformAPI = {
  getState: () => ipcRenderer.invoke('axon:platform:get-state'),
  setAccessToken: token => ipcRenderer.invoke('axon:platform:set-access-token', token),
  request: input => ipcRenderer.invoke('axon:platform:request', input),
  openAssetDirectory: kind => ipcRenderer.invoke('axon:platform:open-asset-directory', kind),
};
contextBridge.exposeInMainWorld('agentManagerHost', { platformApi: platform });
