import { useEditorStore, MAIN_HOST_ID } from '../../stores/editor-store';
import { useWorldStore } from '../../stores/world-store';
import type { TerminalLaunchConfig } from '@netior/shared/types';
import { getWorldRootDir } from '../../utils/world-utils';

const DEFAULT_CODEX_SESSION_NAME = 'codex';

function resolveTerminalCwd(): string | undefined {
  return getWorldRootDir(useWorldStore.getState().currentWorld) || undefined;
}

interface OpenTerminalTabOptions {
  terminalCwd?: string;
  terminalLaunchConfig?: Pick<TerminalLaunchConfig, 'shell' | 'args' | 'agent'>;
}

export function openTerminalTab(
  hostId = MAIN_HOST_ID,
  title = 'Terminal',
  options: OpenTerminalTabOptions = {},
): void {
  const sessionId = `term-${Date.now()}`;
  const currentWorld = useWorldStore.getState().currentWorld;
  const terminalCwd = options.terminalCwd ?? (getWorldRootDir(currentWorld) || resolveTerminalCwd());

  void useEditorStore.getState().openTab({
    type: 'terminal',
    targetId: sessionId,
    title,
    rootNetworkId: currentWorld?.id,
    hostId,
    terminalCwd,
    terminalLaunchConfig: options.terminalLaunchConfig,
  });
}

export function openCodexTab(hostId = MAIN_HOST_ID): void {
  openTerminalTab(hostId, DEFAULT_CODEX_SESSION_NAME, {
    terminalLaunchConfig: {
      shell: 'codex',
      args: ['--no-alt-screen'],
      agent: {
        provider: 'codex',
      },
    },
  });
}

export function getDefaultTerminalCwd(): string | undefined {
  return resolveTerminalCwd();
}
