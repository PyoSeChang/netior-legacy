import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Locale, TranslationKey } from '@netior/shared/i18n';

type CssVariableMap = Record<string, string>;

interface PrimaryPresetDefinition {
  id: string;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  color: string;
}

interface ThemeVariantDefinition {
  id: string;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  preview: [string, string, string];
  overrides: CssVariableMap;
  recommendedPrimaryPresetIds: readonly string[];
}

interface ThemeFamilyDefinition {
  id: string;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  preview: [string, string, string];
  defaultVariant: string;
  variants: readonly ThemeVariantDefinition[];
}

export type AppearanceMode = 'system' | 'dark' | 'light';
export type ThemePrimaryMode = 'preset' | 'custom';
export type DetachedAgentToastMode = 'always' | 'inactive-only';
export type FieldComplexityLevel = 'basic' | 'standard' | 'advanced';
export type NetworkViewerPlacement = 'network-left' | 'network-right';
export type ThemeFamily = ThemeFamilyDefinition['id'];
export type ResolvedThemeMode = 'dark' | 'light';
export type PrimaryPresetId = string;
export type TerminalPresetId = 'hyper' | 'netior' | 'codex' | 'claude' | 'powershell';
export type AppFontRole = 'ui' | 'body' | 'code';

export interface BrowserSettingsConfig {
  homeUrl: string;
  openLinksInApp: boolean;
  openPopupsInTabs: boolean;
  showDownloadToast: boolean;
}

export interface FontRoleConfig {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
}

export interface TypographyConfig {
  ui: FontRoleConfig;
  body: FontRoleConfig;
  code: FontRoleConfig;
}

interface TerminalPresetDefinition {
  id: TerminalPresetId;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  preview: [string, string, string];
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  paddingX: number;
  paddingY: number;
  cursorBlink: boolean;
  webGLRenderer: boolean;
}

export interface TerminalAppearanceConfig {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  paddingX: number;
  paddingY: number;
  cursorBlink: boolean;
  webGLRenderer: boolean;
}

export interface ThemeSlotConfig {
  family: ThemeFamily;
  variant: string;
  primaryMode: ThemePrimaryMode;
  primaryPresetId: PrimaryPresetId;
  primaryCustomColor: string;
  tokenOverrides: CssVariableMap;
}

export type ThemeColorTokenId =
  | 'surface-chrome'
  | 'surface-rail'
  | 'surface-canvas'
  | 'surface-editor'
  | 'surface-panel'
  | 'surface-card'
  | 'surface-floating'
  | 'surface-input'
  | 'surface-node'
  | 'surface-node-selected'
  | 'state-hover-bg'
  | 'state-selected-bg'
  | 'state-muted-bg'
  | 'state-drop-bg'
  | 'accent'
  | 'accent-hover'
  | 'accent-muted'
  | 'border-default'
  | 'border-subtle'
  | 'border-strong'
  | 'border-accent';

interface ThemeColorTokenDefinition {
  id: ThemeColorTokenId;
  label: string;
  description: string;
  cssVar: string;
}

interface ThemeTokenPresetDefinition {
  id: string;
  label: string;
  description: string;
  source: string;
  preview: [string, string, string];
  tokenOverrides: CssVariableMap;
  primaryColor: string;
}

interface SettingsSyncState {
  appearanceMode: AppearanceMode;
  lightTheme: ThemeSlotConfig;
  darkTheme: ThemeSlotConfig;
  locale: Locale;
  detachedAgentToastMode: DetachedAgentToastMode;
  nativeAgentNotificationsEnabled: boolean;
  agentNotificationSoundEnabled: boolean;
  fieldComplexityLevel: FieldComplexityLevel;
  networkViewerPlacement: NetworkViewerPlacement;
  typography: TypographyConfig;
  terminalPresetId: TerminalPresetId;
  terminalAppearance: TerminalAppearanceConfig;
  browser: BrowserSettingsConfig;
}

const DEFAULT_TERMINAL_PRESET_ID: TerminalPresetId = 'hyper';
const DEFAULT_BROWSER_SETTINGS: BrowserSettingsConfig = {
  homeUrl: 'https://www.google.com/',
  openLinksInApp: true,
  openPopupsInTabs: true,
  showDownloadToast: true,
};

const CSS_GENERIC_FONT_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'emoji',
  'math',
  'fangsong',
  'cursive',
  'fantasy',
  '-apple-system',
  'blinkmacsystemfont',
  'sfmono-regular',
]);

const UI_FONT_FALLBACKS = [
  'Pretendard Variable',
  'Pretendard',
  'Segoe UI',
  '-apple-system',
  'BlinkMacSystemFont',
  'system-ui',
  'Roboto',
  'Helvetica Neue',
  'Apple SD Gothic Neo',
  'Noto Sans KR',
  'Malgun Gothic',
  'Apple Color Emoji',
  'Segoe UI Emoji',
  'Segoe UI Symbol',
  'sans-serif',
] as const;

const BODY_FONT_FALLBACKS = [
  'Pretendard Variable',
  'Pretendard',
  'Segoe UI',
  '-apple-system',
  'BlinkMacSystemFont',
  'system-ui',
  'Roboto',
  'Helvetica Neue',
  'Apple SD Gothic Neo',
  'Noto Sans KR',
  'Malgun Gothic',
  'sans-serif',
] as const;

const CODE_FONT_FALLBACKS = [
  'Fira Code',
  'JetBrains Mono',
  'Cascadia Mono',
  'Cascadia Code',
  'ui-monospace',
  'SFMono-Regular',
  'Menlo',
  'Monaco',
  'Consolas',
  'Liberation Mono',
  'Courier New',
  'monospace',
] as const;

const FONT_ROLE_LIMITS: Record<AppFontRole, { minSize: number; maxSize: number }> = {
  ui: { minSize: 14, maxSize: 18 },
  body: { minSize: 12, maxSize: 24 },
  code: { minSize: 11, maxSize: 24 },
};

function getRendererPlatform(): 'win32' | 'darwin' | 'linux' {
  if (typeof navigator === 'undefined') return 'win32';
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const source = `${nav.userAgentData?.platform ?? ''} ${navigator.platform ?? ''}`.toLowerCase();
  if (source.includes('mac')) return 'darwin';
  if (source.includes('win')) return 'win32';
  return 'linux';
}

