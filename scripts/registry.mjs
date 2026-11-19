import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const output = resolve(root, 'public/r');
const temp = resolve(root, '.voicekit-registry.build.json');
const origin = (process.env.NEXT_PUBLIC_VOICEKIT_URL || 'http://localhost:3000').replace(/\/$/, '');
const manifest = JSON.parse(await readFile(resolve(root, 'registry.json'), 'utf8'));
manifest.homepage = origin;

for (const item of manifest.items) {
  if (item.registryDependencies) {
    item.registryDependencies = item.registryDependencies.map(dependency => dependency.replace('http://localhost:3000', origin));
  }
}

try {
  await writeFile(temp, JSON.stringify(manifest));
  const result = spawnSync(process.execPath, [
    resolve(root, 'node_modules/shadcn/dist/index.js'), 'build', temp, '--output', output,
  ], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('shadcn build failed.');

  // The repo's ESM build uses .js specifiers. Registry consumers compile TS sources directly.
  for (const name of await readdir(output)) {
    if (!name.endsWith('.json') || name === 'registry.json') continue;
    const path = resolve(output, name);
    const file = JSON.parse(await readFile(path, 'utf8'));
    for (const entry of file.files ?? []) {
      if (/\.tsx?$/.test(entry.path)) {
        entry.content = entry.content.replace(/(\bfrom\s*['"]|\bimport\(\s*['"])(\.\.?\/[^'"]+)\.js(?=['"])/g, '$1$2');
      }
    }
    await writeFile(path, JSON.stringify(file, null, 2) + '\n');
  }
} finally {
  await rm(temp, { force: true });
}
