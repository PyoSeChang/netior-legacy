import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Palette, Globe, Bell, Sparkles, Pin, Compass } from 'lucide-react';
import type { NarreBehaviorSettings, NarreCodexSettings } from '@netior/shared/types';
import {
  buildRoleFontFamily,
  getPrimaryFontFamily,
  useSettingsStore,
  getPrimaryPresets,
  getThemeColorTokens,
  getThemeTokenPresets,
  getTerminalPresets,
  type BrowserSettingsConfig,
  type AppFontRole,
  type FontRoleConfig,
  type ResolvedThemeMode,
  type TerminalAppearanceConfig,
  type TerminalPresetId,
  type ThemeSlotConfig,
  type TypographyConfig,
} from '../../stores/settings-store';
import { useI18n } from '../../hooks/useI18n';
import { unwrapIpc } from '../../services/ipc';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { NumberInput } from '../ui/NumberInput';
import { Select, type SelectOption } from '../ui/Select';
import { Spinner } from '../ui/Spinner';
import { TextArea } from '../ui/TextArea';
import { Toggle } from '../ui/Toggle';
import { SidebarSettingsPanel } from './SidebarSettingsPanel';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

interface CategoryItem {
  key: string;
  icon: React.ElementType;
  label: string;
  anchors: string[];
}

function normalizeHexDraft(value: string, fallback: string): string {
  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    const [, r, g, b] = normalized;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

function rgbCssToHex(value: string): string | null {
  const rgbMatch = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  const srgbMatch = value.match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  const parts = rgbMatch
    ? [rgbMatch[1], rgbMatch[2], rgbMatch[3]]
    : srgbMatch
      ? srgbMatch.slice(1, 4).map((part) => String(Math.round(Number(part) * 255)))
      : null;
  if (!parts) return null;
  return `#${parts
    .map((part) => Math.max(0, Math.min(255, Math.round(Number(part)))).toString(16).padStart(2, '0'))
    .join('')}`;
}

function resolveCssVarHex(cssVar: string): string {
  if (typeof document === 'undefined' || !document.body) return '#000000';
  const probe = document.createElement('span');
  probe.style.color = `var(${cssVar})`;
  probe.style.position = 'fixed';
  probe.style.pointerEvents = 'none';
  probe.style.opacity = '0';
  document.body.appendChild(probe);
  const resolved = rgbCssToHex(getComputedStyle(probe).color);
  probe.remove();
  return resolved ?? '#000000';
}

function ThemeTokenInput({
  label,
  description,
  value,
  onCommit,
}: {
  label: string;
  description: string;
  value: string;
  onCommit: (value: string) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = useCallback((rawValue: string) => {
    const normalized = normalizeHexDraft(rawValue, value);
    setDraft(normalized);
    onCommit(normalized);
  }, [onCommit, value]);

  return (
    <div className="rounded-lg border border-subtle bg-surface-editor px-3 py-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-default">{label}</div>
          <div className="mt-1 text-xs leading-4 text-muted">{description}</div>
        </div>
        <div className="h-6 w-6 shrink-0 rounded border border-default" style={{ background: value }} />
      </div>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => commit(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-surface-input p-1"
          aria-label={`${label} color`}
        />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit((e.currentTarget as HTMLInputElement).value);
              e.currentTarget.blur();
            }
          }}
          placeholder="#242424"
        />
      </div>
    </div>
  );
}

interface PrimaryColorPanelProps {
  lightTheme: ThemeSlotConfig;
  darkTheme: ThemeSlotConfig;
  t: ReturnType<typeof useI18n>['t'];
  onSetPrimaryMode: (mode: ResolvedThemeMode, primaryMode: ThemeSlotConfig['primaryMode']) => void;
  onSetPrimaryPreset: (mode: ResolvedThemeMode, presetId: string) => void;
  onSetPrimaryCustomColor: (mode: ResolvedThemeMode, color: string) => void;
}

function PrimaryColorPanel({
  lightTheme,
  darkTheme,
  t,
  onSetPrimaryMode,
  onSetPrimaryPreset,
  onSetPrimaryCustomColor,
}: PrimaryColorPanelProps): JSX.Element {
  const presets = getPrimaryPresets();
  const activeColor = darkTheme.primaryMode === 'custom'
    ? darkTheme.primaryCustomColor
    : (presets.find((preset) => preset.id === darkTheme.primaryPresetId)?.color ?? presets[0].color);
  const [customColorDraft, setCustomColorDraft] = useState(activeColor);
  const bothDiffer =
    lightTheme.primaryMode !== darkTheme.primaryMode ||
    lightTheme.primaryPresetId !== darkTheme.primaryPresetId ||
    lightTheme.primaryCustomColor !== darkTheme.primaryCustomColor;

  const applyToBothModes = useCallback((callback: (mode: ResolvedThemeMode) => void) => {
    (['light', 'dark'] as const).forEach(callback);
  }, []);

  const setPreset = useCallback((presetId: string) => {
    applyToBothModes((mode) => {
      onSetPrimaryMode(mode, 'preset');
      onSetPrimaryPreset(mode, presetId);
    });
  }, [applyToBothModes, onSetPrimaryMode, onSetPrimaryPreset]);

  const setCustomColor = useCallback((color: string) => {
    setCustomColorDraft(color);
    applyToBothModes((mode) => onSetPrimaryCustomColor(mode, color));
  }, [applyToBothModes, onSetPrimaryCustomColor]);

  const commitCustomColor = useCallback((value: string) => {
    const normalized = value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(normalized) || /^#[0-9a-fA-F]{3}$/.test(normalized)) {
      setCustomColor(normalized);
    } else {
      setCustomColorDraft(activeColor);
    }
  }, [activeColor, setCustomColor]);

  useEffect(() => {
    setCustomColorDraft(activeColor);
  }, [activeColor]);

  return (
    <section data-section="primary-color" className="mb-10">
      <h3 className="text-base font-semibold text-default">{t('settings.primaryPalette')}</h3>
      <p className="mb-4 mt-1 text-sm text-secondary">
        앱의 배경은 고정됩니다. 여기서 고른 색은 버튼, 선택 표시, 링크, 노드의 작은 강조에만 사용됩니다.
      </p>

      {bothDiffer && (
        <div className="mb-4 rounded-xl border border-subtle bg-surface-card px-4 py-3 text-sm text-secondary">
          이전 설정에서 light/dark 포인트 색이 달랐습니다. 아래에서 색을 고르면 두 모드에 같이 적용됩니다.
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`rounded-xl border p-3 text-left transition-all ${
              darkTheme.primaryMode === 'preset' && darkTheme.primaryPresetId === preset.id
                ? 'border-accent bg-state-selected text-accent shadow-sm'
                : 'border-subtle bg-surface-card text-secondary hover:border-default hover:bg-state-hover/60 hover:text-default'
            }`}
            onClick={() => setPreset(preset.id)}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="truncate text-sm font-semibold">{t(preset.labelKey)}</div>
              <div className="h-5 w-5 shrink-0 rounded-full border border-white/40 shadow-sm" style={{ background: preset.color }} />
            </div>
            <div className="h-8 rounded-lg border border-subtle" style={{ background: preset.color }} />
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-subtle bg-surface-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-default">{t('settings.primaryCustom')}</div>
            <div className="mt-1 text-xs text-muted">HEX 값을 직접 넣거나 색상 피커를 엽니다.</div>
          </div>
          <div className="h-8 w-8 rounded-full border border-default" style={{ background: activeColor }} />
        </div>
        <div className="flex gap-3">
          <input
            type="color"
            value={activeColor}
            onChange={(e) => setCustomColor(e.target.value)}
            className="h-10 w-16 shrink-0 cursor-pointer rounded-lg border border-input bg-surface-input p-1"
            aria-label={t('settings.openColorPicker')}
          />
          <Input
            value={customColorDraft}
            onChange={(e) => setCustomColorDraft(e.target.value)}
            onBlur={(e) => commitCustomColor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitCustomColor((e.currentTarget as HTMLInputElement).value);
                e.currentTarget.blur();
              }
            }}
            placeholder="#0d99ff"
          />
        </div>
      </div>
    </section>
  );
}

