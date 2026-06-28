import React from 'react';
import { Check, ExternalLink, Maximize2, Maximize, Minus, MoreVertical, PanelRight } from 'lucide-react';
import type { EditorViewMode } from '../../types/editor';
import type { TranslationKey } from '@netior/shared/i18n';
import { useI18n } from '../../hooks/useI18n';
import { Tooltip } from '../ui/Tooltip';
import { useEditorStore, MAIN_HOST_ID } from '../../stores/editor-store';
import { ContextMenu } from '../ui/ContextMenu';
import type { ContextMenuEntry } from '../ui/ContextMenu';

interface EditorViewModeSwitchProps {
  currentMode: EditorViewMode;
  onModeChange: (mode: EditorViewMode) => void;
  onMinimize?: () => void;
  availableModes?: EditorViewMode[];
}

interface ModeButtonConfig {
  mode: EditorViewMode;
  icon: typeof Maximize2;
  titleKey: TranslationKey;
  isActive: boolean;
}

const MODE_MENU_CONFIG: Record<EditorViewMode, Omit<ModeButtonConfig, 'isActive'>> = {
  side: { mode: 'side', icon: PanelRight, titleKey: 'editor.modeSide' },
  full: { mode: 'full', icon: Maximize, titleKey: 'editor.modeFull' },
  float: { mode: 'float', icon: Maximize2, titleKey: 'editor.modeFloat' },
  detached: { mode: 'detached', icon: ExternalLink, titleKey: 'editor.modeDetached' },
};

export function EditorViewModeSwitch({
  currentMode,
  onModeChange,
  onMinimize,
  availableModes = ['side', 'full', 'float', 'detached'],
}: EditorViewModeSwitchProps): JSX.Element {
  const { t } = useI18n();
  const preferredDockMode = useEditorStore((s) => {
    const mainTabs = s.tabs.filter((tab) => tab.hostId === MAIN_HOST_ID);
    const hasFull = mainTabs.some((tab) => tab.viewMode === 'full' && !tab.isMinimized);
    return hasFull ? 'full' : 'side';
  });

  const canUseSide = availableModes.includes('side');
  const canUseFull = availableModes.includes('full');
  const canUseFloat = availableModes.includes('float');
  const canUseDetached = availableModes.includes('detached');

  const layoutToggle: { mode: 'side' | 'full'; icon: typeof Maximize; titleKey: TranslationKey } | null =
    canUseSide && canUseFull
      ? (
        currentMode === 'full'
          ? { mode: 'side', icon: PanelRight, titleKey: 'editor.modeSide' }
          : currentMode === 'side'
            ? { mode: 'full', icon: Maximize, titleKey: 'editor.modeFull' }
            : preferredDockMode === 'full'
              ? { mode: 'full', icon: Maximize, titleKey: 'editor.modeFull' }
              : { mode: 'side', icon: PanelRight, titleKey: 'editor.modeSide' }
      )
      : null;

  const tabModeButtons: ModeButtonConfig[] = [];
  if (canUseFloat) {
    tabModeButtons.push({ mode: 'float', icon: Maximize2, titleKey: 'editor.modeFloat', isActive: currentMode === 'float' });
  }
  if (canUseDetached) {
    tabModeButtons.push({ mode: 'detached', icon: ExternalLink, titleKey: 'editor.modeDetached', isActive: currentMode === 'detached' });
  }
  const layoutButton: ModeButtonConfig | null = layoutToggle
    ? { ...layoutToggle, isActive: currentMode === 'side' || currentMode === 'full' }
    : null;

  const renderButton = ({ mode, icon: Icon, titleKey, isActive }: ModeButtonConfig, key: string) => (
    <Tooltip key={key} content={t(titleKey)} position="bottom">
      <button
        className={`rounded p-1 transition-colors ${
          isActive
            ? 'bg-accent text-on-accent'
            : 'text-muted hover:bg-state-hover hover:text-default'
        }`}
        onClick={() => onModeChange(mode)}
      >
        <Icon size={14} />
      </button>
    </Tooltip>
  );

  return (
    <div className="flex items-center gap-0.5">
      {tabModeButtons.map((button) => renderButton(button, `tab:${button.mode}`))}
      {onMinimize && (
        <Tooltip content={t('common.minimizeTab')} position="bottom">
          <button
            className="rounded p-1 text-muted transition-colors hover:bg-state-hover hover:text-default"
            onClick={onMinimize}
          >
            <Minus size={14} />
          </button>
        </Tooltip>
      )}
      {layoutButton && renderButton(layoutButton, `layout:${layoutButton.mode}`)}
    </div>
  );
}

export function EditorViewModeMenu({
  currentMode,
  onModeChange,
  onMinimize,
  availableModes = ['side', 'full', 'float', 'detached'],
}: EditorViewModeSwitchProps): JSX.Element {
  const { t, locale } = useI18n();
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = React.useState<{ x: number; y: number } | null>(null);
  const menuLabelKey = 'editor.windowOptions' as TranslationKey;
  const translatedMenuLabel = t(menuLabelKey);
  const menuLabel = translatedMenuLabel === menuLabelKey
    ? (locale === 'ko' ? '李??듭뀡' : 'Window Options')
    : translatedMenuLabel;

  const menuItems: ContextMenuEntry[] = availableModes.map((mode) => {
    const config = MODE_MENU_CONFIG[mode];
    const Icon = currentMode === mode ? Check : config.icon;
    return {
      label: t(config.titleKey),
      icon: <Icon size={14} />,
      onClick: () => onModeChange(mode),
    };
  });

  if (onMinimize) {
    menuItems.push(
      { type: 'divider' },
      {
        label: t('common.minimizeTab'),
        icon: <Minus size={14} />,
        onClick: onMinimize,
      },
    );
  }

  const openMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPosition({ x: rect.left, y: rect.bottom + 4 });
  };

  return (
    <>
      <Tooltip content={menuLabel} position="bottom">
        <button
          ref={buttonRef}
          aria-label={menuLabel}
          className={`flex h-6 w-6 items-center justify-center rounded text-muted transition-colors ${
            menuPosition ? 'bg-state-hover text-default' : 'hover:bg-state-hover hover:text-default'
          }`}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={openMenu}
        >
          <MoreVertical size={15} />
        </button>
      </Tooltip>
      {menuPosition && (
        <ContextMenu
          x={menuPosition.x}
          y={menuPosition.y}
          items={menuItems}
          onClose={() => setMenuPosition(null)}
        />
      )}
    </>
  );
}