function normalizeFontFamilyName(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function quoteCssFontFamily(value: string): string {
  const normalized = normalizeFontFamilyName(value);
  if (normalized.length === 0) return '';
  if (CSS_GENERIC_FONT_FAMILIES.has(normalized.toLowerCase())) return normalized;
  return /\s/.test(normalized) ? `"${normalized}"` : normalized;
}

function buildFontFamilyStack(primary: string, fallbacks: readonly string[]): string {
  const values = [primary, ...fallbacks]
    .map(normalizeFontFamilyName)
    .filter((value, index, list) => value.length > 0 && list.indexOf(value) === index)
    .map(quoteCssFontFamily)
    .filter((value) => value.length > 0);
  return values.join(', ');
}

export function getPrimaryFontFamily(fontFamily: string): string {
  return fontFamily
    .split(',')
    .map(normalizeFontFamilyName)
    .find((part) => part.length > 0) ?? '';
}

function getDefaultPrimaryFontFamily(role: AppFontRole | 'terminal'): string {
  const platform = getRendererPlatform();
  if (role === 'ui' || role === 'body') {
    if (platform === 'darwin') return 'Helvetica Neue';
    if (platform === 'linux') return 'Noto Sans';
    return 'Segoe UI';
  }

  if (platform === 'darwin') return 'Menlo';
  if (platform === 'linux') return 'DejaVu Sans Mono';
  return 'Consolas';
}

export function buildRoleFontFamily(role: AppFontRole | 'terminal', primaryFontFamily: string): string {
  const normalizedPrimary = normalizeFontFamilyName(primaryFontFamily) || getDefaultPrimaryFontFamily(role);
  const fallbacks = role === 'ui'
    ? UI_FONT_FALLBACKS
    : role === 'body'
      ? BODY_FONT_FALLBACKS
      : CODE_FONT_FALLBACKS;
  return buildFontFamilyStack(normalizedPrimary, fallbacks);
}

function getDefaultTypographyConfig(): TypographyConfig {
  return {
    ui: {
      fontFamily: buildRoleFontFamily('ui', getDefaultPrimaryFontFamily('ui')),
      fontSize: 16,
      lineHeight: 1.5,
      letterSpacing: 0,
    },
    body: {
      fontFamily: buildRoleFontFamily('body', getDefaultPrimaryFontFamily('body')),
      fontSize: 15,
      lineHeight: 1.7,
      letterSpacing: 0,
    },
    code: {
      fontFamily: buildRoleFontFamily('code', getDefaultPrimaryFontFamily('code')),
      fontSize: 13,
      lineHeight: 1.6,
      letterSpacing: 0,
    },
  };
}

const TERMINAL_PRESETS: readonly TerminalPresetDefinition[] = [
  {
    id: 'hyper',
    labelKey: 'settings.terminalPresets.hyper.label',
    descriptionKey: 'settings.terminalPresets.hyper.description',
    preview: ['#000000', '#ffffff', '#58a6ff'],
    fontFamily: buildRoleFontFamily('terminal', getDefaultPrimaryFontFamily('terminal')),
    fontSize: 12,
    lineHeight: 1,
    letterSpacing: 0,
    paddingX: 14,
    paddingY: 12,
    cursorBlink: false,
    webGLRenderer: false,
  },
  {
    id: 'netior',
    labelKey: 'settings.terminalPresets.netior.label',
    descriptionKey: 'settings.terminalPresets.netior.description',
    preview: ['#181818', '#d4d4d4', '#0d99ff'],
    fontFamily: buildRoleFontFamily('terminal', getDefaultPrimaryFontFamily('terminal')),
    fontSize: 12,
    lineHeight: 1,
    letterSpacing: 0,
    paddingX: 14,
    paddingY: 12,
    cursorBlink: false,
    webGLRenderer: false,
  },
  {
    id: 'codex',
    labelKey: 'settings.terminalPresets.codex.label',
    descriptionKey: 'settings.terminalPresets.codex.description',
    preview: ['#0b1220', '#dce6ff', '#6fb1ff'],
    fontFamily: buildRoleFontFamily('terminal', 'Cascadia Mono'),
    fontSize: 12,
    lineHeight: 1.05,
    letterSpacing: 0,
    paddingX: 14,
    paddingY: 12,
    cursorBlink: false,
    webGLRenderer: false,
  },
  {
    id: 'claude',
    labelKey: 'settings.terminalPresets.claude.label',
    descriptionKey: 'settings.terminalPresets.claude.description',
    preview: ['#171311', '#f3e8dc', '#d0a36f'],
    fontFamily: buildRoleFontFamily('terminal', 'Iosevka Term'),
    fontSize: 12,
    lineHeight: 1.08,
    letterSpacing: 0,
    paddingX: 14,
    paddingY: 12,
    cursorBlink: false,
    webGLRenderer: false,
  },
  {
    id: 'powershell',
    labelKey: 'settings.terminalPresets.powershell.label',
    descriptionKey: 'settings.terminalPresets.powershell.description',
    preview: ['#012456', '#f0f6fc', '#00bcf2'],
    fontFamily: buildRoleFontFamily('terminal', 'Cascadia Mono'),
    fontSize: 13,
    lineHeight: 1.05,
    letterSpacing: 0,
    paddingX: 12,
    paddingY: 10,
    cursorBlink: false,
    webGLRenderer: false,
  },
] as const;

const PRIMARY_PRESETS: readonly PrimaryPresetDefinition[] = [
  { id: 'gray', labelKey: 'settings.primaryPresets.gray.label', descriptionKey: 'settings.primaryPresets.gray.description', color: '#7a7a7a' },
  { id: 'warm-gray', labelKey: 'settings.primaryPresets.warmGray.label', descriptionKey: 'settings.primaryPresets.warmGray.description', color: '#8f7f73' },
  { id: 'cool-gray', labelKey: 'settings.primaryPresets.coolGray.label', descriptionKey: 'settings.primaryPresets.coolGray.description', color: '#77808c' },
  { id: 'violet', labelKey: 'settings.primaryPresets.violet.label', descriptionKey: 'settings.primaryPresets.violet.description', color: '#9b8cff' },
  { id: 'mint', labelKey: 'settings.primaryPresets.mint.label', descriptionKey: 'settings.primaryPresets.mint.description', color: '#66cbb0' },
  { id: 'peach', labelKey: 'settings.primaryPresets.peach.label', descriptionKey: 'settings.primaryPresets.peach.description', color: '#e49d7a' },
  { id: 'teal', labelKey: 'settings.primaryPresets.teal.label', descriptionKey: 'settings.primaryPresets.teal.description', color: '#1fa29a' },
  { id: 'moss', labelKey: 'settings.primaryPresets.moss.label', descriptionKey: 'settings.primaryPresets.moss.description', color: '#568b5f' },
  { id: 'amber', labelKey: 'settings.primaryPresets.amber.label', descriptionKey: 'settings.primaryPresets.amber.description', color: '#c88733' },
  { id: 'ember', labelKey: 'settings.primaryPresets.ember.label', descriptionKey: 'settings.primaryPresets.ember.description', color: '#c45b3c' },
  { id: 'sky', labelKey: 'settings.primaryPresets.sky.label', descriptionKey: 'settings.primaryPresets.sky.description', color: '#0d99ff' },
] as const;

const THEME_FAMILIES: readonly ThemeFamilyDefinition[] = [
  {
    id: 'alloy',
    labelKey: 'settings.themeFamilies.alloy.label',
    descriptionKey: 'settings.themeFamilies.alloy.description',
    preview: ['#d4d4d4', '#7a7a7a', '#141414'],
    defaultVariant: 'neutral',
    variants: [
      {
        id: 'neutral',
        labelKey: 'settings.themeFamilies.alloy.variants.neutral.label',
        descriptionKey: 'settings.themeFamilies.alloy.variants.neutral.description',
        preview: ['#d4d4d4', '#7a7a7a', '#141414'],
        overrides: {},
        recommendedPrimaryPresetIds: ['gray', 'violet', 'teal'],
      },
      {
        id: 'warm',
        labelKey: 'settings.themeFamilies.alloy.variants.warm.label',
        descriptionKey: 'settings.themeFamilies.alloy.variants.warm.description',
        preview: ['#ddd6cf', '#8f7f73', '#1b1714'],
        overrides: {
          '--palette-neutral-50': 'hsl(28, 18%, 95%)',
          '--palette-neutral-100': 'hsl(26, 15%, 90%)',
          '--palette-neutral-200': 'hsl(24, 12%, 82%)',
          '--palette-neutral-300': 'hsl(22, 10%, 70%)',
          '--palette-neutral-400': 'hsl(20, 8%, 56%)',
          '--palette-neutral-500': 'hsl(18, 8%, 38%)',
          '--palette-neutral-600': 'hsl(16, 9%, 28%)',
          '--palette-neutral-700': 'hsl(14, 10%, 21%)',
          '--palette-neutral-800': 'hsl(12, 11%, 16%)',
          '--palette-neutral-900': 'hsl(10, 13%, 11%)',
          '--palette-neutral-950': 'hsl(8, 14%, 8%)',
          '--theme-background-image': 'radial-gradient(circle at top left, hsla(24, 12%, 58%, 0.10), transparent 24%), radial-gradient(circle at bottom right, hsla(16, 10%, 28%, 0.14), transparent 28%)',
          '--theme-dark-surface-chrome': 'hsl(18, 14%, 8%)',
          '--theme-dark-surface-panel': 'hsl(18, 12%, 10%)',
          '--theme-dark-surface-card': 'hsl(18, 11%, 13%)',
          '--theme-dark-state-hover-bg': 'hsl(18, 10%, 18%)',
          '--theme-dark-surface-floating': 'hsl(18, 13%, 9%)',
          '--theme-dark-surface-input': 'hsl(18, 10%, 12%)',
          '--theme-light-surface-chrome': 'hsl(28, 24%, 94%)',
          '--theme-light-surface-panel': 'hsl(28, 18%, 97%)',
          '--theme-light-surface-card': 'hsl(28, 16%, 95%)',
          '--theme-light-state-hover-bg': 'hsl(26, 14%, 89%)',
          '--theme-light-surface-floating': 'hsl(28, 16%, 98%)',
          '--theme-light-surface-input': 'hsl(30, 14%, 99%)',
        },
        recommendedPrimaryPresetIds: ['warm-gray', 'amber', 'ember'],
      },
      {
        id: 'cool',
        labelKey: 'settings.themeFamilies.alloy.variants.cool.label',
        descriptionKey: 'settings.themeFamilies.alloy.variants.cool.description',
        preview: ['#d8dee7', '#7d8ca2', '#11161c'],
        overrides: {
          '--palette-neutral-50': 'hsl(216, 24%, 96%)',
          '--palette-neutral-100': 'hsl(216, 18%, 91%)',
          '--palette-neutral-200': 'hsl(216, 14%, 82%)',
          '--palette-neutral-300': 'hsl(216, 12%, 71%)',
          '--palette-neutral-400': 'hsl(216, 10%, 58%)',
          '--palette-neutral-500': 'hsl(216, 10%, 40%)',
          '--palette-neutral-600': 'hsl(216, 12%, 29%)',
          '--palette-neutral-700': 'hsl(216, 14%, 22%)',
          '--palette-neutral-800': 'hsl(216, 16%, 17%)',
          '--palette-neutral-900': 'hsl(216, 18%, 11%)',
          '--palette-neutral-950': 'hsl(216, 20%, 8%)',
          '--theme-background-image': 'radial-gradient(circle at top left, hsla(216, 18%, 58%, 0.09), transparent 24%), radial-gradient(circle at bottom right, hsla(216, 16%, 26%, 0.13), transparent 28%)',
          '--theme-dark-surface-chrome': 'hsl(216, 20%, 8%)',
          '--theme-dark-surface-panel': 'hsl(216, 17%, 10%)',
          '--theme-dark-surface-card': 'hsl(216, 15%, 13%)',
          '--theme-dark-state-hover-bg': 'hsl(216, 13%, 18%)',
          '--theme-dark-surface-floating': 'hsl(216, 18%, 9%)',
          '--theme-dark-surface-input': 'hsl(216, 15%, 12%)',
          '--theme-light-surface-chrome': 'hsl(216, 24%, 95%)',
          '--theme-light-surface-panel': 'hsl(216, 18%, 98%)',
          '--theme-light-surface-card': 'hsl(216, 16%, 96%)',
          '--theme-light-state-hover-bg': 'hsl(216, 14%, 90%)',
          '--theme-light-surface-floating': 'hsl(216, 18%, 99%)',
          '--theme-light-surface-input': 'hsl(216, 18%, 99%)',
        },
        recommendedPrimaryPresetIds: ['cool-gray', 'sky', 'teal'],
      },
    ],
  },
  {
    id: 'hearth',
    labelKey: 'settings.themeFamilies.hearth.label',
    descriptionKey: 'settings.themeFamilies.hearth.description',
    preview: ['#ddd6cf', '#8b7f75', '#1b1714'],
    defaultVariant: 'warm',
    variants: [
      {
        id: 'warm',
        labelKey: 'settings.themeFamilies.hearth.variants.warm.label',
        descriptionKey: 'settings.themeFamilies.hearth.variants.warm.description',
        preview: ['#ddd6cf', '#8b7f75', '#1b1714'],
        overrides: {},
        recommendedPrimaryPresetIds: ['warm-gray', 'amber', 'ember'],
      },
      {
        id: 'paper',
        labelKey: 'settings.themeFamilies.hearth.variants.paper.label',
        descriptionKey: 'settings.themeFamilies.hearth.variants.paper.description',
        preview: ['#ece3db', '#b1a093', '#2a241f'],
        overrides: {
          '--theme-background-image': 'radial-gradient(circle at top left, hsla(28, 16%, 72%, 0.12), transparent 26%), radial-gradient(circle at bottom right, hsla(18, 10%, 38%, 0.12), transparent 30%)',
          '--theme-dark-surface-chrome': 'hsl(22, 12%, 10%)',
          '--theme-dark-surface-panel': 'hsl(22, 10%, 12%)',
          '--theme-dark-surface-card': 'hsl(22, 10%, 15%)',
          '--theme-dark-state-hover-bg': 'hsl(22, 9%, 20%)',
          '--theme-dark-surface-floating': 'hsl(22, 11%, 11%)',
          '--theme-light-surface-chrome': 'hsl(30, 30%, 95%)',
          '--theme-light-surface-panel': 'hsl(30, 22%, 98%)',
          '--theme-light-surface-card': 'hsl(30, 20%, 96%)',
          '--theme-light-state-hover-bg': 'hsl(28, 16%, 90%)',
          '--theme-light-surface-floating': 'hsl(30, 18%, 99%)',
        },
        recommendedPrimaryPresetIds: ['warm-gray', 'peach', 'amber'],
      },
      {
        id: 'soot',
        labelKey: 'settings.themeFamilies.hearth.variants.soot.label',
        descriptionKey: 'settings.themeFamilies.hearth.variants.soot.description',
        preview: ['#cfc5bc', '#796a60', '#12100e'],
        overrides: {
          '--theme-background-image': 'radial-gradient(circle at top left, hsla(20, 12%, 46%, 0.08), transparent 22%), radial-gradient(circle at bottom right, hsla(12, 12%, 18%, 0.16), transparent 30%)',
          '--theme-dark-surface-chrome': 'hsl(16, 12%, 7%)',
          '--theme-dark-surface-panel': 'hsl(16, 10%, 9%)',
          '--theme-dark-surface-card': 'hsl(16, 9%, 12%)',
          '--theme-dark-state-hover-bg': 'hsl(16, 8%, 17%)',
          '--theme-dark-surface-floating': 'hsl(16, 11%, 8%)',
          '--theme-light-surface-chrome': 'hsl(26, 20%, 94%)',
          '--theme-light-surface-panel': 'hsl(26, 14%, 97%)',
          '--theme-light-surface-card': 'hsl(26, 12%, 95%)',
          '--theme-light-state-hover-bg': 'hsl(24, 11%, 89%)',
          '--theme-light-surface-floating': 'hsl(26, 12%, 98%)',
        },
        recommendedPrimaryPresetIds: ['ember', 'warm-gray', 'gray'],
      },
    ],
  },
  {
    id: 'pastel',
    labelKey: 'settings.themeFamilies.pastel.label',
    descriptionKey: 'settings.themeFamilies.pastel.description',
    preview: ['#f4e8ff', '#a78bfa', '#cbd5e1'],
    defaultVariant: 'violet',
    variants: [
      {
        id: 'violet',
        labelKey: 'settings.themeFamilies.pastel.variants.violet.label',
        descriptionKey: 'settings.themeFamilies.pastel.variants.violet.description',
        preview: ['#f4e8ff', '#a78bfa', '#d9dff3'],
        overrides: {},
        recommendedPrimaryPresetIds: ['violet', 'mint', 'peach'],
      },
      {
        id: 'mint',
        labelKey: 'settings.themeFamilies.pastel.variants.mint.label',
        descriptionKey: 'settings.themeFamilies.pastel.variants.mint.description',
        preview: ['#e8fff6', '#7ed7c1', '#d6eae5'],
        overrides: {
          '--palette-neutral-50': 'hsl(165, 34%, 97%)',
          '--palette-neutral-100': 'hsl(167, 28%, 93%)',
          '--palette-neutral-200': 'hsl(169, 20%, 86%)',
          '--palette-neutral-300': 'hsl(171, 15%, 76%)',
          '--palette-neutral-400': 'hsl(173, 12%, 62%)',
          '--palette-neutral-500': 'hsl(175, 12%, 40%)',
          '--palette-neutral-600': 'hsl(178, 14%, 29%)',
          '--palette-neutral-700': 'hsl(180, 16%, 22%)',
          '--palette-neutral-800': 'hsl(182, 18%, 16%)',
          '--palette-neutral-900': 'hsl(184, 21%, 12%)',
          '--palette-neutral-950': 'hsl(186, 24%, 8%)',
          '--theme-background-image': 'radial-gradient(circle at top left, hsla(165, 58%, 74%, 0.17), transparent 28%), radial-gradient(circle at bottom right, hsla(186, 34%, 66%, 0.12), transparent 30%)',
          '--theme-dark-surface-chrome': 'hsl(178, 24%, 10%)',
          '--theme-dark-surface-panel': 'hsl(176, 20%, 12%)',
          '--theme-dark-surface-card': 'hsl(174, 18%, 15%)',
          '--theme-dark-state-hover-bg': 'hsl(172, 16%, 20%)',
          '--theme-dark-surface-floating': 'hsl(176, 20%, 11%)',
          '--theme-dark-surface-input': 'hsl(174, 18%, 14%)',
          '--theme-light-surface-chrome': 'hsl(165, 58%, 97%)',
          '--theme-light-surface-panel': 'hsl(164, 28%, 99%)',
          '--theme-light-surface-card': 'hsl(166, 30%, 97%)',
          '--theme-light-state-hover-bg': 'hsl(166, 24%, 91%)',
          '--theme-light-surface-floating': 'hsl(164, 28%, 99%)',
        },
        recommendedPrimaryPresetIds: ['mint', 'teal', 'sky'],
      },
      {
        id: 'peach',
        labelKey: 'settings.themeFamilies.pastel.variants.peach.label',
        descriptionKey: 'settings.themeFamilies.pastel.variants.peach.description',
        preview: ['#ffefe8', '#e7a77d', '#eedcd1'],
        overrides: {
          '--palette-neutral-50': 'hsl(20, 40%, 97%)',
          '--palette-neutral-100': 'hsl(18, 28%, 93%)',
          '--palette-neutral-200': 'hsl(18, 20%, 86%)',
          '--palette-neutral-300': 'hsl(18, 15%, 76%)',
          '--palette-neutral-400': 'hsl(18, 12%, 62%)',
          '--palette-neutral-500': 'hsl(18, 12%, 40%)',
          '--palette-neutral-600': 'hsl(18, 14%, 29%)',
          '--palette-neutral-700': 'hsl(18, 16%, 22%)',
          '--palette-neutral-800': 'hsl(18, 18%, 16%)',
          '--palette-neutral-900': 'hsl(18, 21%, 12%)',
          '--palette-neutral-950': 'hsl(18, 24%, 8%)',
          '--theme-background-image': 'radial-gradient(circle at top left, hsla(20, 70%, 78%, 0.16), transparent 28%), radial-gradient(circle at bottom right, hsla(8, 46%, 72%, 0.12), transparent 30%)',
          '--theme-dark-surface-chrome': 'hsl(18, 22%, 10%)',
          '--theme-dark-surface-panel': 'hsl(18, 18%, 12%)',
          '--theme-dark-surface-card': 'hsl(18, 16%, 15%)',
          '--theme-dark-state-hover-bg': 'hsl(18, 14%, 20%)',
          '--theme-dark-surface-floating': 'hsl(18, 18%, 11%)',
          '--theme-dark-surface-input': 'hsl(18, 16%, 14%)',
          '--theme-light-surface-chrome': 'hsl(18, 62%, 97%)',
          '--theme-light-surface-panel': 'hsl(18, 30%, 99%)',
          '--theme-light-surface-card': 'hsl(18, 32%, 97%)',
          '--theme-light-state-hover-bg': 'hsl(18, 24%, 91%)',
          '--theme-light-surface-floating': 'hsl(18, 28%, 99%)',
        },
        recommendedPrimaryPresetIds: ['peach', 'ember', 'amber'],
      },
    ],
  },
  {
    id: 'forest',
    labelKey: 'settings.themeFamilies.forest.label',
    descriptionKey: 'settings.themeFamilies.forest.description',
    preview: ['#c7f0d1', '#34a853', '#14281d'],
    defaultVariant: 'moss',
    variants: [
      {
        id: 'moss',
        labelKey: 'settings.themeFamilies.forest.variants.moss.label',
        descriptionKey: 'settings.themeFamilies.forest.variants.moss.description',
        preview: ['#c7f0d1', '#34a853', '#14281d'],
        overrides: {},
        recommendedPrimaryPresetIds: ['moss', 'teal', 'amber'],
      },
    ],
  },
  {
    id: 'tide',
    labelKey: 'settings.themeFamilies.tide.label',
    descriptionKey: 'settings.themeFamilies.tide.description',
    preview: ['#c8f8f4', '#0f9f95', '#102a33'],
    defaultVariant: 'sea',
    variants: [
      {
        id: 'sea',
        labelKey: 'settings.themeFamilies.tide.variants.sea.label',
        descriptionKey: 'settings.themeFamilies.tide.variants.sea.description',
        preview: ['#c8f8f4', '#0f9f95', '#102a33'],
        overrides: {},
        recommendedPrimaryPresetIds: ['teal', 'sky', 'mint'],
      },
    ],
  },
  {
    id: 'dune',
    labelKey: 'settings.themeFamilies.dune.label',
    descriptionKey: 'settings.themeFamilies.dune.description',
    preview: ['#f5e4c3', '#b7791f', '#2f261c'],
    defaultVariant: 'sand',
    variants: [
      {
        id: 'sand',
        labelKey: 'settings.themeFamilies.dune.variants.sand.label',
        descriptionKey: 'settings.themeFamilies.dune.variants.sand.description',
        preview: ['#f5e4c3', '#b7791f', '#2f261c'],
        overrides: {},
        recommendedPrimaryPresetIds: ['amber', 'warm-gray', 'ember'],
      },
    ],
  },
  {
    id: 'ember',
    labelKey: 'settings.themeFamilies.ember.label',
    descriptionKey: 'settings.themeFamilies.ember.description',
    preview: ['#ffd7c7', '#dd6b38', '#2b1711'],
    defaultVariant: 'ember',
    variants: [
      {
        id: 'ember',
        labelKey: 'settings.themeFamilies.ember.variants.ember.label',
        descriptionKey: 'settings.themeFamilies.ember.variants.ember.description',
        preview: ['#ffd7c7', '#dd6b38', '#2b1711'],
        overrides: {},
        recommendedPrimaryPresetIds: ['ember', 'peach', 'amber'],
      },
    ],
  },
] as const;

const THEME_COLOR_TOKENS: readonly ThemeColorTokenDefinition[] = [
  { id: 'surface-chrome', label: 'Chrome', description: '??諛곌꼍怨????ㅽ듃由?諛뷀깢', cssVar: '--surface-chrome' },
  { id: 'surface-rail', label: 'Rail', description: 'Activity bar? ?대┛ ?ъ씠?쒕컮', cssVar: '--surface-rail' },
  { id: 'surface-canvas', label: 'Canvas', description: '?ㅽ듃?뚰겕 罹붾쾭??諛곌꼍', cssVar: '--surface-canvas' },
  { id: 'surface-editor', label: 'Editor', description: '?좏깮 ??낵 ?먮뵒??pane 諛곌꼍', cssVar: '--surface-editor' },
  { id: 'surface-panel', label: 'Panel', description: '紐⑹감, 蹂댁“ ?⑤꼸, ?ㅼ젙 蹂몃Ц', cssVar: '--surface-panel' },
  { id: 'surface-card', label: 'Card', description: '移대뱶? 媛뺤“??釉붾줉', cssVar: '--surface-card' },
  { id: 'surface-floating', label: 'Floating', description: '紐⑤떖, ?앹삤踰? ?쒕∼?ㅼ슫', cssVar: '--surface-floating' },
  { id: 'surface-input', label: 'Input', description: '?낅젰 ?꾨뱶 諛곌꼍', cssVar: '--surface-input' },
  { id: 'surface-node', label: 'Node', description: '罹붾쾭???몃뱶 湲곕낯 諛곌꼍', cssVar: '--surface-node' },
  { id: 'surface-node-selected', label: 'Selected Node', description: '?좏깮??罹붾쾭???몃뱶 諛곌꼍', cssVar: '--surface-node-selected' },
  { id: 'state-hover-bg', label: 'Hover', description: 'hover ?곹깭 諛곌꼍', cssVar: '--state-hover-bg' },
  { id: 'state-selected-bg', label: 'Selected', description: '?좏깮 ?곹깭 諛곌꼍', cssVar: '--state-selected-bg' },
  { id: 'state-muted-bg', label: 'Muted State', description: '?쏀븳 媛뺤“ ?곹깭 諛곌꼍', cssVar: '--state-muted-bg' },
  { id: 'state-drop-bg', label: 'Drop State', description: '?쒕옒洹??쒕∼ ?源?諛곌꼍', cssVar: '--state-drop-bg' },
  { id: 'accent', label: 'Accent', description: '二쇱슂 ?≪뀡怨?active ?쒖떆', cssVar: '--accent' },
  { id: 'accent-hover', label: 'Accent Hover', description: '二쇱슂 ?≪뀡 hover ?됱긽', cssVar: '--accent-hover' },
  { id: 'accent-muted', label: 'Accent Muted', description: '?쏀븳 accent 諛곌꼍', cssVar: '--accent-muted' },
  { id: 'border-default', label: 'Border', description: 'pane, sidebar, activity bar 怨듯넻 border', cssVar: '--border-default' },
  { id: 'border-subtle', label: 'Subtle Border', description: '?대? 蹂댁“ 援щ텇??', cssVar: '--border-subtle' },
  { id: 'border-strong', label: 'Strong Border', description: '媛뺥븳 援щ텇?좉낵 媛뺤“ border', cssVar: '--border-strong' },
  { id: 'border-accent', label: 'Accent Border', description: 'focus? accent border', cssVar: '--border-accent' },
] as const;

const THEME_TOKEN_PRESETS: readonly ThemeTokenPresetDefinition[] = [
  {
    id: 'netior',
    label: 'Netior',
    description: 'Netior 湲곕낯 chrome/editor/rail ?鍮?',
    source: 'Netior default',
    preview: ['#111111', '#1a1a1a', '#568b5f'],
    primaryColor: '#568b5f',
    tokenOverrides: {
      '--surface-chrome': '#111111',
      '--surface-rail': '#1a1a1a',
      '--surface-canvas': '#1e1e1e',
      '--surface-editor': '#1e1e1e',
      '--surface-panel': '#202020',
      '--surface-card': '#202020',
      '--surface-floating': '#202020',
      '--surface-input': '#202020',
      '--surface-node': '#363636',
      '--state-hover-bg': '#363636',
      '--border-default': '#545454',
      '--border-subtle': '#404040',
      '--border-strong': '#707070',
    },
  },
  {
    id: 'dracula',
    label: 'Dracula',
    description: '怨듭떇 Dracula??Background / Current Line / Purple 湲곕컲',
    source: 'https://draculatheme.com/spec',
    preview: ['#282a36', '#44475a', '#bd93f9'],
    primaryColor: '#bd93f9',
    tokenOverrides: {
      '--surface-chrome': '#282a36',
      '--surface-rail': '#282a36',
      '--surface-canvas': '#282a36',
      '--surface-editor': '#282a36',
      '--surface-panel': '#303241',
      '--surface-card': '#44475a',
      '--surface-floating': '#343746',
      '--surface-input': '#21222c',
      '--border-default': '#44475a',
      '--border-subtle': '#383a4a',
    },
  },
  {
    id: 'nord',
    label: 'Nord',
    description: 'Nord Polar Night? Frost 怨꾩뿴??李④????梨꾨룄 ?붾젅??',
    source: 'https://www.nordtheme.com/',
    preview: ['#2e3440', '#3b4252', '#88c0d0'],
    primaryColor: '#88c0d0',
    tokenOverrides: {
      '--surface-chrome': '#2e3440',
      '--surface-rail': '#2e3440',
      '--surface-canvas': '#2e3440',
      '--surface-editor': '#2e3440',
      '--surface-panel': '#343b49',
      '--surface-card': '#3b4252',
      '--surface-floating': '#3b4252',
      '--surface-input': '#2b303b',
      '--border-default': '#4c566a',
      '--border-subtle': '#434c5e',
    },
  },
  {
    id: 'catppuccin-mocha',
    label: 'Catppuccin Mocha',
    description: 'Catppuccin Mocha??Base / Mantle / Surface 怨꾩뿴',
    source: 'https://catppuccin.com/palette/',
    preview: ['#1e1e2e', '#313244', '#89b4fa'],
    primaryColor: '#89b4fa',
    tokenOverrides: {
      '--surface-chrome': '#181825',
      '--surface-rail': '#181825',
      '--surface-canvas': '#1e1e2e',
      '--surface-editor': '#1e1e2e',
      '--surface-panel': '#242438',
      '--surface-card': '#313244',
      '--surface-floating': '#313244',
      '--surface-input': '#11111b',
      '--border-default': '#45475a',
      '--border-subtle': '#313244',
    },
  },
  {
    id: 'tokyo-night',
    label: 'Tokyo Night',
    description: 'Tokyo Night??Night / Storm 諛곌꼍怨?Blue accent',
    source: 'https://github.com/tokyo-night/tokyo-night-vscode-theme',
    preview: ['#1a1b26', '#24283b', '#7aa2f7'],
    primaryColor: '#7aa2f7',
    tokenOverrides: {
      '--surface-chrome': '#1a1b26',
      '--surface-rail': '#1a1b26',
      '--surface-canvas': '#1a1b26',
      '--surface-editor': '#1a1b26',
      '--surface-panel': '#202331',
      '--surface-card': '#24283b',
      '--surface-floating': '#24283b',
      '--surface-input': '#16161e',
      '--border-default': '#414868',
      '--border-subtle': '#2f3549',
    },
  },
  {
    id: 'solarized-dark',
    label: 'Solarized Dark',
    description: 'Solarized Base03 / Base02? Blue / Cyan 湲곕컲',
    source: 'https://buckyogi.neocities.org/solarized/solarized',
    preview: ['#002b36', '#073642', '#268bd2'],
    primaryColor: '#268bd2',
    tokenOverrides: {
      '--surface-chrome': '#002b36',
      '--surface-rail': '#002b36',
      '--surface-canvas': '#002b36',
      '--surface-editor': '#002b36',
      '--surface-panel': '#06333f',
      '--surface-card': '#073642',
      '--surface-floating': '#073642',
      '--surface-input': '#00212a',
      '--border-default': '#586e75',
      '--border-subtle': '#164450',
    },
  },
] as const;

const SETTINGS_STORAGE_KEY = 'netior:settings:v4';
const PRIMARY_SCALE_KEYS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const;
const PRIMARY_VAR_NAMES = PRIMARY_SCALE_KEYS.map((key) => `--palette-primary-${key}`);
const THEME_COLOR_TOKEN_VAR_NAMES = THEME_COLOR_TOKENS.map((token) => token.cssVar);
const VARIANT_VAR_NAMES = Array.from(
  new Set(THEME_FAMILIES.flatMap((family) => family.variants.flatMap((variant) => Object.keys(variant.overrides)))),
);
const TYPOGRAPHY_VAR_NAMES = [
  '--font-ui',
  '--font-body',
  '--font-code',
  '--font-terminal',
  '--font-sans',
  '--font-mono',
  '--font-ui-size',
  '--font-ui-line-height',
  '--font-ui-letter-spacing',
  '--font-body-size',
  '--font-body-line-height',
  '--font-body-letter-spacing',
  '--font-code-size',
  '--font-code-line-height',
  '--font-code-letter-spacing',
] as const;
const MANAGED_THEME_VARS = [
  ...PRIMARY_VAR_NAMES,
  ...VARIANT_VAR_NAMES,
  ...THEME_COLOR_TOKEN_VAR_NAMES,
  ...TYPOGRAPHY_VAR_NAMES,
];

export const AVAILABLE_THEME_FAMILIES = THEME_FAMILIES;
export const AVAILABLE_PRIMARY_PRESETS = PRIMARY_PRESETS;
export const AVAILABLE_TERMINAL_PRESETS = TERMINAL_PRESETS;
export const AVAILABLE_THEME_COLOR_TOKENS = THEME_COLOR_TOKENS;
export const AVAILABLE_THEME_TOKEN_PRESETS = THEME_TOKEN_PRESETS;

function findFamily(familyId: ThemeFamily): ThemeFamilyDefinition {
  return THEME_FAMILIES.find((family) => family.id === familyId) ?? THEME_FAMILIES[0];
}

function findVariant(familyId: ThemeFamily, variantId: string): ThemeVariantDefinition {
  const family = findFamily(familyId);
  return family.variants.find((variant) => variant.id === variantId) ?? family.variants[0];
}

function findPrimaryPreset(presetId: string): PrimaryPresetDefinition {
  return PRIMARY_PRESETS.find((preset) => preset.id === presetId) ?? PRIMARY_PRESETS[0];
}

function findThemeTokenPreset(presetId: string): ThemeTokenPresetDefinition {
  return THEME_TOKEN_PRESETS.find((preset) => preset.id === presetId) ?? THEME_TOKEN_PRESETS[0];
}

function findTerminalPreset(presetId: TerminalPresetId | undefined): TerminalPresetDefinition {
  return TERMINAL_PRESETS.find((preset) => preset.id === presetId) ?? TERMINAL_PRESETS[0];
}

function normalizeFontRoleConfig(
  role: AppFontRole,
  config: Partial<FontRoleConfig> | undefined,
  fallback: FontRoleConfig,
): FontRoleConfig {
  const limits = FONT_ROLE_LIMITS[role];
  const fontSize = config?.fontSize;
  const lineHeight = config?.lineHeight;
  const letterSpacing = config?.letterSpacing;
  return {
    fontFamily: typeof config?.fontFamily === 'string' && config.fontFamily.trim().length > 0
      ? config.fontFamily
      : fallback.fontFamily,
    fontSize: Number.isFinite(fontSize)
      ? Math.max(limits.minSize, Math.min(limits.maxSize, Number(fontSize)))
      : fallback.fontSize,
    lineHeight: Number.isFinite(lineHeight)
      ? Math.max(1, Math.min(2.2, Number(lineHeight)))
      : fallback.lineHeight,
    letterSpacing: Number.isFinite(letterSpacing)
      ? Math.max(-1, Math.min(4, Number(letterSpacing)))
      : fallback.letterSpacing,
  };
}

function normalizeTypographyConfig(config: Partial<TypographyConfig> | undefined): TypographyConfig {
  const fallback = getDefaultTypographyConfig();
  return {
    ui: normalizeFontRoleConfig('ui', config?.ui, fallback.ui),
    body: normalizeFontRoleConfig('body', config?.body, fallback.body),
    code: normalizeFontRoleConfig('code', config?.code, fallback.code),
  };
}

function normalizeBrowserSettings(config: Partial<BrowserSettingsConfig> | undefined): BrowserSettingsConfig {
  const homeUrl = typeof config?.homeUrl === 'string' && config.homeUrl.trim().length > 0
    ? config.homeUrl.trim()
    : DEFAULT_BROWSER_SETTINGS.homeUrl;
  return {
    homeUrl,
    openLinksInApp: config?.openLinksInApp ?? DEFAULT_BROWSER_SETTINGS.openLinksInApp,
    openPopupsInTabs: config?.openPopupsInTabs ?? DEFAULT_BROWSER_SETTINGS.openPopupsInTabs,
    showDownloadToast: config?.showDownloadToast ?? DEFAULT_BROWSER_SETTINGS.showDownloadToast,
  };
}

function getTerminalAppearanceFromPreset(presetId: TerminalPresetId | undefined): TerminalAppearanceConfig {
  const preset = findTerminalPreset(presetId);
  return {
    fontFamily: preset.fontFamily,
    fontSize: preset.fontSize,
    lineHeight: preset.lineHeight,
    letterSpacing: preset.letterSpacing,
    paddingX: preset.paddingX,
    paddingY: preset.paddingY,
    cursorBlink: preset.cursorBlink,
    webGLRenderer: preset.webGLRenderer,
  };
}

function normalizeTerminalAppearanceConfig(
  config: Partial<TerminalAppearanceConfig> | undefined,
  fallbackPresetId: TerminalPresetId = DEFAULT_TERMINAL_PRESET_ID,
): TerminalAppearanceConfig {
  const fallback = getTerminalAppearanceFromPreset(fallbackPresetId);
  const fontSize = config?.fontSize;
  const lineHeight = config?.lineHeight;
  const letterSpacing = config?.letterSpacing;
  const paddingX = config?.paddingX;
  const paddingY = config?.paddingY;
  return {
    fontFamily: typeof config?.fontFamily === 'string' && config.fontFamily.trim().length > 0
      ? config.fontFamily
      : fallback.fontFamily,
    fontSize: Number.isFinite(fontSize) ? Math.max(8, Math.min(28, Number(fontSize))) : fallback.fontSize,
    lineHeight: Number.isFinite(lineHeight) ? Math.max(0.8, Math.min(2, Number(lineHeight))) : fallback.lineHeight,
    letterSpacing: Number.isFinite(letterSpacing) ? Math.max(-2, Math.min(8, Number(letterSpacing))) : fallback.letterSpacing,
    paddingX: Number.isFinite(paddingX) ? Math.max(0, Math.min(48, Number(paddingX))) : fallback.paddingX,
    paddingY: Number.isFinite(paddingY) ? Math.max(0, Math.min(48, Number(paddingY))) : fallback.paddingY,
    cursorBlink: typeof config?.cursorBlink === 'boolean' ? config.cursorBlink : fallback.cursorBlink,
    webGLRenderer: typeof config?.webGLRenderer === 'boolean' ? config.webGLRenderer : fallback.webGLRenderer,
  };
}

export function getThemeVariants(familyId: ThemeFamily): readonly ThemeVariantDefinition[] {
  return findFamily(familyId).variants;
}

export function getPrimaryPresets(ids?: readonly string[]): readonly PrimaryPresetDefinition[] {
  if (!ids || ids.length === 0) return PRIMARY_PRESETS;
  return ids.map(findPrimaryPreset);
}

export function getThemeColorTokens(): readonly ThemeColorTokenDefinition[] {
  return THEME_COLOR_TOKENS;
}

export function getThemeTokenPresets(): readonly ThemeTokenPresetDefinition[] {
  return THEME_TOKEN_PRESETS;
}

export function getTerminalPresets(): readonly TerminalPresetDefinition[] {
  return TERMINAL_PRESETS;
}

export function getTerminalPreset(presetId: TerminalPresetId | undefined): TerminalPresetDefinition {
  return findTerminalPreset(presetId ?? DEFAULT_TERMINAL_PRESET_ID);
}

function getTypographyVars(typography: TypographyConfig, terminalAppearance: TerminalAppearanceConfig): CssVariableMap {
  return {
    '--font-ui': typography.ui.fontFamily,
    '--font-body': typography.body.fontFamily,
    '--font-code': typography.code.fontFamily,
    '--font-terminal': terminalAppearance.fontFamily,
    '--font-sans': typography.ui.fontFamily,
    '--font-mono': typography.code.fontFamily,
    '--font-ui-size': `${typography.ui.fontSize}px`,
    '--font-ui-line-height': String(typography.ui.lineHeight),
    '--font-ui-letter-spacing': `${typography.ui.letterSpacing}px`,
    '--font-body-size': `${typography.body.fontSize}px`,
    '--font-body-line-height': String(typography.body.lineHeight),
    '--font-body-letter-spacing': `${typography.body.letterSpacing}px`,
    '--font-code-size': `${typography.code.fontSize}px`,
    '--font-code-line-height': String(typography.code.lineHeight),
    '--font-code-letter-spacing': `${typography.code.letterSpacing}px`,
  };
}

function normalizeHexColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    const [, r, g, b] = normalized;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

function normalizeThemeTokenOverrides(overrides: CssVariableMap | undefined): CssVariableMap {
  if (!overrides) return {};
  const legacyNetiorSurfaceOverrides: CssVariableMap = {
    '--surface-chrome': '#181818',
    '--surface-rail': '#1a1a1a',
    '--surface-canvas': '#1e1e1e',
    '--surface-editor': '#1e1e1e',
    '--surface-panel': '#202020',
    '--surface-card': '#202020',
  };
  const legacyNetiorDynamicOverrides: CssVariableMap = {
    '--surface-node-selected': '#404040',
    '--state-selected-bg': '#568b5f',
    '--state-muted-bg': '#568b5f',
    '--state-drop-bg': '#7fa785',
    '--accent': '#568b5f',
    '--accent-hover': '#7fa785',
    '--accent-muted': '#568b5f',
    '--border-accent': '#8eb294',
  };
  const hasLegacyNetiorSurfacePreset = Object.entries(legacyNetiorSurfaceOverrides).every(
    ([cssVar, color]) => normalizeHexColor(overrides[cssVar], '') === color,
  );
  const hasLegacyNetiorDynamicPreset = [
    '--state-selected-bg',
    '--accent',
    '--accent-hover',
    '--border-accent',
  ].every((cssVar) => normalizeHexColor(overrides[cssVar], '') === legacyNetiorDynamicOverrides[cssVar]);
  const shouldDropLegacyNetiorDynamicOverrides = hasLegacyNetiorSurfacePreset || hasLegacyNetiorDynamicPreset;

  return THEME_COLOR_TOKENS.reduce<CssVariableMap>((next, token) => {
    const value = overrides[token.cssVar];
    if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim())) {
      let normalizedValue = normalizeHexColor(value, value);
      if (hasLegacyNetiorSurfacePreset && token.cssVar === '--surface-chrome' && normalizedValue === '#181818') {
        normalizedValue = '#111111';
      }
      if (shouldDropLegacyNetiorDynamicOverrides && legacyNetiorDynamicOverrides[token.cssVar] === normalizedValue) {
        return next;
      }
      next[token.cssVar] = normalizedValue;
    }
    return next;
  }, {});
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const safeHex = normalizeHexColor(hex, '#808080').slice(1);
  return {
    r: parseInt(safeHex.slice(0, 2), 16),
    g: parseInt(safeHex.slice(2, 4), 16),
    b: parseInt(safeHex.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;
}

function mixHex(baseHex: string, targetHex: string, amount: number): string {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  return rgbToHex(
    base.r + (target.r - base.r) * amount,
    base.g + (target.g - base.g) * amount,
    base.b + (target.b - base.b) * amount,
  );
}

function buildPrimaryPalette(seedHex: string): CssVariableMap {
  const safeSeed = normalizeHexColor(seedHex, '#808080');
  return {
    '--palette-primary-50': mixHex(safeSeed, '#ffffff', 0.92),
    '--palette-primary-100': mixHex(safeSeed, '#ffffff', 0.82),
    '--palette-primary-200': mixHex(safeSeed, '#ffffff', 0.64),
    '--palette-primary-300': mixHex(safeSeed, '#ffffff', 0.46),
    '--palette-primary-400': mixHex(safeSeed, '#ffffff', 0.24),
    '--palette-primary-500': safeSeed,
    '--palette-primary-600': mixHex(safeSeed, '#000000', 0.14),
    '--palette-primary-700': mixHex(safeSeed, '#000000', 0.28),
    '--palette-primary-800': mixHex(safeSeed, '#000000', 0.42),
    '--palette-primary-900': mixHex(safeSeed, '#000000', 0.60),
    '--palette-primary-950': mixHex(safeSeed, '#000000', 0.78),
  };
}

function resolveMode(mode: AppearanceMode): ResolvedThemeMode {
  if (mode === 'dark' || mode === 'light') return mode;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getDefaultThemeSlot(mode: ResolvedThemeMode): ThemeSlotConfig {
  return mode === 'light'
    ? {
        family: 'pastel',
        variant: 'violet',
        primaryMode: 'preset',
        primaryPresetId: 'sky',
        primaryCustomColor: '#0d99ff',
        tokenOverrides: {},
      }
    : {
        family: 'hearth',
        variant: 'warm',
        primaryMode: 'preset',
        primaryPresetId: 'sky',
        primaryCustomColor: '#0d99ff',
        tokenOverrides: {},
      };
}

function normalizeThemeSlot(config: ThemeSlotConfig): ThemeSlotConfig {
  const family = findFamily(config.family).id;
  const variant = findVariant(family, config.variant).id;
  const variantDef = findVariant(family, variant);
  const fallbackPreset = findPrimaryPreset(variantDef.recommendedPrimaryPresetIds[0] ?? PRIMARY_PRESETS[0].id);
  const preset = findPrimaryPreset(config.primaryPresetId);

  return {
    family,
    variant,
    primaryMode: config.primaryMode === 'custom' ? 'custom' : 'preset',
    primaryPresetId: preset.id || fallbackPreset.id,
    primaryCustomColor: normalizeHexColor(config.primaryCustomColor, fallbackPreset.color),
    tokenOverrides: normalizeThemeTokenOverrides(config.tokenOverrides),
  };
}

function applyThemeToDocument(state: {
  appearanceMode: AppearanceMode;
  lightTheme: ThemeSlotConfig;
  darkTheme: ThemeSlotConfig;
  typography: TypographyConfig;
  terminalAppearance: TerminalAppearanceConfig;
}): ResolvedThemeMode {
  if (typeof document === 'undefined') return resolveMode(state.appearanceMode);

  const resolvedThemeMode = resolveMode(state.appearanceMode);
  const activeTheme = normalizeThemeSlot(resolvedThemeMode === 'light' ? state.lightTheme : state.darkTheme);
  const root = document.documentElement;
  const variant = findVariant(activeTheme.family, activeTheme.variant);
  const preset = findPrimaryPreset(activeTheme.primaryPresetId);
  const primarySeed = activeTheme.primaryMode === 'custom'
    ? normalizeHexColor(activeTheme.primaryCustomColor, preset.color)
    : preset.color;
  const primaryVars = buildPrimaryPalette(primarySeed);
  const themeVars = {
    ...variant.overrides,
    ...activeTheme.tokenOverrides,
    ...primaryVars,
    ...getTypographyVars(
      normalizeTypographyConfig(state.typography),
      normalizeTerminalAppearanceConfig(state.terminalAppearance),
    ),
  };

  root.setAttribute('data-mode', resolvedThemeMode);
  root.setAttribute('data-instance', activeTheme.family);
  root.setAttribute('data-theme-family', activeTheme.family);
  root.setAttribute('data-theme-variant', activeTheme.variant);
  root.setAttribute('data-theme-primary-mode', activeTheme.primaryMode);

  for (const varName of MANAGED_THEME_VARS) {
    root.style.removeProperty(varName);
  }
  for (const [varName, value] of Object.entries(themeVars)) {
    root.style.setProperty(varName, value);
  }

  return resolvedThemeMode;
}

let systemThemeListenerAttached = false;
let settingsSyncInitialized = false;
let settingsSyncUnsubscribe: (() => void) | null = null;
let settingsSyncCleanup: (() => void) | null = null;
let isApplyingRemoteSettings = false;

export interface SettingsStore {
  appearanceMode: AppearanceMode;
  resolvedThemeMode: ResolvedThemeMode;
  themeRevision: number;
  lightTheme: ThemeSlotConfig;
  darkTheme: ThemeSlotConfig;
  locale: Locale;
  detachedAgentToastMode: DetachedAgentToastMode;
  nativeAgentNotificationsEnabled: boolean;
  agentNotificationSoundEnabled: boolean;
  fieldComplexityLevel: FieldComplexityLevel;
  networkViewerPlacement: NetworkViewerPlacement;
  typography: TypographyConfig;
  terminalPresetId: TerminalPresetId;
  terminalAppearance: TerminalAppearanceConfig;
  browser: BrowserSettingsConfig;

  setAppearanceMode: (mode: AppearanceMode) => void;
  setThemeFamily: (mode: ResolvedThemeMode, family: ThemeFamily) => void;
  setThemeVariant: (mode: ResolvedThemeMode, variant: string) => void;
  setThemePrimaryMode: (mode: ResolvedThemeMode, primaryMode: ThemePrimaryMode) => void;
  setThemePrimaryPreset: (mode: ResolvedThemeMode, presetId: PrimaryPresetId) => void;
  setThemePrimaryCustomColor: (mode: ResolvedThemeMode, color: string) => void;
  setThemeTokenOverride: (mode: ResolvedThemeMode, cssVar: string, color: string) => void;
  applyThemeTokenPreset: (mode: ResolvedThemeMode, presetId: string) => void;
  resetThemeTokenOverrides: (mode: ResolvedThemeMode) => void;
  setLocale: (locale: Locale) => void;
  setDetachedAgentToastMode: (mode: DetachedAgentToastMode) => void;
  setNativeAgentNotificationsEnabled: (enabled: boolean) => void;
  setAgentNotificationSoundEnabled: (enabled: boolean) => void;
  setFieldComplexityLevel: (level: FieldComplexityLevel) => void;
  setNetworkViewerPlacement: (placement: NetworkViewerPlacement) => void;
  updateTypography: (role: AppFontRole, patch: Partial<FontRoleConfig>) => void;
  setTerminalPresetId: (presetId: TerminalPresetId) => void;
  updateTerminalAppearance: (patch: Partial<TerminalAppearanceConfig>) => void;
  updateBrowserSettings: (patch: Partial<BrowserSettingsConfig>) => void;
}

function applyCurrentThemeSnapshot(
  partial: Pick<SettingsStore, 'appearanceMode' | 'lightTheme' | 'darkTheme' | 'typography' | 'terminalAppearance'>,
): ResolvedThemeMode {
  return applyThemeToDocument({
    appearanceMode: partial.appearanceMode,
    lightTheme: normalizeThemeSlot(partial.lightTheme),
    darkTheme: normalizeThemeSlot(partial.darkTheme),
    typography: normalizeTypographyConfig(partial.typography),
    terminalAppearance: normalizeTerminalAppearanceConfig(partial.terminalAppearance),
  });
}

function getSettingsSyncState(state: Pick<
  SettingsStore,
  | 'appearanceMode'
  | 'lightTheme'
  | 'darkTheme'
  | 'locale'
  | 'detachedAgentToastMode'
  | 'nativeAgentNotificationsEnabled'
  | 'agentNotificationSoundEnabled'
  | 'networkViewerPlacement'
> & {
  fieldComplexityLevel?: FieldComplexityLevel;
  typography?: Partial<TypographyConfig>;
  terminalPresetId?: TerminalPresetId;
  terminalAppearance?: Partial<TerminalAppearanceConfig>;
  browser?: Partial<BrowserSettingsConfig>;
}): SettingsSyncState {
  const terminalPresetId = findTerminalPreset(state.terminalPresetId ?? DEFAULT_TERMINAL_PRESET_ID).id;
  return {
    appearanceMode: state.appearanceMode,
    lightTheme: normalizeThemeSlot(state.lightTheme),
    darkTheme: normalizeThemeSlot(state.darkTheme),
    locale: state.locale,
    detachedAgentToastMode: state.detachedAgentToastMode,
    nativeAgentNotificationsEnabled: state.nativeAgentNotificationsEnabled,
    agentNotificationSoundEnabled: state.agentNotificationSoundEnabled,
    networkViewerPlacement: state.networkViewerPlacement ?? 'network-left',
    fieldComplexityLevel: state.fieldComplexityLevel ?? 'standard',
    typography: normalizeTypographyConfig(state.typography),
    terminalPresetId,
    terminalAppearance: normalizeTerminalAppearanceConfig(state.terminalAppearance, terminalPresetId),
    browser: normalizeBrowserSettings(state.browser),
  };
}

function applySettingsSyncState(snapshot: SettingsSyncState): void {
  isApplyingRemoteSettings = true;
  const nextState = getSettingsSyncState(snapshot);
  const resolvedThemeMode = applyCurrentThemeSnapshot(nextState);

  useSettingsStore.setState((current) => ({
    ...current,
    ...nextState,
    resolvedThemeMode,
    themeRevision: current.themeRevision + 1,
  }));

  isApplyingRemoteSettings = false;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      appearanceMode: 'system',
      resolvedThemeMode: 'dark',
      themeRevision: 0,
      lightTheme: getDefaultThemeSlot('light'),
      darkTheme: getDefaultThemeSlot('dark'),
      locale: 'ko',
      detachedAgentToastMode: 'inactive-only',
      nativeAgentNotificationsEnabled: true,
      agentNotificationSoundEnabled: true,
      fieldComplexityLevel: 'standard',
      networkViewerPlacement: 'network-left',
      typography: getDefaultTypographyConfig(),
      terminalPresetId: DEFAULT_TERMINAL_PRESET_ID,
      terminalAppearance: getTerminalAppearanceFromPreset(DEFAULT_TERMINAL_PRESET_ID),
      browser: DEFAULT_BROWSER_SETTINGS,

      setAppearanceMode: (appearanceMode) => {
        set({ appearanceMode });
        const resolvedThemeMode = applyCurrentThemeSnapshot(get());
        set((state) => ({ resolvedThemeMode, themeRevision: state.themeRevision + 1 }));
      },

      setThemeFamily: (mode, family) => {
        set((state) => {
          const key = mode === 'light' ? 'lightTheme' : 'darkTheme';
          const current = state[key];
          const nextFamily = findFamily(family);
          const nextVariant = findVariant(nextFamily.id, nextFamily.defaultVariant);
          const nextPresetId = nextVariant.recommendedPrimaryPresetIds[0] ?? PRIMARY_PRESETS[0].id;
          return {
            [key]: normalizeThemeSlot({
              ...current,
              family: nextFamily.id,
              variant: nextVariant.id,
              primaryPresetId: nextPresetId,
              primaryCustomColor: findPrimaryPreset(nextPresetId).color,
            }),
          } as Pick<SettingsStore, typeof key>;
        });
        const resolvedThemeMode = applyCurrentThemeSnapshot(get());
        set((state) => ({ resolvedThemeMode, themeRevision: state.themeRevision + 1 }));
      },

      setThemeVariant: (mode, variant) => {
        set((state) => {
          const key = mode === 'light' ? 'lightTheme' : 'darkTheme';
          const current = state[key];
          const nextVariant = findVariant(current.family, variant);
          const nextPresetId = nextVariant.recommendedPrimaryPresetIds.includes(current.primaryPresetId)
            ? current.primaryPresetId
            : (nextVariant.recommendedPrimaryPresetIds[0] ?? PRIMARY_PRESETS[0].id);
          return {
            [key]: normalizeThemeSlot({
              ...current,
              variant: nextVariant.id,
              primaryPresetId: nextPresetId,
              primaryCustomColor: current.primaryMode === 'custom'
                ? current.primaryCustomColor
                : findPrimaryPreset(nextPresetId).color,
            }),
          } as Pick<SettingsStore, typeof key>;
        });
        const resolvedThemeMode = applyCurrentThemeSnapshot(get());
        set((state) => ({ resolvedThemeMode, themeRevision: state.themeRevision + 1 }));
      },

      setThemePrimaryMode: (mode, primaryMode) => {
        set((state) => {
          const key = mode === 'light' ? 'lightTheme' : 'darkTheme';
          return {
            [key]: normalizeThemeSlot({
              ...state[key],
              primaryMode,
            }),
          } as Pick<SettingsStore, typeof key>;
        });
        const resolvedThemeMode = applyCurrentThemeSnapshot(get());
        set((state) => ({ resolvedThemeMode, themeRevision: state.themeRevision + 1 }));
      },

      setThemePrimaryPreset: (mode, primaryPresetId) => {
        set((state) => {
          const key = mode === 'light' ? 'lightTheme' : 'darkTheme';
          return {
            [key]: normalizeThemeSlot({
              ...state[key],
              primaryPresetId,
            }),
          } as Pick<SettingsStore, typeof key>;
        });
        const resolvedThemeMode = applyCurrentThemeSnapshot(get());
        set((state) => ({ resolvedThemeMode, themeRevision: state.themeRevision + 1 }));
      },

      setThemePrimaryCustomColor: (mode, color) => {
        set((state) => {
          const key = mode === 'light' ? 'lightTheme' : 'darkTheme';
          return {
            [key]: normalizeThemeSlot({
              ...state[key],
              primaryMode: 'custom',
              primaryCustomColor: color,
            }),
          } as Pick<SettingsStore, typeof key>;
        });
        const resolvedThemeMode = applyCurrentThemeSnapshot(get());
        set((state) => ({ resolvedThemeMode, themeRevision: state.themeRevision + 1 }));
      },

      setThemeTokenOverride: (mode, cssVar, color) => {
        set((state) => {
          const key = mode === 'light' ? 'lightTheme' : 'darkTheme';
          const token = THEME_COLOR_TOKENS.find((item) => item.cssVar === cssVar);
          if (!token) return {};
          const normalizedColor = normalizeHexColor(color, state[key].tokenOverrides[cssVar] ?? '#808080');
          return {
            [key]: normalizeThemeSlot({
              ...state[key],
              tokenOverrides: {
                ...state[key].tokenOverrides,
                [cssVar]: normalizedColor,
              },
            }),
          } as Pick<SettingsStore, typeof key>;
        });
        const resolvedThemeMode = applyCurrentThemeSnapshot(get());
        set((state) => ({ resolvedThemeMode, themeRevision: state.themeRevision + 1 }));
      },

      applyThemeTokenPreset: (mode, presetId) => {
        const preset = findThemeTokenPreset(presetId);
        set((state) => {
          const key = mode === 'light' ? 'lightTheme' : 'darkTheme';
          return {
            [key]: normalizeThemeSlot({
              ...state[key],
              primaryMode: 'custom',
              primaryCustomColor: preset.primaryColor,
              tokenOverrides: preset.tokenOverrides,
            }),
          } as Pick<SettingsStore, typeof key>;
        });
        const resolvedThemeMode = applyCurrentThemeSnapshot(get());
        set((state) => ({ resolvedThemeMode, themeRevision: state.themeRevision + 1 }));
      },

      resetThemeTokenOverrides: (mode) => {
        set((state) => {
          const key = mode === 'light' ? 'lightTheme' : 'darkTheme';
          return {
            [key]: normalizeThemeSlot({
              ...state[key],
              tokenOverrides: {},
            }),
          } as Pick<SettingsStore, typeof key>;
        });
        const resolvedThemeMode = applyCurrentThemeSnapshot(get());
        set((state) => ({ resolvedThemeMode, themeRevision: state.themeRevision + 1 }));
      },

      setLocale: (locale) => set({ locale }),
      setDetachedAgentToastMode: (detachedAgentToastMode) => set({ detachedAgentToastMode }),
      setNativeAgentNotificationsEnabled: (nativeAgentNotificationsEnabled) => set({ nativeAgentNotificationsEnabled }),
      setAgentNotificationSoundEnabled: (agentNotificationSoundEnabled) => set({ agentNotificationSoundEnabled }),
      setFieldComplexityLevel: (fieldComplexityLevel) => set({ fieldComplexityLevel }),
      setNetworkViewerPlacement: (networkViewerPlacement) => set({ networkViewerPlacement }),
      updateTypography: (role, patch) => {
        set((state) => ({
          typography: normalizeTypographyConfig({
            ...state.typography,
            [role]: {
              ...state.typography[role],
              ...patch,
            },
          }),
        }));
        const resolvedThemeMode = applyCurrentThemeSnapshot(get());
        set((state) => ({ resolvedThemeMode, themeRevision: state.themeRevision + 1 }));
      },
      setTerminalPresetId: (terminalPresetId) => {
        const normalizedPresetId = findTerminalPreset(terminalPresetId).id;
        set({
          terminalPresetId: normalizedPresetId,
          terminalAppearance: getTerminalAppearanceFromPreset(normalizedPresetId),
        });
        const resolvedThemeMode = applyCurrentThemeSnapshot(get());
        set((state) => ({ resolvedThemeMode, themeRevision: state.themeRevision + 1 }));
      },
      updateTerminalAppearance: (patch) => {
        set((state) => ({
          terminalAppearance: normalizeTerminalAppearanceConfig({
            ...state.terminalAppearance,
            ...patch,
          }, state.terminalPresetId),
        }));
        const resolvedThemeMode = applyCurrentThemeSnapshot(get());
        set((state) => ({ resolvedThemeMode, themeRevision: state.themeRevision + 1 }));
      },
      updateBrowserSettings: (patch) => {
        set((state) => ({
          browser: normalizeBrowserSettings({
            ...state.browser,
            ...patch,
          }),
        }));
      },
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        appearanceMode: state.appearanceMode,
        lightTheme: state.lightTheme,
        darkTheme: state.darkTheme,
        locale: state.locale,
        detachedAgentToastMode: state.detachedAgentToastMode,
        nativeAgentNotificationsEnabled: state.nativeAgentNotificationsEnabled,
        agentNotificationSoundEnabled: state.agentNotificationSoundEnabled,
        fieldComplexityLevel: state.fieldComplexityLevel,
        networkViewerPlacement: state.networkViewerPlacement,
        typography: state.typography,
        terminalPresetId: state.terminalPresetId,
        terminalAppearance: state.terminalAppearance,
        browser: state.browser,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const normalizedState = {
          appearanceMode: state.appearanceMode,
          lightTheme: normalizeThemeSlot(state.lightTheme),
          darkTheme: normalizeThemeSlot(state.darkTheme),
          networkViewerPlacement: state.networkViewerPlacement ?? 'network-left',
          typography: normalizeTypographyConfig(state.typography),
          terminalAppearance: normalizeTerminalAppearanceConfig(
            state.terminalAppearance,
            findTerminalPreset(state.terminalPresetId ?? DEFAULT_TERMINAL_PRESET_ID).id,
          ),
          browser: normalizeBrowserSettings(state.browser),
        };
        const resolvedThemeMode = applyThemeToDocument(normalizedState);
        state.lightTheme = normalizedState.lightTheme;
        state.darkTheme = normalizedState.darkTheme;
        state.networkViewerPlacement = normalizedState.networkViewerPlacement;
        state.typography = normalizedState.typography;
        state.resolvedThemeMode = resolvedThemeMode;
        state.terminalPresetId = findTerminalPreset(state.terminalPresetId ?? DEFAULT_TERMINAL_PRESET_ID).id;
        state.terminalAppearance = normalizedState.terminalAppearance;
        state.browser = normalizedState.browser;
        state.themeRevision += 1;
      },
    },
  ),
);