function ThemeTokenPreview(): JSX.Element {
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-subtle bg-surface-chrome p-3">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted">
        <span className="font-semibold text-default">토큰 미리보기</span>
        <span>chrome / rail / pane / state / accent</span>
      </div>

      <div className="grid min-h-[260px] gap-3 lg:grid-cols-[1fr_1.2fr]">
        <div className="relative overflow-hidden rounded-lg bg-surface-canvas p-4">
          <div
            className="absolute inset-0 opacity-45"
            style={{
              backgroundImage: 'radial-gradient(circle, var(--border-subtle) 1px, transparent 1px)',
              backgroundSize: '14px 14px',
            }}
          />
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-center justify-between rounded-lg bg-surface-rail px-3 py-2 text-xs text-secondary">
              <span>Canvas toolbar</span>
              <span className="rounded bg-state-muted px-2 py-0.5 text-accent">81%</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div
                className="rounded-lg px-3 py-2 text-xs text-default"
                style={{
                  background: 'var(--surface-node)',
                  border: '1px solid var(--border-default)',
                }}
              >
                <div className="font-semibold">Node</div>
                <div className="text-muted">surface-node</div>
              </div>
              <div
                className="rounded-lg px-3 py-2 text-xs text-default"
                style={{
                  background: 'var(--surface-node-selected)',
                  border: '1px solid var(--border-accent)',
                }}
              >
                <div className="font-semibold text-accent">Selected Node</div>
                <div className="text-muted">accent border</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 gap-3">
          <div className="flex w-12 shrink-0 flex-col items-center gap-3 rounded-lg bg-surface-rail py-3">
            <span className="h-5 w-5 rounded bg-state-hover" />
            <span className="h-5 w-5 rounded bg-state-selected" />
            <span className="h-5 w-5 rounded bg-state-muted" />
            <span className="mt-auto h-5 w-5 rounded bg-accent" />
          </div>

          <div className="min-w-0 flex-1 overflow-hidden rounded-lg bg-surface-editor">
            <div className="flex h-9 items-end bg-surface-chrome px-3">
              <div
                className="flex h-7 items-center gap-2 rounded-t-lg px-3 text-xs font-semibold text-default"
                style={{
                  background: 'var(--surface-editor)',
                  border: '1px solid var(--border-default)',
                  borderBottom: 0,
                }}
              >
                <span className="h-1.5 w-5 rounded-full bg-accent" />
                Preview.md
              </div>
            </div>

            <div className="grid gap-3 p-4 md:grid-cols-[1fr_160px]">
              <div className="space-y-3">
                <div className="rounded-lg bg-state-hover px-3 py-2 text-xs text-default">
                  Hover row
                </div>
                <div className="rounded-lg bg-state-selected px-3 py-2 text-xs text-accent">
                  Selected row
                </div>
                <div className="rounded-lg bg-state-drop px-3 py-2 text-xs text-default">
                  Drop target
                </div>
                <div className="rounded-lg border border-input bg-surface-input px-3 py-2 text-xs text-secondary">
                  Input surface
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded bg-accent px-2 py-1 text-xs text-on-accent">Accent</span>
                  <span className="rounded px-2 py-1 text-xs text-on-accent" style={{ background: 'var(--accent-hover)' }}>
                    Accent hover
                  </span>
                  <span className="rounded bg-accent-muted px-2 py-1 text-xs text-accent">Muted</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border border-subtle bg-surface-panel p-3 text-xs text-default">
                  Panel
                </div>
                <div className="rounded-lg border border-default bg-surface-card p-3 text-xs text-default">
                  Card
                </div>
                <div
                  className="rounded-lg bg-surface-floating p-3 text-xs text-default"
                  style={{ border: '1px solid var(--border-strong)' }}
                >
                  Floating
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ThemeTokenPanelProps {
  mode: ResolvedThemeMode;
  theme: ThemeSlotConfig;
  themeRevision: number;
  onSetTokenOverride: (mode: ResolvedThemeMode, cssVar: string, color: string) => void;
  onApplyPreset: (mode: ResolvedThemeMode, presetId: string) => void;
  onReset: (mode: ResolvedThemeMode) => void;
}

function ThemeTokenPanel({
  mode,
  theme,
  themeRevision,
  onSetTokenOverride,
  onApplyPreset,
  onReset,
}: ThemeTokenPanelProps): JSX.Element {
  const tokens = getThemeColorTokens();
  const presets = getThemeTokenPresets();
  const [resolvedColors, setResolvedColors] = useState<Record<string, string>>({});

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setResolvedColors(Object.fromEntries(tokens.map((token) => [token.cssVar, resolveCssVarHex(token.cssVar)])));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode, themeRevision, tokens]);

  return (
    <section data-section="theme-token-colors" className="mb-10">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-default">토큰 색상</h3>
          <p className="mt-1 text-sm text-secondary">
            현재 {mode === 'dark' ? 'dark' : 'light'} 모드의 주요 surface/border 토큰을 HEX로 직접 조정합니다.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onReset(mode)}>
          초기화
        </Button>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="rounded-xl border border-subtle bg-surface-card p-3 text-left text-secondary transition-all hover:border-default hover:bg-state-hover/60 hover:text-default"
            onClick={() => onApplyPreset(mode, preset.id)}
            title={preset.source}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-default">{preset.label}</div>
              <div className="flex shrink-0 overflow-hidden rounded border border-default">
                {preset.preview.map((color) => (
                  <span key={color} className="h-4 w-5" style={{ background: color }} />
                ))}
              </div>
            </div>
            <div className="text-xs leading-5 text-muted">{preset.description}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tokens.map((token) => {
          const value = theme.tokenOverrides[token.cssVar] ?? resolvedColors[token.cssVar] ?? '#000000';
          return (
            <ThemeTokenInput
              key={token.cssVar}
              label={token.label}
              description={token.description}
              value={value}
              onCommit={(color) => onSetTokenOverride(mode, token.cssVar, color)}
            />
          );
        })}
      </div>

      <ThemeTokenPreview />
    </section>
  );
}

interface TerminalPresetPanelProps {
  terminalPresetId: TerminalPresetId;
  t: ReturnType<typeof useI18n>['t'];
  onSelect: (presetId: TerminalPresetId) => void;
}

