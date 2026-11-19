'use client';

import { useState } from 'react';
import { Terminal } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CopyButton } from '@/components/copy-button';

const managers = ['npm', 'pnpm', 'yarn', 'bun'] as const;
type Manager = (typeof managers)[number];
const defaults = {
  npm: 'npx', pnpm: 'pnpm dlx', yarn: 'yarn dlx', bun: 'bunx',
};
const installs = {
  npm: 'npm install', pnpm: 'pnpm add', yarn: 'yarn add', bun: 'bun add',
};

export function PackageCommand({ command, install = false }: { command: string; install?: boolean }) {
  const [manager, setManager] = useState<Manager>('npm');
  return <div className="overflow-hidden rounded-lg border bg-card">
    <Tabs value={manager} onValueChange={value => setManager(value as Manager)} className="gap-0">
      <div className="flex h-9 items-center justify-between border-b px-2.5">
        <TabsList className="h-7 gap-0.5 bg-transparent p-0" aria-label="Package manager">
          {managers.map(item => <TabsTrigger className="h-6 rounded px-2 font-mono text-[11px]" value={item} key={item}>{item}</TabsTrigger>)}
        </TabsList>
        <Terminal aria-hidden="true" className="mr-1 size-3.5 text-muted-foreground" />
      </div>
      {managers.map(item => {
        const full = `${(install ? installs : defaults)[item]} ${command}`;
        return <TabsContent value={item} key={item} className="min-w-0">
          <div className="flex min-w-0 items-center justify-between gap-2 py-1.5 pr-2 pl-3.5">
            <code className="overflow-x-auto whitespace-nowrap font-mono text-[11px] sm:text-xs">{full}</code>
            <CopyButton text={full} label="Copy install command" />
          </div>
        </TabsContent>;
      })}
    </Tabs>
  </div>;
}
