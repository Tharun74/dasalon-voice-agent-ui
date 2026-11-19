import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

export const highlighter = createHighlighterCore({
  engine: createJavaScriptRegexEngine(),
  langs: [
    import('@shikijs/langs/tsx'),
    import('@shikijs/langs/json'),
    import('@shikijs/langs/shellscript'),
  ],
  themes: [
    import('@shikijs/themes/github-dark-default'),
    import('@shikijs/themes/github-light-default'),
  ],
});
