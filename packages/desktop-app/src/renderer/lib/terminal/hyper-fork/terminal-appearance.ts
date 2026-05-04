import { useSettingsStore } from '../../../stores/settings-store';

interface TerminalColorPalette {
  background: string;
  foreground: string;
  muted: string;
  border: string;
  accent: string;
  accentHover: string;
  selection: string;
  inactiveSelection: string;
  scrollbar: string;
  scrollbarHover: string;
  scrollbarActive: string;
  findMatchBackground: string;
  findMatchHighlightBackground: string;
  findMatchBorder: string;
  findMatchHighlightBorder: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface TerminalAppearanceSnapshot {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  padding: string;
  minimumContrastRatio: number;
  cursorBlink: boolean;
  webGLRenderer: boolean;
  colors: TerminalColorPalette;
}

const terminalAppearanceListeners = new Set<(snapshot: TerminalAppearanceSnapshot) => void>();

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 28;
const TERMINAL_MINIMUM_CONTRAST_RATIO = 1;

let currentFontSizeOffset = 0;
let themeObserver: MutationObserver | null = null;
let settingsObserverCleanup: (() => void) | null = null;
let cachedAppearanceSnapshot: TerminalAppearanceSnapshot | null = null;

function clampFontSize(value: number): number {
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, value));
}

function getCssColorAsHex(property: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
  if (!raw) return fallback;
  if (raw.startsWith('#')) return raw;

  const el = document.createElement('div');
  el.style.color = raw;
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  document.body.removeChild(el);

  const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return fallback;

  const [, r, g, b] = match;
  return `#${Number(r).toString(16).padStart(2, '0')}${Number(g).toString(16).padStart(2, '0')}${Number(b).toString(16).padStart(2, '0')}`;
}

function withAlpha(hex: string, alphaHex: string): string {
  return `${hex}${alphaHex}`;
}

function buildTerminalColorPalette(
  base: {
  background: string;
  foreground: string;
  muted: string;
  border: string;
  accent: string;
  accentHover: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
},
  isDarkBackground: boolean,
): TerminalColorPalette {
  return {
    ...base,
    selection: withAlpha(base.accent, isDarkBackground ? '33' : '22'),
    inactiveSelection: withAlpha(base.muted, isDarkBackground ? '2e' : '1f'),
    scrollbar: withAlpha(base.border, isDarkBackground ? '44' : '33'),
    scrollbarHover: withAlpha(base.muted, isDarkBackground ? '66' : '55'),
    scrollbarActive: withAlpha(base.accentHover, isDarkBackground ? '88' : '77'),
    findMatchBackground: withAlpha(base.accent, isDarkBackground ? '44' : '33'),
    findMatchHighlightBackground: withAlpha(base.accent, isDarkBackground ? '22' : '18'),
    findMatchBorder: base.accent,
    findMatchHighlightBorder: withAlpha(base.accent, isDarkBackground ? '66' : '44'),
  };
}

function resolveAdaptivePalette(isDark: boolean): TerminalColorPalette {
  const background = getCssColorAsHex('--surface-editor', isDark ? '#242424' : '#f5f5f5');
  const foreground = getCssColorAsHex('--text-default', isDark ? '#d4d4d4' : '#1f2328');
  const muted = getCssColorAsHex('--text-muted', isDark ? '#8b949e' : '#6b7280');
  const border = getCssColorAsHex('--border-default', isDark ? '#30363d' : '#d0d7de');
  const accent = getCssColorAsHex('--accent', isDark ? '#2f81f7' : '#0969da');
  const accentHover = getCssColorAsHex('--accent-hover', accent);

  return buildTerminalColorPalette({
    background,
    foreground,
    muted,
    border,
    accent,
    accentHover,
    black: isDark ? '#484f58' : '#24292f',
    red: isDark ? '#ff7b72' : '#cf222e',
    green: isDark ? '#3fb950' : '#1a7f37',
    yellow: isDark ? '#d29922' : '#9a6700',
    blue: isDark ? '#79c0ff' : '#0969da',
    magenta: isDark ? '#bc8cff' : '#8250df',
    cyan: isDark ? '#39c5cf' : '#1b7c83',
    white: isDark ? '#c9d1d9' : '#6e7781',
    brightBlack: isDark ? '#6e7681' : '#57606a',
    brightRed: isDark ? '#ffa198' : '#ff8182',
    brightGreen: isDark ? '#56d364' : '#4ac26b',
    brightYellow: isDark ? '#e3b341' : '#bf8700',
    brightBlue: isDark ? '#a5d6ff' : '#218bff',
    brightMagenta: isDark ? '#d2a8ff' : '#a475f9',
    brightCyan: isDark ? '#56d4dd' : '#3192aa',
    brightWhite: isDark ? '#f0f6fc' : '#24292f',
  }, isDark);
}