export function initializeSettingsStore(): void {
  const state = useSettingsStore.getState();
  const resolvedThemeMode = applyCurrentThemeSnapshot(state);
  if (state.resolvedThemeMode !== resolvedThemeMode) {
    useSettingsStore.setState((current) => ({ ...current, resolvedThemeMode, themeRevision: current.themeRevision + 1 }));
  }

  if (!systemThemeListenerAttached && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const current = useSettingsStore.getState();
      if (current.appearanceMode !== 'system') return;
      const nextResolved = applyCurrentThemeSnapshot(current);
      useSettingsStore.setState((stateSnapshot) => ({
        ...stateSnapshot,
        resolvedThemeMode: nextResolved,
        themeRevision: stateSnapshot.themeRevision + 1,
      }));
    };

    media.addEventListener('change', handleChange);
    systemThemeListenerAttached = true;
  }

  if (settingsSyncInitialized || typeof window === 'undefined' || !window.electron?.settings) {
    return;
  }

  settingsSyncInitialized = true;

  const setupSync = () => {
    if (settingsSyncCleanup || settingsSyncUnsubscribe) return;

    settingsSyncCleanup = window.electron.settings.onStateSync((rawState) => {
      if (isApplyingRemoteSettings || !rawState) return;
      applySettingsSyncState(rawState as SettingsSyncState);
    });

    settingsSyncUnsubscribe = useSettingsStore.subscribe((nextState, prevState) => {
      if (isApplyingRemoteSettings) return;
      if (
        nextState.appearanceMode === prevState.appearanceMode &&
        nextState.lightTheme === prevState.lightTheme &&
        nextState.darkTheme === prevState.darkTheme &&
        nextState.locale === prevState.locale &&
        nextState.detachedAgentToastMode === prevState.detachedAgentToastMode &&
        nextState.nativeAgentNotificationsEnabled === prevState.nativeAgentNotificationsEnabled &&
        nextState.agentNotificationSoundEnabled === prevState.agentNotificationSoundEnabled &&
        nextState.fieldComplexityLevel === prevState.fieldComplexityLevel &&
        nextState.networkViewerPlacement === prevState.networkViewerPlacement &&
        nextState.typography === prevState.typography &&
        nextState.terminalPresetId === prevState.terminalPresetId &&
        nextState.terminalAppearance === prevState.terminalAppearance &&
        nextState.browser === prevState.browser
      ) {
        return;
      }

      window.electron.settings.pushState(getSettingsSyncState(nextState));
    });

    void window.electron.settings.getState().then((cachedState) => {
      if (cachedState) {
        applySettingsSyncState(cachedState as SettingsSyncState);
        return;
      }

      window.electron.settings.pushState(getSettingsSyncState(useSettingsStore.getState()));
    });
  };

  if (useSettingsStore.persist.hasHydrated()) {
    setupSync();
    return;
  }

  const stopHydrationListener = useSettingsStore.persist.onFinishHydration(() => {
    stopHydrationListener();
    setupSync();
  });
}
