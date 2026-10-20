import path from 'node:path';
import type { AssetPaths } from '../../../shared/runtime/platform';

type HostDirectory = 'userData' | 'home' | 'documents';

// The host supplies system directories. Business pages do not construct installation paths.
export function resolveAssetPaths(getPath: (name: HostDirectory) => string): AssetPaths {
  const home = getPath('home');
  const userData = getPath('userData');
  return {
    userData,
    workspace: path.join(getPath('documents'), 'axon'),
    experts: path.join(userData, 'experts'),
    skills: path.join(home, '.config', 'opencode', 'skills'),
    workflows: path.join(home, '.opencode', 'workflows'),
    mcpConfig: path.join(home, '.config', 'opencode', 'opencode.json'),
  };
}
