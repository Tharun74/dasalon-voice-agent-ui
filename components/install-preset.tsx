import { CodeBlock } from '@/components/code-block';
import { PackageCommand } from '@/components/package-command';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { registryOrigin } from '@/site/catalog';
import type { CatalogEntry } from '@/site/catalog';

export const namespaceConfig = JSON.stringify({ registries: { '@voicekit': `${registryOrigin}/r/{name}.json` } }, null, 2);

function copyScript(item: CatalogEntry) {
  return `import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const registry = '${registryOrigin}/r';
const sourceRoot = existsSync('src') ? 'src' : '.';
const items = ['voicekit-core', '${item.slug}'];

for (const name of items) {
  const response = await fetch(\`\${registry}/\${name}.json\`);
  if (!response.ok) throw new Error(\`Could not fetch \${name}: \${response.status}\`);
  const { files } = await response.json();

  for (const { target, content } of files) {
    if (!target.startsWith('@components/voicekit/') || target.includes('..')) {
      throw new Error(\`Unexpected target: \${target}\`);
    }
    const file = join(sourceRoot, target.replace('@components/', 'components/'));
    await mkdir(dirname(file), { recursive: true });
    try {
      await writeFile(file, content, { flag: 'wx' });
    } catch (error) {
      if (error.code !== 'EEXIST' || await readFile(file, 'utf8') !== content) throw error;
    }
  }
}`;
}

export function InstallPreset({ item }: { item: CatalogEntry }) {
  return <Tabs defaultValue="cli" className="gap-3">
    <TabsList className="w-fit" aria-label="Installation approach"><TabsTrigger value="cli">CLI</TabsTrigger><TabsTrigger value="manual">Manual</TabsTrigger></TabsList>
    <TabsContent value="cli" className="min-w-0 space-y-3">
      <p className="prose-copy">Run this from a project initialized with shadcn. The registry also installs the shared audio and motion utilities.</p>
      <PackageCommand command={`shadcn@latest add ${registryOrigin}/r/${item.slug}.json`} />
      <details className="rounded-lg border bg-card px-3.5 py-3 text-sm">
        <summary className="cursor-pointer font-medium">Install with the @voicekit namespace</summary>
        <div className="mt-3 space-y-3">
          <p className="prose-copy">Merge this registry entry into your project’s <code className="inline-code">components.json</code>.</p>
          <CodeBlock code={namespaceConfig} filename="components.json" lang="json" highlight={[3]} />
          <PackageCommand command={`shadcn@latest add @voicekit/${item.slug}`} />
        </div>
      </details>
    </TabsContent>
    <TabsContent value="manual" className="min-w-0 space-y-4">
      <div className="space-y-2"><h3 className="text-sm font-semibold">1. Install the renderer</h3><p className="prose-copy">These scenes use Three.js directly. Fiber, Drei and postprocessing are only needed if your project also uses those integrations.</p>
        <PackageCommand command="three" install />
        <CodeBlock code="npm install -D @types/three\n# For projects using React Three Fiber or postprocessing:\nnpm install @react-three/fiber @react-three/drei @react-three/postprocessing postprocessing" filename="Terminal" lang="shellscript" />
      </div>
      <div className="space-y-2"><h3 className="text-sm font-semibold">2. Copy the source files</h3><p className="prose-copy">Save the script below at your app root, then run <code className="inline-code">node install-voicekit.mjs</code>. It preserves the directory layout and protects existing files from overwrites.</p>
        <CodeBlock code={copyScript(item)} filename="install-voicekit.mjs" />
      </div>
      <div className="space-y-2"><h3 className="text-sm font-semibold">3. Import the component</h3>
        <CodeBlock code={`import { ${item.exportName} } from '@/components/voicekit/presets/${item.variant}';\nimport { DemoAdapter } from '@/components/voicekit/adapters';`} filename="voice-preview.tsx" highlight={[1]} />
      </div>
    </TabsContent>
  </Tabs>;
}
