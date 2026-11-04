import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';

const output = resolve('release');
mkdirSync(resolve(output, 'dist'), { recursive: true });
await build({
  entryPoints: ['src/index.ts'],
  outfile: resolve(output, 'dist/index.js'),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  minifyWhitespace: true,
  external: ['effect'],
  preserveSymlinks: true,
});
const extraction = Extractor.invoke(ExtractorConfig.loadFileAndPrepare('api-extractor.json'), {
  localBuild: true,
  showVerboseMessages: false,
});
assert.ok(extraction.succeeded, 'Client declaration bundling failed');
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
delete manifest.devDependencies['@softmax-universe/models-protocol'];
copyFileSync('README.md', resolve(output, 'README.md'));
writeFileSync(resolve(output, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
for (const file of ['dist/index.js', 'dist/index.d.ts', 'package.json']) {
  assert.ok(
    !/@softmax-universe\/|workspace:|cloudflare:workers/.test(
      readFileSync(resolve(output, file), 'utf8'),
    ),
    `Private dependency in public client ${file}`,
  );
}
