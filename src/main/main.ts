import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AxonTokenStore } from './axonAuth/AxonTokenStore';
import { AxonAuthManager } from './axonAuth/AxonAuthManager';
import { loadAuthConfig } from './axonAuth/config';
import { resolveAssetPaths } from './features/capabilities/assetPaths';
import type { PlatformRequest } from '../shared/runtime/platform';

app.setName('axon');
app.setPath('userData', path.join(app.getPath('appData'), 'axon'));
const paths = resolveAssetPaths(name => app.getPath(name));
let window: BrowserWindow | undefined;

async function start() {
  const root = app.getAppPath();
  const configFile = path.join(root, 'assets/axon-auth-config.json');
  const config = await loadAuthConfig(configFile, process.env.AXON_AUTH_CONFIG || configFile);
  const store = new AxonTokenStore(path.join(paths.userData, 'axon-simple', 'axon-auth-token.json'));
  const apiSession = session.fromPartition('axon-simple-api');
  apiSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  const manager = new AxonAuthManager(config, { store, fetch: (url, init) => apiSession.fetch(url, init) });
  await manager.restore();
  const handlers = {
    'get-state': async () => ({ hasAccessToken: !!await manager.getAccessToken(), allowedApiOrigins: config.allowedApiOrigins }),
    'set-access-token': (token: string) => manager.setAccessToken(token),
    'request': async (input: PlatformRequest) => {
      if (!input || typeof input.url !== 'string' || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(input.method ?? 'GET')
        || input.body !== undefined && typeof input.body !== 'string') throw new Error('请求格式无效');
      const response = await manager.request(input.url, {
        method: input.method ?? 'GET', headers: { Accept: 'application/json', ...(input.body ? { 'Content-Type': 'application/json' } : {}) },
        ...(input.body ? { body: input.body } : {}),
      });
      return { status: response.status, body: await response.text() };
    },
    'open-asset-directory': async (kind: string) => {
      if (kind !== 'experts' && kind !== 'skills' && kind !== 'workflows') throw new Error('未知资产目录');
      await mkdir(paths[kind], { recursive: true });
      const error = await shell.openPath(paths[kind]);
      if (error) throw new Error(error);
    },
  };
  for (const [name, handler] of Object.entries(handlers)) {
    ipcMain.handle(`axon:platform:${name}`, (event, input) => {
      if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame)
        throw new Error('不受信的平台请求');
      return (handler as (input: any) => unknown)(input);
    });
  }
  function createWindow() {
    const rendererFile = path.join(root, 'dist/renderer/index.html');
    const rendererURL = pathToFileURL(rendererFile).href;
    window = new BrowserWindow({
      width: 1440, height: 920, minWidth: 1080, minHeight: 680,
      titleBarStyle: 'hidden', titleBarOverlay: { height: 36 }, title: '灵犀平台集成示例',
      webPreferences: { preload: path.join(__dirname, '../preload/preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, partition: 'persist:axon-simple' },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => { if (url !== rendererURL) event.preventDefault(); });
    void window.loadFile(rendererFile);
    if (process.env.AXON_SIMPLE_DEBUG === '1') window.webContents.openDevTools({ mode: 'detach' });
    window.on('closed', () => { window = undefined; });
  }
  createWindow();
}

app.whenReady().then(start).catch(error => { console.error(error); app.exit(1); });
app.on('window-all-closed', () => app.quit());
