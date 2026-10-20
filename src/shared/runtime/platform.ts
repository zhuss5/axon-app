export interface AssetPaths {
  userData: string;
  workspace: string;
  experts: string;
  skills: string;
  workflows: string;
  mcpConfig: string;
}
export interface PlatformState {
  hasAccessToken: boolean;
  allowedApiOrigins: string[];
}
export interface PlatformRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: string;
}
export interface PlatformAPI {
  getState(): Promise<PlatformState>;
  setAccessToken(token: string): Promise<void>;
  request(input: PlatformRequest): Promise<{ status: number; body: string }>;
  openAssetDirectory(kind: 'experts' | 'skills' | 'workflows'): Promise<void>;
}