function TerminalPresetPanel({
  terminalPresetId,
  t,
  onSelect,
}: TerminalPresetPanelProps): JSX.Element {
  const presets = getTerminalPresets();

  return (
    <section data-section="terminal-preset" className="mb-10">
      <h3 className="text-base font-semibold text-default">{t('settings.terminalPreset')}</h3>
      <p className="mb-4 mt-1 text-sm text-secondary">{t('settings.terminalPresetDesc')}</p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`rounded-xl border p-4 text-left transition-all ${
              terminalPresetId === preset.id
                ? 'border-accent bg-state-selected text-accent shadow-sm'
                : 'border-subtle bg-surface-card text-secondary hover:border-default hover:bg-state-hover/60 hover:text-default'
            }`}
            onClick={() => onSelect(preset.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{t(preset.labelKey)}</div>
                <div className="mt-1 text-xs leading-5 text-muted">
                  {t(preset.descriptionKey)}
                </div>
              </div>
              <div
                className="mt-1 h-3 w-3 shrink-0 rounded-full border border-subtle"
                style={{ background: preset.preview[2] }}
              />
            </div>

            <div
              className="mt-4 rounded-lg border border-subtle px-3 py-2"
              style={{
                background: 'var(--surface-editor)',
                color: 'var(--text-default)',
                fontFamily: preset.fontFamily,
                fontSize: `${preset.fontSize}px`,
                lineHeight: String(preset.lineHeight),
                letterSpacing: `${preset.letterSpacing}px`,
              }}
            >
              <div className="text-xs opacity-70">PS C:\\world&gt;</div>
              <div className="mt-1 flex items-center gap-2 text-sm">
                <span className="font-medium">prompt</span>
                <span className="opacity-70">sample text</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

interface TerminalAppearancePanelProps {
  terminalAppearance: TerminalAppearanceConfig;
  fontOptions: SelectOption[];
  fontsLoading: boolean;
  fontError: string | null;
  t: ReturnType<typeof useI18n>['t'];
  onUpdate: (patch: Partial<TerminalAppearanceConfig>) => void;
}

interface TypographyPanelProps {
  typography: TypographyConfig;
  fontOptions: SelectOption[];
  fontsLoading: boolean;
  fontError: string | null;
  t: ReturnType<typeof useI18n>['t'];
  onUpdate: (role: AppFontRole, patch: Partial<FontRoleConfig>) => void;
}

const FONT_SIZE_LIMITS = {
  ui: { min: 14, max: 18 },
  body: { min: 12, max: 24 },
  code: { min: 11, max: 24 },
  terminal: { min: 8, max: 28 },
} as const;

function withCurrentFontOption(
  options: SelectOption[],
  fontFamily: string,
  t: ReturnType<typeof useI18n>['t'],
): SelectOption[] {
  const current = getPrimaryFontFamily(fontFamily);
  if (!current || options.some((option) => option.value === current)) {
    return options;
  }

  return [{ value: current, label: `${current} · ${t('settings.currentSelection')}` }, ...options];
}

function FontSourceHint({
  fontError,
  t,
}: {
  fontError: string | null;
  t: ReturnType<typeof useI18n>['t'];
}): JSX.Element {
  if (fontError) {
    return <div className="mt-2 text-xs text-status-error">{fontError}</div>;
  }

  return <div className="mt-2 text-xs text-muted">{t('settings.installedFontsHint')}</div>;
}

function FontRoleCard({
  role,
  title,
  description,
  sampleText,
  config,
  fontOptions,
  fontsLoading,
  fontError,
  t,
  onUpdate,
}: {
  role: AppFontRole;
  title: string;
  description: string;
  sampleText: string;
  config: FontRoleConfig;
  fontOptions: SelectOption[];
  fontsLoading: boolean;
  fontError: string | null;
  t: ReturnType<typeof useI18n>['t'];
  onUpdate: (role: AppFontRole, patch: Partial<FontRoleConfig>) => void;
}): JSX.Element {
  const primaryFont = getPrimaryFontFamily(config.fontFamily);
  const selectableFonts = withCurrentFontOption(fontOptions, config.fontFamily, t);
  const sizeLimits = FONT_SIZE_LIMITS[role];

  return (
    <div className="rounded-xl border border-subtle bg-surface-card p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-default">{title}</div>
        <div className="mt-1 text-xs leading-5 text-muted">{description}</div>
      </div>

      <div
        className="mb-4 rounded-lg border border-subtle bg-surface-editor px-3 py-3 text-default"
        style={{
          fontFamily: config.fontFamily,
          fontSize: `${config.fontSize}px`,
          lineHeight: String(config.lineHeight),
          letterSpacing: `${config.letterSpacing}px`,
        }}
      >
        {sampleText}
      </div>

      <div className="mb-4">
        <div className="mb-2 text-sm font-medium text-default">{t('settings.fontFamily')}</div>
        <Select
          value={primaryFont}
          onChange={(e) => onUpdate(role, { fontFamily: buildRoleFontFamily(role, e.target.value) })}
          options={selectableFonts}
          disabled={fontsLoading || selectableFonts.length === 0}
          searchable
          searchPlaceholder={t('common.search')}
          emptyMessage={t('common.noResults')}
          placeholder={fontsLoading ? t('common.loading') : t('settings.fontListUnavailable')}
        />
        <FontSourceHint fontError={fontError} t={t} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <div className="mb-2 text-sm font-medium text-default">{t('settings.fontSize')}</div>
          <NumberInput
            value={config.fontSize}
            onChange={(value) => onUpdate(role, { fontSize: value })}
            min={sizeLimits.min}
            max={sizeLimits.max}
            step={1}
          />
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-default">{t('settings.lineHeight')}</div>
          <NumberInput
            value={config.lineHeight}
            onChange={(value) => onUpdate(role, { lineHeight: value })}
            min={1}
            max={2.2}
            step={0.01}
          />
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-default">{t('settings.letterSpacing')}</div>
          <NumberInput
            value={config.letterSpacing}
            onChange={(value) => onUpdate(role, { letterSpacing: value })}
            min={-1}
            max={4}
            step={0.1}
          />
        </div>
      </div>
    </div>
  );
}

function TypographyPanel({
  typography,
  fontOptions,
  fontsLoading,
  fontError,
  t,
  onUpdate,
}: TypographyPanelProps): JSX.Element {
  return (
    <section data-section="typography" className="mb-10">
      <h3 className="text-base font-semibold text-default">{t('settings.typography')}</h3>
      <p className="mb-4 mt-1 text-sm text-secondary">{t('settings.typographyDesc')}</p>

      <div className="grid gap-4 xl:grid-cols-3">
        <FontRoleCard
          role="ui"
          title={t('settings.interfaceFont')}
          description={t('settings.interfaceFontDesc')}
          sampleText={t('settings.interfaceFontSample')}
          config={typography.ui}
          fontOptions={fontOptions}
          fontsLoading={fontsLoading}
          fontError={fontError}
          t={t}
          onUpdate={onUpdate}
        />
        <FontRoleCard
          role="body"
          title={t('settings.bodyFont')}
          description={t('settings.bodyFontDesc')}
          sampleText={t('settings.bodyFontSample')}
          config={typography.body}
          fontOptions={fontOptions}
          fontsLoading={fontsLoading}
          fontError={fontError}
          t={t}
          onUpdate={onUpdate}
        />
        <FontRoleCard
          role="code"
          title={t('settings.codeFont')}
          description={t('settings.codeFontDesc')}
          sampleText={t('settings.codeFontSample')}
          config={typography.code}
          fontOptions={fontOptions}
          fontsLoading={fontsLoading}
          fontError={fontError}
          t={t}
          onUpdate={onUpdate}
        />
      </div>
    </section>
  );
}

function TerminalAppearancePanel({
  terminalAppearance,
  fontOptions,
  fontsLoading,
  fontError,
  t,
  onUpdate,
}: TerminalAppearancePanelProps): JSX.Element {
  const primaryFont = getPrimaryFontFamily(terminalAppearance.fontFamily);
  const selectableFonts = withCurrentFontOption(fontOptions, terminalAppearance.fontFamily, t);

  return (
    <section data-section="terminal-appearance" className="mb-10">
      <h3 className="text-base font-semibold text-default">{t('settings.terminalAppearance')}</h3>
      <p className="mb-4 mt-1 text-sm text-secondary">{t('settings.terminalAppearanceDesc')}</p>

      <div className="mb-4">
        <div className="mb-2 text-sm font-medium text-default">{t('settings.terminalFontFamily')}</div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <Select
              value={primaryFont}
              onChange={(e) => onUpdate({ fontFamily: buildRoleFontFamily('terminal', e.target.value) })}
              options={selectableFonts}
              disabled={fontsLoading || selectableFonts.length === 0}
              searchable
              searchPlaceholder={t('common.search')}
              emptyMessage={t('common.noResults')}
              placeholder={fontsLoading ? t('common.loading') : t('settings.fontListUnavailable')}
            />
            <FontSourceHint fontError={fontError} t={t} />
          </div>
          <div
            className="rounded-lg border border-subtle bg-surface-editor px-3 py-3 text-default"
            style={{
              fontFamily: terminalAppearance.fontFamily,
              fontSize: `${terminalAppearance.fontSize}px`,
              lineHeight: String(terminalAppearance.lineHeight),
              letterSpacing: `${terminalAppearance.letterSpacing}px`,
            }}
          >
            <div className="text-xs opacity-70">PS C:\\world&gt;</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-medium">prompt</span>
              <span className="opacity-70">{t('settings.terminalFontSample')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <div className="mb-2 text-sm font-medium text-default">{t('settings.fontSize')}</div>
          <NumberInput
            value={terminalAppearance.fontSize}
            onChange={(value) => onUpdate({ fontSize: value })}
            min={FONT_SIZE_LIMITS.terminal.min}
            max={FONT_SIZE_LIMITS.terminal.max}
            step={1}
          />
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-default">{t('settings.lineHeight')}</div>
          <NumberInput
            value={terminalAppearance.lineHeight}
            onChange={(value) => onUpdate({ lineHeight: value })}
            min={0.8}
            max={2}
            step={0.01}
          />
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-default">{t('settings.letterSpacing')}</div>
          <NumberInput
            value={terminalAppearance.letterSpacing}
            onChange={(value) => onUpdate({ letterSpacing: value })}
            min={-2}
            max={8}
            step={0.1}
          />
        </div>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <div className="mb-2 text-sm font-medium text-default">{t('settings.terminalPaddingX')}</div>
          <NumberInput
            value={terminalAppearance.paddingX}
            onChange={(value) => onUpdate({ paddingX: value })}
            min={0}
            max={48}
            step={1}
          />
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-default">{t('settings.terminalPaddingY')}</div>
          <NumberInput
            value={terminalAppearance.paddingY}
            onChange={(value) => onUpdate({ paddingY: value })}
            min={0}
            max={48}
            step={1}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg border border-subtle px-3 py-2">
          <div>
            <div className="text-sm font-medium text-default">{t('settings.terminalCursorBlink')}</div>
            <div className="mt-1 text-xs text-muted">{t('settings.terminalCursorBlinkDesc')}</div>
          </div>
          <Toggle
            checked={terminalAppearance.cursorBlink}
            onChange={(checked) => onUpdate({ cursorBlink: checked })}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-subtle px-3 py-2">
          <div>
            <div className="text-sm font-medium text-default">{t('settings.terminalWebglRenderer')}</div>
            <div className="mt-1 text-xs text-muted">{t('settings.terminalWebglRendererDesc')}</div>
          </div>
          <Toggle
            checked={terminalAppearance.webGLRenderer}
            onChange={(checked) => onUpdate({ webGLRenderer: checked })}
          />
        </div>
      </div>
    </section>
  );
}

interface BrowserSettingsPanelProps {
  browser: BrowserSettingsConfig;
  onUpdate: (patch: Partial<BrowserSettingsConfig>) => void;
}

function BrowserSettingsPanel({ browser, onUpdate }: BrowserSettingsPanelProps): JSX.Element {
  const [homeUrlDraft, setHomeUrlDraft] = useState(browser.homeUrl);

  useEffect(() => {
    setHomeUrlDraft(browser.homeUrl);
  }, [browser.homeUrl]);

  const commitHomeUrl = () => {
    const nextUrl = homeUrlDraft.trim();
    onUpdate({ homeUrl: nextUrl || browser.homeUrl });
  };

  return (
    <div data-section="browser">
      <section data-section="기본-페이지" className="mb-8">
        <h3 className="text-base font-semibold text-default">기본 페이지</h3>
        <p className="mb-4 text-sm text-secondary">
          액티비티 바의 브라우저 버튼으로 열 기본 URL을 정합니다.
        </p>
        <Input
          value={homeUrlDraft}
          onChange={(event) => setHomeUrlDraft(event.target.value)}
          onBlur={commitHomeUrl}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
          placeholder="https://www.google.com/"
          spellCheck={false}
        />
      </section>

      <section data-section="열기-동작" className="mb-8">
        <h3 className="text-base font-semibold text-default">열기 동작</h3>
        <p className="mb-4 text-sm text-secondary">
          외부 링크와 사이트가 요청하는 새 창을 Netior 브라우저 탭으로 받을지 선택합니다.
        </p>
        <div className="grid gap-3">
          <div className="flex items-center justify-between rounded-lg border border-subtle px-3 py-2">
            <div>
              <div className="text-sm font-medium text-default">웹 링크를 앱 안에서 열기</div>
              <div className="mt-1 text-xs text-muted">http/https 링크를 가능하면 브라우저 에디터 탭으로 엽니다.</div>
            </div>
            <Toggle
              checked={browser.openLinksInApp}
              onChange={(checked) => onUpdate({ openLinksInApp: checked })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-subtle px-3 py-2">
            <div>
              <div className="text-sm font-medium text-default">새 창 요청을 탭으로 열기</div>
              <div className="mt-1 text-xs text-muted">사이트의 팝업/새 창 요청을 자체 에디터 탭으로 라우팅합니다.</div>
            </div>
            <Toggle
              checked={browser.openPopupsInTabs}
              onChange={(checked) => onUpdate({ openPopupsInTabs: checked })}
            />
          </div>
        </div>
      </section>

      <section data-section="상태-표시" className="mb-8">
        <h3 className="text-base font-semibold text-default">상태 표시</h3>
        <p className="mb-4 text-sm text-secondary">
          브라우저 작업 중 앱 크롬 위에 보여줄 보조 피드백을 조정합니다.
        </p>
        <div className="flex items-center justify-between rounded-lg border border-subtle px-3 py-2">
          <div>
            <div className="text-sm font-medium text-default">다운로드 상태 표시</div>
            <div className="mt-1 text-xs text-muted">다운로드 진행률과 완료 후 폴더 열기 버튼을 표시합니다.</div>
          </div>
          <Toggle
            checked={browser.showDownloadToast}
            onChange={(checked) => onUpdate({ showDownloadToast: checked })}
          />
        </div>
      </section>
    </div>
  );
}

type NarreProviderName = 'claude' | 'openai' | 'codex';

interface NarreSettingsDraft {
  provider: NarreProviderName;
  anthropicApiKey: string;
  openaiApiKey: string;
  openaiModel: string;
  behaviorSettings: NarreBehaviorSettings;
  codexSettings: NarreCodexSettings;
}

const DEFAULT_NARRE_BEHAVIOR_SETTINGS: NarreBehaviorSettings = {
  graphPriority: 'strict',
  discourageLocalWorkspaceActions: true,
  extraInstructions: '',
};

const DEFAULT_NARRE_CODEX_SETTINGS: NarreCodexSettings = {
  model: '',
  useWorldRootAsWorkingDirectory: true,
  sandboxMode: 'read-only',
  approvalPolicy: 'on-request',
  enableShellTool: false,
  enableMultiAgent: false,
  enableWebSearch: false,
  enableViewImage: false,
  enableApps: false,
};

const EMPTY_NARRE_SETTINGS: NarreSettingsDraft = {
  provider: 'claude',
  anthropicApiKey: '',
  openaiApiKey: '',
  openaiModel: '',
  behaviorSettings: DEFAULT_NARRE_BEHAVIOR_SETTINGS,
  codexSettings: DEFAULT_NARRE_CODEX_SETTINGS,
};

function normalizeNarreProvider(value: unknown): NarreProviderName {
  if (value === 'openai') {
    return 'openai';
  }
  if (value === 'codex') {
    return 'codex';
  }
  return 'claude';
}

function normalizeBehaviorSettings(value: unknown): NarreBehaviorSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_NARRE_BEHAVIOR_SETTINGS };
  }

  const source = value as Record<string, unknown>;
  return {
    graphPriority: source.graphPriority === 'balanced' ? 'balanced' : 'strict',
    discourageLocalWorkspaceActions: source.discourageLocalWorkspaceActions !== false,
    extraInstructions: typeof source.extraInstructions === 'string' ? source.extraInstructions : '',
  };
}

function normalizeCodexSettings(value: unknown): NarreCodexSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_NARRE_CODEX_SETTINGS };
  }

  const source = value as Record<string, unknown>;
  return {
    model: typeof source.model === 'string' ? source.model : '',
    useWorldRootAsWorkingDirectory: source.useWorldRootAsWorkingDirectory !== false,
    sandboxMode: source.sandboxMode === 'workspace-write' || source.sandboxMode === 'danger-full-access'
      ? source.sandboxMode
      : 'read-only',
    approvalPolicy: source.approvalPolicy === 'untrusted' || source.approvalPolicy === 'never'
      ? source.approvalPolicy
      : 'on-request',
    enableShellTool: source.enableShellTool === true,
    enableMultiAgent: source.enableMultiAgent === true,
    enableWebSearch: source.enableWebSearch === true,
    enableViewImage: source.enableViewImage === true,
    enableApps: source.enableApps === true,
  };
}

