import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { AxonAuthConfig } from '../../shared/runtime/axonAuth';

export function httpURL(value: unknown, name: string): URL {
  try {
    const url = new URL(String(value));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    return url;
  } catch { throw new Error(`${name} 必须是 HTTP 或 HTTPS 地址，不能包含用户名和密码`); }
}

export function parseAuthConfig(raw: unknown): AxonAuthConfig {
  const origins = (raw as Partial<AxonAuthConfig> | null)?.allowedApiOrigins;
  if (!Array.isArray(origins) || !origins.length) throw new Error('请配置 allowedApiOrigins');
  return {
    allowedApiOrigins: [...new Set(origins.map(value => {
      const url = httpURL(value, 'allowedApiOrigins');
      if (url.href !== `${url.origin}/`) throw new Error('allowedApiOrigins 只能包含协议、主机和端口');
      return url.origin;
    }))],
  };
}

export function configFingerprint(config: AxonAuthConfig) {
  return createHash('sha256').update(JSON.stringify(config)).digest('hex');
}

export async function loadAuthConfig(bundled: string, override: string) {
  try { return parseAuthConfig(JSON.parse(await readFile(override, 'utf8'))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  return parseAuthConfig(JSON.parse(await readFile(bundled, 'utf8')));
}
