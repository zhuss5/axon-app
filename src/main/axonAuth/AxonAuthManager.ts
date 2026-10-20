import type { AxonAuthConfig } from '../../shared/runtime/axonAuth';
import { configFingerprint, httpURL } from './config';
import { requestWithAccessToken } from './AxonApiClient';
import type { AxonTokenStore } from './AxonTokenStore';

export class AxonPlatformError extends Error {
  constructor(public status: number) {
    super(status === 401 ? 'accessToken 已失效，请重新设置（401）'
      : status === 403 ? '当前账户无访问权限（403）' : `AXON 平台请求失败（${status}）`);
  }
}
export interface AuthDependencies {
  store: Pick<AxonTokenStore, 'load' | 'save' | 'clear'>;
  fetch(url: string, init: RequestInit): Promise<Response>;
}

// Manual credentials replace only the login step. Platform calls remain in Main.
export class AxonAuthManager {
  private token: string | null = null;
  private generation = 0;
  private abort = new AbortController();
  constructor(
    private config: AxonAuthConfig,
    private deps: AuthDependencies,
  ) {}
  async restore() { this.token = await this.deps.store.load(configFingerprint(this.config)); }
  async getAccessToken() { return this.token; }
  async requireAccessToken() {
    const token = await this.getAccessToken();
    if (!token) throw new Error('AuthRequired：请先设置 accessToken');
    return token;
  }
  async setAccessToken(input: string) {
    if (typeof input !== 'string' || input.length >= 32768) throw new Error('accessToken 格式无效');
    const token = input.trim();
    if (token) await this.deps.store.save(token, configFingerprint(this.config));
    else await this.deps.store.clear();
    this.generation++;
    this.abort.abort();
    this.abort = new AbortController();
    this.token = token || null;
  }
  async request(url: string, init: RequestInit = {}) {
    const target = httpURL(url, '平台接口');
    if (!this.config.allowedApiOrigins.includes(target.origin)) throw new Error('平台接口不在允许的 Origin 内');
    const generation = this.generation;
    const token = await this.requireAccessToken();
    if (generation !== this.generation) throw new Error('AuthRequired：请先设置 accessToken');
    const response = await requestWithAccessToken(this.config, token, this.deps.fetch, target.href, {
      ...init, signal: AbortSignal.any([this.abort.signal, ...(init.signal ? [init.signal] : [])]),
    });
    if (response.ok) return response;
    try { await response.body?.cancel(); } catch { /* Preserve the API status, as in AXON. */ }
    if (response.status === 401 && generation === this.generation) await this.setAccessToken('');
    throw new AxonPlatformError(response.status);
  }
}