function NarreSettingsPanel({
  open,
  t,
}: {
  open: boolean;
  t: ReturnType<typeof useI18n>['t'];
}): JSX.Element {
  const [draft, setDraft] = useState<NarreSettingsDraft>(EMPTY_NARRE_SETTINGS);
  const [savedDraft, setSavedDraft] = useState<NarreSettingsDraft>(EMPTY_NARRE_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setStatus(null);

    void Promise.all([
      window.electron.config.get('narre.provider'),
      window.electron.config.get('narre.behavior'),
      window.electron.config.get('narre.codex'),
      window.electron.config.get('anthropic_api_key'),
      window.electron.config.get('openai_api_key'),
      window.electron.config.get('narre.openai.model'),
    ]).then(([
      providerResult,
      behaviorResult,
      codexResult,
      anthropicKeyResult,
      openaiKeyResult,
      openaiModelResult,
    ]) => {
      if (cancelled) {
        return;
      }

      const nextDraft: NarreSettingsDraft = {
        provider: normalizeNarreProvider(unwrapIpc(providerResult)),
        behaviorSettings: normalizeBehaviorSettings(unwrapIpc(behaviorResult)),
        codexSettings: normalizeCodexSettings(unwrapIpc(codexResult)),
        anthropicApiKey: typeof unwrapIpc(anthropicKeyResult) === 'string' ? unwrapIpc(anthropicKeyResult) as string : '',
        openaiApiKey: typeof unwrapIpc(openaiKeyResult) === 'string' ? unwrapIpc(openaiKeyResult) as string : '',
        openaiModel: typeof unwrapIpc(openaiModelResult) === 'string' ? unwrapIpc(openaiModelResult) as string : '',
      };

      setDraft(nextDraft);
      setSavedDraft(nextDraft);
      setLoading(false);
    }).catch((error: Error) => {
      if (cancelled) {
        return;
      }

      setStatus({
        kind: 'error',
        message: `${t('settings.narreConfigLoadFailed')}: ${error.message}`,
      });
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, t]);

  const hasChanges = (
    draft.provider !== savedDraft.provider ||
    draft.anthropicApiKey !== savedDraft.anthropicApiKey ||
    draft.openaiApiKey !== savedDraft.openaiApiKey ||
    draft.openaiModel !== savedDraft.openaiModel ||
    JSON.stringify(draft.behaviorSettings) !== JSON.stringify(savedDraft.behaviorSettings) ||
    JSON.stringify(draft.codexSettings) !== JSON.stringify(savedDraft.codexSettings)
  );

  const activeApiKey = draft.provider === 'openai' ? draft.openaiApiKey : draft.anthropicApiKey;
  const openaiKeyMissing = draft.provider === 'openai' && draft.openaiApiKey.trim().length === 0;

  const updateDraft = useCallback((updater: (current: NarreSettingsDraft) => NarreSettingsDraft) => {
    setStatus(null);
    setDraft((current) => updater(current));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setStatus(null);

    const nextDraft: NarreSettingsDraft = {
      ...draft,
      anthropicApiKey: draft.anthropicApiKey.trim(),
      openaiApiKey: draft.openaiApiKey.trim(),
      openaiModel: draft.openaiModel.trim(),
      behaviorSettings: {
        ...draft.behaviorSettings,
        extraInstructions: draft.behaviorSettings.extraInstructions?.trim() ?? '',
      },
      codexSettings: {
        ...draft.codexSettings,
        model: draft.codexSettings.model?.trim() ?? '',
      },
    };

    try {
      unwrapIpc(await window.electron.config.set('anthropic_api_key', nextDraft.anthropicApiKey));
      unwrapIpc(await window.electron.config.set('openai_api_key', nextDraft.openaiApiKey));
      unwrapIpc(await window.electron.config.set('narre.openai.model', nextDraft.openaiModel));
      unwrapIpc(await window.electron.config.set('narre.behavior', nextDraft.behaviorSettings));
      unwrapIpc(await window.electron.config.set('narre.codex', nextDraft.codexSettings));
      unwrapIpc(await window.electron.config.set('narre.provider', nextDraft.provider));

      setDraft(nextDraft);
      setSavedDraft(nextDraft);
      setStatus({
        kind: 'success',
        message: t('settings.narreSaveSuccess'),
      });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: `${t('settings.narreConfigSaveFailed')}: ${(error as Error).message}`,
      });
    } finally {
      setSaving(false);
    }
  }, [draft, t]);

  return (
    <div data-section="narre">
      <section data-section="narre-provider" className="mb-8">
        <h3 className="text-base font-semibold text-default">{t('settings.narreProvider')}</h3>
        <p className="mb-4 text-sm text-secondary">{t('settings.narreProviderDesc')}</p>
        <div className="flex gap-3">
          {([
            { key: 'claude' as const, label: t('settings.narreProviderClaude') },
            { key: 'openai' as const, label: t('settings.narreProviderOpenAI') },
            { key: 'codex' as const, label: t('settings.narreProviderCodex' as never) },
          ]).map(({ key, label }) => (
            <button
              key={key}
              className={`rounded-lg border px-5 py-2 text-sm font-medium transition-colors ${
                draft.provider === key
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-subtle text-secondary hover:border-default hover:text-default'
              }`}
              onClick={() => updateDraft((current) => ({ ...current, provider: key }))}
              disabled={loading || saving}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section data-section="api-key" className="mb-8">
        {draft.provider === 'codex' ? (
          <>
            <h3 className="text-base font-semibold text-default">{t('settings.narreCodexAuth' as never)}</h3>
            <p className="mb-4 text-sm text-secondary">{t('settings.narreCodexAuthDesc' as never)}</p>
            <div className="rounded-lg border border-subtle bg-surface-card px-4 py-3 text-sm text-secondary">
              {t('settings.narreCodexAuthHint' as never)}
            </div>
          </>
        ) : (
          <>
            <h3 className="text-base font-semibold text-default">{t('settings.narreApiKey')}</h3>
            <p className="mb-4 text-sm text-secondary">{t('settings.narreApiKeyDesc')}</p>
            <Input
              type="password"
              value={activeApiKey}
              onChange={(e) => {
                const value = e.target.value;
                updateDraft((current) => current.provider === 'openai'
                  ? { ...current, openaiApiKey: value }
                  : { ...current, anthropicApiKey: value });
              }}
              placeholder={draft.provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
              disabled={loading || saving}
            />
            {openaiKeyMissing && (
              <div className="mt-2 text-xs text-status-warning">
                {t('settings.narreOpenAIKeyRequired')}
              </div>
            )}
          </>
        )}
      </section>

      {draft.provider === 'openai' && (
        <section data-section="openai-model" className="mb-8">
          <h3 className="text-base font-semibold text-default">{t('settings.narreOpenAIModel')}</h3>
          <p className="mb-4 text-sm text-secondary">{t('settings.narreOpenAIModelDesc')}</p>
          <Input
            value={draft.openaiModel}
            onChange={(e) => updateDraft((current) => ({ ...current, openaiModel: e.target.value }))}
            placeholder="gpt-5.1"
            disabled={loading || saving}
          />
        </section>
      )}

      {draft.provider === 'codex' && (
        <section data-section="codex-auth" className="mb-8 rounded-xl border border-subtle bg-surface-card p-4">
          <div className="text-sm font-semibold text-default">{t('settings.narreCodexAuth' as never)}</div>
          <div className="mt-2 text-xs text-muted">
            {t('settings.narreCodexAuthSetup' as never)}
          </div>
        </section>
      )}

      <section data-section="narre-behavior" className="mb-8 rounded-xl border border-subtle bg-surface-card p-4">
        <h3 className="text-base font-semibold text-default">{t('settings.narreBehaviorTitle' as never)}</h3>
        <p className="mb-4 mt-1 text-sm text-secondary">{t('settings.narreBehaviorDesc' as never)}</p>

        <div className="mb-4">
          <div className="mb-2 text-sm font-medium text-default">{t('settings.narreGraphPriority' as never)}</div>
          <Select
            value={draft.behaviorSettings.graphPriority}
            onChange={(e) => updateDraft((current) => ({
              ...current,
              behaviorSettings: {
                ...current.behaviorSettings,
                graphPriority: e.target.value as NarreBehaviorSettings['graphPriority'],
              },
            }))}
            disabled={loading || saving}
            options={[
              { value: 'strict', label: t('settings.narreGraphPriorityStrict' as never) },
              { value: 'balanced', label: t('settings.narreGraphPriorityBalanced' as never) },
            ]}
          />
        </div>

        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-default">{t('settings.narreDiscourageLocalWorkspaceActions' as never)}</div>
            <div className="mt-1 text-xs text-muted">{t('settings.narreDiscourageLocalWorkspaceActionsDesc' as never)}</div>
          </div>
          <Toggle
            checked={draft.behaviorSettings.discourageLocalWorkspaceActions}
            onChange={(checked) => updateDraft((current) => ({
              ...current,
              behaviorSettings: {
                ...current.behaviorSettings,
                discourageLocalWorkspaceActions: checked,
              },
            }))}
            disabled={loading || saving}
          />
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-default">{t('settings.narreExtraInstructions' as never)}</div>
          <div className="mb-2 text-xs text-muted">{t('settings.narreExtraInstructionsDesc' as never)}</div>
          <TextArea
            value={draft.behaviorSettings.extraInstructions ?? ''}
            onChange={(e) => updateDraft((current) => ({
              ...current,
              behaviorSettings: {
                ...current.behaviorSettings,
                extraInstructions: e.target.value,
              },
            }))}
            disabled={loading || saving}
            placeholder={t('settings.narreExtraInstructionsPlaceholder' as never)}
          />
        </div>
      </section>

      {draft.provider === 'codex' && (
        <section data-section="codex-runtime" className="mb-8 rounded-xl border border-subtle bg-surface-card p-4">
          <h3 className="text-base font-semibold text-default">{t('settings.narreCodexRuntime' as never)}</h3>
          <p className="mb-4 mt-1 text-sm text-secondary">{t('settings.narreCodexRuntimeDesc' as never)}</p>

          <div className="mb-4">
            <div className="mb-2 text-sm font-medium text-default">{t('settings.narreCodexModel' as never)}</div>
            <Input
              value={draft.codexSettings.model ?? ''}
              onChange={(e) => updateDraft((current) => ({
                ...current,
                codexSettings: {
                  ...current.codexSettings,
                  model: e.target.value,
                },
              }))}
              placeholder="gpt-5-codex"
              disabled={loading || saving}
            />
            <div className="mt-2 text-xs text-muted">{t('settings.narreCodexModelDesc' as never)}</div>
          </div>

          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-default">{t('settings.narreCodexUseWorldRoot' as never)}</div>
              <div className="mt-1 text-xs text-muted">{t('settings.narreCodexUseWorldRootDesc' as never)}</div>
            </div>
            <Toggle
              checked={draft.codexSettings.useWorldRootAsWorkingDirectory}
              onChange={(checked) => updateDraft((current) => ({
                ...current,
                codexSettings: {
                  ...current.codexSettings,
                  useWorldRootAsWorkingDirectory: checked,
                },
              }))}
              disabled={loading || saving}
            />
          </div>

          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-medium text-default">{t('settings.narreCodexSandbox' as never)}</div>
              <Select
                value={draft.codexSettings.sandboxMode}
                onChange={(e) => updateDraft((current) => ({
                  ...current,
                  codexSettings: {
                    ...current.codexSettings,
                    sandboxMode: e.target.value as NarreCodexSettings['sandboxMode'],
                  },
                }))}
                disabled={loading || saving}
                options={[
                  { value: 'read-only', label: t('settings.narreCodexSandboxReadOnly' as never) },
                  { value: 'workspace-write', label: t('settings.narreCodexSandboxWorkspaceWrite' as never) },
                  { value: 'danger-full-access', label: t('settings.narreCodexSandboxDanger' as never) },
                ]}
              />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-default">{t('settings.narreCodexApproval' as never)}</div>
              <Select
                value={draft.codexSettings.approvalPolicy}
                onChange={(e) => updateDraft((current) => ({
                  ...current,
                  codexSettings: {
                    ...current.codexSettings,
                    approvalPolicy: e.target.value as NarreCodexSettings['approvalPolicy'],
                  },
                }))}
                disabled={loading || saving}
                options={[
                  { value: 'untrusted', label: t('settings.narreCodexApprovalUntrusted' as never) },
                  { value: 'on-request', label: t('settings.narreCodexApprovalOnRequest' as never) },
                  { value: 'never', label: t('settings.narreCodexApprovalNever' as never) },
                ]}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {([
              ['enableShellTool', 'settings.narreCodexEnableShellTool'],
              ['enableMultiAgent', 'settings.narreCodexEnableMultiAgent'],
              ['enableWebSearch', 'settings.narreCodexEnableWebSearch'],
              ['enableViewImage', 'settings.narreCodexEnableViewImage'],
              ['enableApps', 'settings.narreCodexEnableApps'],
            ] as const).map(([key, labelKey]) => (
              <div key={key} className="flex items-center justify-between rounded-lg border border-subtle px-3 py-2">
                <div className="text-sm text-default">{t(labelKey as never)}</div>
                <Toggle
                  checked={draft.codexSettings[key]}
                  onChange={(checked) => updateDraft((current) => ({
                    ...current,
                    codexSettings: {
                      ...current.codexSettings,
                      [key]: checked,
                    },
                  }))}
                  disabled={loading || saving}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8 rounded-xl border border-subtle bg-surface-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-default">{t('settings.narreSave')}</div>
            <div className="mt-1 text-xs text-muted">{t('settings.narreRestartHint')}</div>
          </div>
          <Button
            onClick={() => { void handleSave(); }}
            isLoading={saving}
            disabled={loading || saving || !hasChanges}
          >
            {t('settings.narreSave')}
          </Button>
        </div>
        {loading && (
          <div className="mt-3 flex items-center gap-2 text-sm text-secondary">
            <Spinner size="sm" />
            {t('common.loading')}
          </div>
        )}
        {status && (
          <div className={`mt-3 text-sm ${status.kind === 'success' ? 'text-status-success' : 'text-status-error'}`}>
            {status.message}
          </div>
        )}
      </section>
    </div>
  );
}

export function SettingsModal({ open, onClose }: SettingsModalProps): JSX.Element | null {
  const { t } = useI18n();
  const {
    appearanceMode,
    resolvedThemeMode,
    themeRevision,
    lightTheme,
    darkTheme,
    locale,
    detachedAgentToastMode,
    nativeAgentNotificationsEnabled,
    agentNotificationSoundEnabled,
    typography,
    terminalPresetId,
    terminalAppearance,
    browser,
    setAppearanceMode,
    setThemePrimaryMode,
    setThemePrimaryPreset,
    setThemePrimaryCustomColor,
    setThemeTokenOverride,
    applyThemeTokenPreset,
    resetThemeTokenOverrides,
    setLocale,
    setDetachedAgentToastMode,
    setNativeAgentNotificationsEnabled,
    setAgentNotificationSoundEnabled,
    updateTypography,
    setTerminalPresetId,
    updateTerminalAppearance,
    updateBrowserSettings,
  } = useSettingsStore();
  const terminalPresets = getTerminalPresets();

  const [activeCategory, setActiveCategory] = useState('appearance');
  const [searchQuery, setSearchQuery] = useState('');
  const [fontOptions, setFontOptions] = useState<SelectOption[]>([]);
  const [fontsLoading, setFontsLoading] = useState(false);
  const [fontError, setFontError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const categories: CategoryItem[] = [
    {
      key: 'appearance',
      icon: Palette,
      label: t('settings.categoryAppearance'),
      anchors: [
        t('settings.appearanceMode'),
        t('settings.primaryPalette'),
        '토큰 색상',
        t('settings.typography'),
        t('settings.terminalPreset'),
        t('settings.terminalAppearance'),
      ],
    },
    {
      key: 'language',
      icon: Globe,
      label: t('settings.categoryLanguage'),
      anchors: [t('settings.language')],
    },
    {
      key: 'notifications',
      icon: Bell,
      label: t('settings.categoryNotifications'),
      anchors: [
        t('settings.nativeAgentNotifications'),
        t('settings.agentNotificationSounds'),
        t('settings.detachedAgentToasts'),
      ],
    },
    {
      key: 'sidebar',
      icon: Pin,
      label: t('settings.categorySidebar' as never),
      anchors: [
        t('settings.sidebarTopItems' as never),
        t('settings.sidebarBottomItems' as never),
      ],
    },
    {
      key: 'browser',
      icon: Compass,
      label: '브라우저',
      anchors: ['기본 페이지', '열기 동작', '상태 표시'],
    },
    {
      key: 'narre',
      icon: Sparkles,
      label: t('settings.categoryNarre'),
      anchors: [
        t('settings.narreProvider'),
        t('settings.narreApiKey'),
        t('settings.narreOpenAIModel'),
        t('settings.narreCodexAuth' as never),
        t('settings.narreBehaviorTitle' as never),
        t('settings.narreCodexRuntime' as never),
      ],
    },
  ];

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleEsc);
    setSearchQuery('');
    setActiveCategory('appearance');
    setTimeout(() => searchRef.current?.focus(), 100);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [handleEsc, open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setFontsLoading(true);
    setFontError(null);

    void window.electron.fonts.listSystem()
      .then((fonts) => {
        if (cancelled) return;
        setFontOptions(fonts.map((font) => ({ value: font, label: font })));
      })
      .catch(() => {
        if (cancelled) return;
        setFontOptions([]);
        setFontError(t('settings.fontListUnavailable'));
      })
      .finally(() => {
        if (cancelled) return;
        setFontsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, t]);

  const scrollToSection = (sectionId: string) => {
    const el = contentRef.current?.querySelector(`[data-section="${sectionId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCategoryClick = (key: string) => {
    setActiveCategory(key);
    scrollToSection(key);
  };

  const handleAnchorClick = (anchor: string) => {
    scrollToSection(anchor.toLowerCase().replace(/\s+/g, '-'));
  };

  const matchesSearch = (text: string) => {
    if (!searchQuery) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const showAppearance = [
    t('settings.categoryAppearance'),
    t('settings.appearanceMode'),
    t('settings.primaryPalette'),
    t('settings.typography'),
    t('settings.typographyDesc'),
    t('settings.interfaceFont'),
    t('settings.bodyFont'),
    t('settings.codeFont'),
    t('settings.terminalPreset'),
    t('settings.terminalPresetDesc'),
    t('settings.terminalAppearance'),
    t('settings.terminalAppearanceDesc'),
    t('settings.terminalFontFamily'),
    t('settings.fontSize'),
    t('settings.lineHeight'),
    t('settings.letterSpacing'),
    t('settings.terminalPaddingX'),
    t('settings.terminalPaddingY'),
    t('settings.terminalCursorBlink'),
    t('settings.terminalWebglRenderer'),
    ...terminalPresets.flatMap((preset) => [t(preset.labelKey), t(preset.descriptionKey)]),
  ].some(matchesSearch);
  const showLanguage = [
    t('settings.categoryLanguage'),
    t('settings.language'),
    '한국어',
    'English',
  ].some(matchesSearch);
  const showDetachedAgentToasts = [
    t('settings.categoryNotifications'),
    t('settings.nativeAgentNotifications'),
    t('settings.nativeAgentNotificationsDesc'),
    t('settings.agentNotificationSounds'),
    t('settings.agentNotificationSoundsDesc'),
    t('settings.detachedAgentToasts'),
    t('settings.notificationsEnabled'),
    t('settings.notificationsDisabled'),
  ].some(matchesSearch);
  const showSidebar = [
    t('settings.categorySidebar' as never),
    t('settings.sidebarTopItems' as never),
    t('settings.sidebarTopItemsDesc' as never),
    t('settings.sidebarBottomItems' as never),
    t('settings.sidebarBottomItemsDesc' as never),
    t('settings.sidebarNoWorld' as never),
    t('sidebar.objects'),
    t('sidebar.files'),
    t('sidebar.sessions' as never),
    t('sidebar.terminal' as never),
    t('sidebar.agents' as never),
    t('sidebar.settings' as never),
  ].some(matchesSearch);
  const showBrowser = [
    '브라우저',
    '기본 페이지',
    '열기 동작',
    '상태 표시',
    '웹 링크를 앱 안에서 열기',
    '새 창 요청을 탭으로 열기',
    '다운로드 상태 표시',
  ].some(matchesSearch);
  const showNarre = [
    t('settings.categoryNarre'),
    t('settings.narreProvider'),
    t('settings.narreProviderClaude'),
    t('settings.narreProviderOpenAI'),
    t('settings.narreProviderCodex' as never),
    t('settings.narreApiKey'),
    t('settings.narreOpenAIModel'),
    t('settings.narreCodexAuth' as never),
  ].some(matchesSearch);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 flex animate-in fade-in duration-200" style={{ zIndex: 10000 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 m-auto flex h-[90vh] w-[min(94vw,1120px)] overflow-hidden rounded-xl border border-subtle bg-surface-floating shadow-2xl ring-1 ring-black/10 animate-in zoom-in-95 duration-200">
        <div className="flex w-60 shrink-0 flex-col border-r border-subtle bg-surface-panel">
          <div className="p-3">
            <div className="flex items-center gap-2 rounded-md border border-subtle bg-surface-editor px-3 py-1.5">
              <Search size={14} className="shrink-0 text-muted" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('settings.search')}
                className="w-full bg-transparent text-sm text-default outline-none placeholder:text-muted"
              />
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 pb-3">
            {categories.map(({ key, icon: Icon, label, anchors }) => (
              <div key={key} className="mb-1">
                <button
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    activeCategory === key
                      ? 'bg-state-selected text-accent'
                      : 'text-secondary hover:bg-state-hover hover:text-default'
                  }`}
                  onClick={() => handleCategoryClick(key)}
                >
                  <Icon size={16} />
                  {label}
                </button>
                {activeCategory === key && (
                  <div className="ml-5 mt-0.5 flex flex-col border-l border-subtle pl-3">
                    {anchors.map((anchor) => (
                      <button
                        key={anchor}
                        className="py-1 text-left text-xs text-secondary transition-colors hover:text-default"
                        onClick={() => handleAnchorClick(anchor)}
                      >
                        {anchor}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>

        <div className="flex flex-1 flex-col bg-surface-panel">
          <div className="flex items-center justify-between border-b border-subtle px-6 py-4">
            <h2 className="text-lg font-semibold text-default">
              {categories.find((c) => c.key === activeCategory)?.label ?? t('settings.title')}
            </h2>
            <button
              className="rounded-md p-1 text-muted transition-colors hover:bg-state-hover hover:text-default"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>

          <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-5">
            {(activeCategory === 'appearance' || searchQuery) && showAppearance && (
              <div data-section="appearance">
                <section data-section="appearance-mode" className="mb-10">
                  <h3 className="text-base font-semibold text-default">{t('settings.appearanceMode')}</h3>
                  <p className="mb-4 text-sm text-secondary">{t('settings.appearanceModeDesc')}</p>
                  <div className="flex gap-3">
                    {([
                      { key: 'system' as const, label: t('settings.system') },
                      { key: 'dark' as const, label: t('settings.dark') },
                      { key: 'light' as const, label: t('settings.light') },
                    ]).map(({ key, label }) => (
                      <button
                        key={key}
                        className={`rounded-lg border px-5 py-2 text-sm font-medium transition-colors ${
                          appearanceMode === key
                            ? 'border-accent bg-accent text-on-accent'
                            : 'border-subtle text-secondary hover:border-default hover:text-default'
                        }`}
                        onClick={() => setAppearanceMode(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-muted">
                    {t('settings.currentResolvedMode')}: <span className="font-medium text-default">{resolvedThemeMode === 'dark' ? t('settings.dark') : t('settings.light')}</span>
                  </div>
                </section>

                <PrimaryColorPanel
                  lightTheme={lightTheme}
                  darkTheme={darkTheme}
                  t={t}
                  onSetPrimaryMode={setThemePrimaryMode}
                  onSetPrimaryPreset={setThemePrimaryPreset}
                  onSetPrimaryCustomColor={setThemePrimaryCustomColor}
                />

                <ThemeTokenPanel
                  mode={resolvedThemeMode}
                  theme={resolvedThemeMode === 'dark' ? darkTheme : lightTheme}
                  themeRevision={themeRevision}
                  onSetTokenOverride={setThemeTokenOverride}
                  onApplyPreset={applyThemeTokenPreset}
                  onReset={resetThemeTokenOverrides}
                />

                <TypographyPanel
                  typography={typography}
                  fontOptions={fontOptions}
                  fontsLoading={fontsLoading}
                  fontError={fontError}
                  t={t}
                  onUpdate={updateTypography}
                />

                <TerminalPresetPanel
                  terminalPresetId={terminalPresetId}
                  t={t}
                  onSelect={setTerminalPresetId}
                />

                <TerminalAppearancePanel
                  terminalAppearance={terminalAppearance}
                  fontOptions={fontOptions}
                  fontsLoading={fontsLoading}
                  fontError={fontError}
                  t={t}
                  onUpdate={updateTerminalAppearance}
                />
              </div>
            )}

            {(activeCategory === 'language' || searchQuery) && showLanguage && (
              <div data-section="language">
                <section data-section={t('settings.language').toLowerCase().replace(/\s+/g, '-')} className="mb-8">
                  <h3 className="text-base font-semibold text-default">{t('settings.language')}</h3>
                  <p className="mb-4 text-sm text-secondary">{t('settings.languageDesc')}</p>
                  <div className="flex gap-3">
                    {([
                      { key: 'ko' as const, label: '한국어' },
                      { key: 'en' as const, label: 'English' },
                    ]).map(({ key, label }) => (
                      <button
                        key={key}
                        className={`rounded-lg border px-5 py-2 text-sm font-medium transition-colors ${
                          locale === key
                            ? 'border-accent bg-accent text-on-accent'
                            : 'border-subtle text-secondary hover:border-default hover:text-default'
                        }`}
                        onClick={() => setLocale(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {(activeCategory === 'notifications' || searchQuery) && showDetachedAgentToasts && (
              <div data-section="notifications">
                <section data-section="native-agent-notifications" className="mb-8">
                  <h3 className="text-base font-semibold text-default">{t('settings.nativeAgentNotifications')}</h3>
                  <p className="mb-4 text-sm text-secondary">{t('settings.nativeAgentNotificationsDesc')}</p>
                  <div className="flex gap-3">
                    {([
                      { enabled: true, label: t('settings.notificationsEnabled') },
                      { enabled: false, label: t('settings.notificationsDisabled') },
                    ]).map(({ enabled, label }) => (
                      <button
                        key={label}
                        className={`rounded-lg border px-5 py-2 text-sm font-medium transition-colors ${
                          nativeAgentNotificationsEnabled === enabled
                            ? 'border-accent bg-accent text-on-accent'
                            : 'border-subtle text-secondary hover:border-default hover:text-default'
                        }`}
                        onClick={() => setNativeAgentNotificationsEnabled(enabled)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>

                <section data-section="agent-notification-sounds" className="mb-8">
                  <h3 className="text-base font-semibold text-default">{t('settings.agentNotificationSounds')}</h3>
                  <p className="mb-4 text-sm text-secondary">{t('settings.agentNotificationSoundsDesc')}</p>
                  <div className="flex gap-3">
                    {([
                      { enabled: true, label: t('settings.notificationsEnabled') },
                      { enabled: false, label: t('settings.notificationsDisabled') },
                    ]).map(({ enabled, label }) => (
                      <button
                        key={label}
                        className={`rounded-lg border px-5 py-2 text-sm font-medium transition-colors ${
                          agentNotificationSoundEnabled === enabled
                            ? 'border-accent bg-accent text-on-accent'
                            : 'border-subtle text-secondary hover:border-default hover:text-default'
                        }`}
                        onClick={() => setAgentNotificationSoundEnabled(enabled)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>

                <section data-section="detached-agent-toasts" className="mb-8">
                  <h3 className="text-base font-semibold text-default">{t('settings.detachedAgentToasts')}</h3>
                  <p className="mb-4 text-sm text-secondary">
                    {t('settings.detachedAgentToastsDesc')}
                  </p>
                  <div className="flex gap-3">
                    {([
                      { key: 'always' as const, label: t('settings.detachedAgentToastsAlways') },
                      { key: 'inactive-only' as const, label: t('settings.detachedAgentToastsInactiveOnly') },
                    ]).map(({ key, label }) => (
                      <button
                        key={key}
                        className={`rounded-lg border px-5 py-2 text-sm font-medium transition-colors ${
                          detachedAgentToastMode === key
                            ? 'border-accent bg-accent text-on-accent'
                            : 'border-subtle text-secondary hover:border-default hover:text-default'
                        }`}
                        onClick={() => setDetachedAgentToastMode(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {(activeCategory === 'sidebar' || searchQuery) && showSidebar && (
              <SidebarSettingsPanel />
            )}

            {(activeCategory === 'browser' || searchQuery) && showBrowser && (
              <BrowserSettingsPanel
                browser={browser}
                onUpdate={updateBrowserSettings}
              />
            )}

            {(activeCategory === 'narre' || searchQuery) && showNarre && (
              <NarreSettingsPanel open={open} t={t} />
            )}

            {searchQuery && !showAppearance && !showLanguage && !showDetachedAgentToasts && !showSidebar && !showBrowser && !showNarre && (
              <div className="flex flex-col items-center justify-center py-16 text-muted">
                <Search size={32} className="mb-3 opacity-40" />
                <p className="text-sm">{t('common.noResults')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
