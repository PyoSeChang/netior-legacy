import type { EditorTabType, SplitDirection, TerminalLaunchConfig } from '@netior/shared/types';

export type { EditorTabType, SplitDirection, TerminalLaunchConfig };

export type EditorViewMode = 'side' | 'full' | 'float' | 'detached';

export interface FloatRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditorTab {
  id: string;
  type: EditorTabType;
  targetId: string;
  title: string;
  rootNetworkId?: string;
  nodeId?: string;
  hostId: string;
  viewMode: EditorViewMode;
  floatRect: FloatRect;
  isMinimized: boolean;
  sideSplitRatio: number;
  isDirty: boolean;
  isStale?: boolean;
  isManuallyRenamed?: boolean;
  activeFilePath: string | null;
  draftData?: unknown;
  terminalCwd?: string;
  terminalLaunchConfig?: Pick<TerminalLaunchConfig, 'shell' | 'args' | 'agent'>;
  browserFaviconUrl?: string | null;
  browserUrl?: string;
  objectViewMode?: string;
  editorType?: string;
}

export interface SplitLeaf {
  type: 'leaf';
  tabIds: string[];
  activeTabId: string;
}

export interface SplitBranch {
  type: 'branch';
  direction: SplitDirection;
  ratio: number;
  children: [SplitNode, SplitNode];
}

export type SplitNode = SplitLeaf | SplitBranch;
