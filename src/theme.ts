export const THEME_PRESETS = {
  'rose-gold': { label: 'Rose Gold', glow: '#e8a39a', highlight: '#ffdfc4', shadow: '#a63d65' },
  champagne: { label: 'Champagne', glow: '#e5c286', highlight: '#fff1c8', shadow: '#a66b3c' },
  'midnight-noir': { label: 'Midnight Noir', glow: '#aaa7f0', highlight: '#e2dfff', shadow: '#594196' },
  'emerald-spa': { label: 'Emerald Spa', glow: '#76c7ab', highlight: '#d5f5d5', shadow: '#247862' },
  'blush-pastel': { label: 'Blush Pastel', glow: '#f0aec8', highlight: '#ffe3ea', shadow: '#a15d9a' },
} as const;

export type ThemeName = keyof typeof THEME_PRESETS;

export interface BrandColors {
  glow?: string;
  highlight?: string;
  shadow?: string;
}

export function themeVariables(theme: ThemeName = 'rose-gold', brand: BrandColors = {}) {
  const preset = THEME_PRESETS[theme];
  return {
    '--va-glow': brand.glow ?? preset.glow,
    '--va-highlight': brand.highlight ?? preset.highlight,
    '--va-shadow': brand.shadow ?? preset.shadow,
  } as const;
}