function buildTerminalAppearanceSnapshot(): TerminalAppearanceSnapshot {
  const { terminalAppearance } = useSettingsStore.getState();
  const isDark = document.documentElement.getAttribute('data-mode') !== 'light';

  return {
    fontFamily: terminalAppearance.fontFamily,
    fontSize: clampFontSize(terminalAppearance.fontSize + currentFontSizeOffset),
    lineHeight: terminalAppearance.lineHeight,
    letterSpacing: terminalAppearance.letterSpacing,
    padding: `${terminalAppearance.paddingY}px ${terminalAppearance.paddingX}px`,
    minimumContrastRatio: TERMINAL_MINIMUM_CONTRAST_RATIO,
    cursorBlink: terminalAppearance.cursorBlink,
    webGLRenderer: terminalAppearance.webGLRenderer,
    colors: resolveAdaptivePalette(isDark),
  };
}

function emitAppearanceChanged(): void {
  const snapshot = getTerminalAppearanceSnapshot();
  for (const listener of terminalAppearanceListeners) {
    listener(snapshot);
  }
}

function ensureTerminalAppearanceObservers(): void {
  if (!themeObserver && typeof document !== 'undefined') {
    themeObserver = new MutationObserver(() => {
      cachedAppearanceSnapshot = null;
      emitAppearanceChanged();
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-mode', 'data-concept', 'data-theme-variant', 'style'],
    });
  }

  if (!settingsObserverCleanup) {
    settingsObserverCleanup = useSettingsStore.subscribe((nextState, prevState) => {
      if (
        nextState.terminalPresetId === prevState.terminalPresetId
        && nextState.terminalAppearance === prevState.terminalAppearance
      ) {
        return;
      }
      cachedAppearanceSnapshot = null;
      emitAppearanceChanged();
    });
  }
}

export function getTerminalAppearanceSnapshot(): TerminalAppearanceSnapshot {
  ensureTerminalAppearanceObservers();
  cachedAppearanceSnapshot ??= buildTerminalAppearanceSnapshot();
  return cachedAppearanceSnapshot;
}

export function onTerminalAppearanceChanged(
  listener: (snapshot: TerminalAppearanceSnapshot) => void,
): { dispose(): void } {
  ensureTerminalAppearanceObservers();
  terminalAppearanceListeners.add(listener);
  return {
    dispose(): void {
      terminalAppearanceListeners.delete(listener);
    },
  };
}

export function adjustTerminalFontSize(delta: number): void {
  const { terminalAppearance } = useSettingsStore.getState();
  const nextFontSize = clampFontSize(terminalAppearance.fontSize + currentFontSizeOffset + delta);
  currentFontSizeOffset = nextFontSize - terminalAppearance.fontSize;
  cachedAppearanceSnapshot = null;
  emitAppearanceChanged();
}

export function resetTerminalFontSize(): void {
  currentFontSizeOffset = 0;
  cachedAppearanceSnapshot = null;
  emitAppearanceChanged();
}
