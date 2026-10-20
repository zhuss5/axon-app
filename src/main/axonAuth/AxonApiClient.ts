import type { AxonAuthConfig } from '../../shared/runtime/axonAuth';
import { httpURL } from './config';

export async function requestWithAccessToken(
  config: AxonAuthConfig,
  token: string,
  fetcher: (url: string, init: RequestInit) => Promise<Response>,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const target = httpURL(url, '平台接口');
  if (!config.allowedApiOrigins.includes(target.origin)) throw new Error('平台接口不在允许的 Origin 内');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetcher(target.href, {
    ...init, headers, credentials: 'omit', redirect: 'manual', cache: 'no-store',
    signal: AbortSignal.any([...(init.signal ? [init.signal] : []), AbortSignal.timeout(30000)]),
  });
}
