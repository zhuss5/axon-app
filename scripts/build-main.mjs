import { build } from 'esbuild';

for (const part of ['main', 'preload']) {
  await build({
    entryPoints: [`src/${part}/${part}.ts`], outfile: `dist/${part}/${part}.js`,
    bundle: true, platform: 'node', format: 'cjs', target: 'node22',
    external: ['electron'], sourcemap: true,
  });
}
