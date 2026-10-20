import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
const binary = process.env.ELECTRON_BIN || require('electron');
if (!existsSync(binary)) throw new Error('Electron 未安装，请先运行 npm install，或设置 ELECTRON_BIN');
const env = { ...process.env, AXON_SIMPLE_DEBUG: '1' };
delete env.ELECTRON_RUN_AS_NODE;
// The integration app uses manually supplied credentials; Chromium must not prompt for an OS keychain in debug.
const child = spawn(binary, ['--use-mock-keychain', '--inspect=9230', '.'], { stdio: 'inherit', env });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
child.once('error', error => { console.error(error.message); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });
