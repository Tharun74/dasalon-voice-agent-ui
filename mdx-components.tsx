import type { MDXComponents } from 'mdx/types';

export function useMDXComponents(components: MDXComponents = {}): MDXComponents {
  return {
    code: props => <code className="inline-code" {...props} />,
    ...components,
  };
}
