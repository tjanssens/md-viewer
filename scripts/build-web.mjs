// Bundles the frontend into dist/ with esbuild. The editor is split into its
// own chunk so it is only loaded when edit mode is opened.
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const watch = process.argv.includes('--watch');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('web/index.html', 'dist/index.html');
cpSync('web/styles.css', 'dist/styles.css');

const options = {
  entryPoints: { main: 'web/src/main.ts' },
  outdir: 'dist',
  bundle: true,
  splitting: true,
  format: 'esm',
  target: ['chrome105', 'safari15'],
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  chunkNames: 'chunks/[name]-[hash]',
  legalComments: 'none',
  logLevel: 'info'
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
