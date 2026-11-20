'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { FileCode2 } from 'lucide-react';
import { CopyButton } from '@/components/copy-button';

type Line = { content: string; dark?: string; light?: string }[];

export function CodeBlock({ code, filename, lang = 'tsx', highlight = [] }: {
  code: string; filename: string; lang?: 'tsx' | 'json' | 'shellscript'; highlight?: number[];
}) {
  const block = useRef<HTMLDivElement>(null);
  const [nearby, setNearby] = useState(false);
  const [result, setResult] = useState<{ source: string; lines: Line[] }>();
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setNearby(true);
      return;
    }
    const element = block.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      setNearby(true);
    }, { rootMargin: '160px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearby) return;
    let active = true;
    void import('@/site/highlighter').then(async ({ highlighter }) => {
      const syntax = await highlighter;
      if (!active) return;
      const { tokens } = syntax.codeToTokens(code, {
        lang, themes: { light: 'github-light-default', dark: 'github-dark-default' },
        defaultColor: false,
      });
      setResult({ source: code, lines: tokens.map(line => line.map(token => {
        const styles = token.htmlStyle as Record<string, string> | undefined;
        return { content: token.content, dark: styles?.['--shiki-dark'], light: styles?.['--shiki-light'] };
      })) });
    }).catch(() => {});
    return () => { active = false; };
  }, [code, lang, nearby]);
  const lines: Line[] = result?.source === code ? result.lines : code.split('\n').map(content => [{ content }]);

  return <div ref={block} className="min-w-0 overflow-hidden rounded-lg border bg-card">
    <div className="flex h-10 items-center justify-between gap-2 border-b px-2.5 pl-3.5">
      <span className="flex min-w-0 items-center gap-2 truncate font-mono text-xs text-muted-foreground">
        <FileCode2 aria-hidden="true" className="size-3.5 shrink-0" /><span className="truncate">{filename}</span>
      </span>
      <CopyButton text={code} />
    </div>
    <pre tabIndex={0} aria-label={filename} className="syntax-code max-h-[460px] overflow-auto py-3">
      <code>
        {lines.map((tokens, index) => <span className={`code-line${highlight.includes(index + 1) ? ' is-highlighted' : ''}`} key={index}>
          <span className="line-counter" aria-hidden="true">{index + 1}</span>
          <span>{tokens.map((token, column) => <span key={column} className={token.dark ? 'token' : undefined}
            style={{ '--syntax-dark': token.dark, '--syntax-light': token.light } as CSSProperties}>{token.content}</span>)}</span>
        </span>)}
      </code>
    </pre>
  </div>;
}
