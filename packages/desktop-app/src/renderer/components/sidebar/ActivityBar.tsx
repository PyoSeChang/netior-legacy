import React, { useEffect, useMemo } from 'react';
import { useUIStore, type SidebarView } from '../../stores/ui-store';
import { useEditorStore } from '../../stores/editor-store';
import { useWorldStore } from '../../stores/world-store';
import { useActivityBarStore } from '../../stores/activity-bar-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useI18n } from '../../hooks/useI18n';
import { openBrowserTab } from '../../lib/open-browser-tab';
import { openTerminalTab } from '../../lib/terminal/open-terminal-tab';
import {
  ACTIVITY_BAR_BOTTOM_ITEM_DEFINITIONS,
  ACTIVITY_BAR_TOP_ITEM_DEFINITIONS,
} from '../../lib/activity-bar-items';
import {
  type ActivityBarBottomItemKey,
  type ActivityBarTopItemKey,
} from '../../lib/activity-bar-layout';
import { Tooltip } from '../ui/Tooltip';

export function ActivityBar(): JSX.Element {
  const { t } = useI18n();
  const {
    sidebarView,
    setSidebarView,
    sidebarOpen,
    toggleSidebar,
  } = useUIStore();
  const currentWorld = useWorldStore((state) => state.currentWorld);
  const ensureLoaded = useActivityBarStore((state) => state.ensureLoaded);
  const browserHomeUrl = useSettingsStore((state) => state.browser.homeUrl);
  const shellClassName = sidebarOpen
    ? 'rail-surface--open'
    : 'rail-surface--closed';

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  const handleSidebarViewClick = (key: SidebarView) => {
    if (sidebarOpen && sidebarView === key) {
      toggleSidebar();
    } else if (sidebarOpen) {
      setSidebarView(key);
    } else {
      setSidebarView(key);
      toggleSidebar();
    }
  };

  const topItemKeys = useMemo(() => {
    return currentWorld
      ? ([
          'worlds',
          'models',
          'files',
          'sessions',
        ] as const satisfies readonly ActivityBarTopItemKey[])
      : (['worlds'] as const satisfies readonly ActivityBarTopItemKey[]);
  }, [currentWorld]);

  const bottomItemKeys = useMemo(() => {
    return currentWorld
      ? (['narre', 'terminal', 'agents', 'browser', 'settings'] as const satisfies readonly ActivityBarBottomItemKey[])
      : (['agents', 'browser', 'settings'] as const satisfies readonly ActivityBarBottomItemKey[]);
  }, [currentWorld]);

  const handleBottomAction = (key: ActivityBarBottomItemKey) => {
    switch (key) {
      case 'narre':
        if (!currentWorld) return;
        void useEditorStore.getState().openTab({
          type: 'narre',
          targetId: currentWorld.id,
          title: t('narre.title'),
          rootNetworkId: currentWorld.id,
        });
        return;
      case 'terminal':
        openTerminalTab();
        return;
      case 'agents':
        void useEditorStore.getState().openTab({
          type: 'agent',
          targetId: currentWorld?.id ?? 'global',
          title: t('agentEditor.title' as never),
          rootNetworkId: currentWorld?.id,
        });
        return;
      case 'browser':
        void openBrowserTab(browserHomeUrl);
        return;
      case 'settings':
        useUIStore.getState().setShowSettings(true);
        return;
      default:
        return;
    }
  };

  return (
    <nav className={`rail-surface flex h-full w-10 shrink-0 flex-col items-center py-2 ${shellClassName}`}>
      <div className="flex flex-col items-center gap-1">
        {topItemKeys.map((key) => {
          const { icon: Icon, labelKey } = ACTIVITY_BAR_TOP_ITEM_DEFINITIONS[key];
          const isActive = sidebarOpen && sidebarView === key;

          return (
            <Tooltip key={key} content={t(labelKey)} position="right">
              <button
                className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
                  isActive
                    ? 'bg-state-selected text-accent'
                    : 'text-secondary hover:bg-state-hover hover:text-default'
                }`}
                onClick={() => handleSidebarViewClick(key)}
              >
                <Icon size={18} />
              </button>
            </Tooltip>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="flex flex-col items-center gap-1">
        <div className="mb-2 h-px w-5 bg-border-subtle opacity-50" />
        {bottomItemKeys.map((key) => {
          const { icon: Icon, labelKey } = ACTIVITY_BAR_BOTTOM_ITEM_DEFINITIONS[key];

          return (
            <Tooltip key={key} content={t(labelKey)} position="right">
              <button
                className="flex h-8 w-8 items-center justify-center rounded text-secondary transition-colors hover:bg-state-hover hover:text-default"
                onClick={() => handleBottomAction(key)}
              >
                <Icon size={18} />
              </button>
            </Tooltip>
          );
        })}
      </div>
    </nav>
  );
}
