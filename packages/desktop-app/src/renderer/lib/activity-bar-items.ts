import type { TranslationKey } from '@netior/shared/i18n';
import {
  Activity,
  Bot,
  Box,
  FolderTree,
  Globe2,
  Orbit,
  Settings,
  Sparkles,
  Terminal,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityBarBottomItemKey, ActivityBarTopItemKey } from './activity-bar-layout';

interface ActivityBarItemDefinition<K extends string> {
  key: K;
  icon: LucideIcon;
  labelKey: TranslationKey;
}

export const ACTIVITY_BAR_TOP_ITEM_DEFINITIONS: Record<
  ActivityBarTopItemKey,
  ActivityBarItemDefinition<ActivityBarTopItemKey>
> = {
  worlds: { key: 'worlds', icon: Orbit, labelKey: 'world.title' },
  models: { key: 'models', icon: Box, labelKey: 'sidebar.models' },
  files: { key: 'files', icon: FolderTree, labelKey: 'sidebar.files' },
  sessions: { key: 'sessions', icon: Activity, labelKey: 'sidebar.sessions' },
};

export const ACTIVITY_BAR_BOTTOM_ITEM_DEFINITIONS: Record<
  ActivityBarBottomItemKey,
  ActivityBarItemDefinition<ActivityBarBottomItemKey>
> = {
  narre: { key: 'narre', icon: Sparkles, labelKey: 'narre.title' },
  terminal: { key: 'terminal', icon: Terminal, labelKey: 'sidebar.terminal' },
  agents: { key: 'agents', icon: Bot, labelKey: 'sidebar.agents' },
  browser: { key: 'browser', icon: Globe2, labelKey: 'sidebar.browser' },
  settings: { key: 'settings', icon: Settings, labelKey: 'sidebar.settings' },
};
