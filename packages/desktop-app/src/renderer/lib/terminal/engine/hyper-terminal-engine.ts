import type {
  TerminalEngine,
  TerminalEngineInstance,
  TerminalEngineLaunchConfig,
} from './terminal-engine';
import { HyperTerminalSurface } from '../hyper-fork/hyper-terminal-surface';

class HyperTerminalEngine implements TerminalEngine {
  readonly kind = 'hyper' as const;

  private readonly terminals = new Map<string, Promise<HyperTerminalSurface>>();

  async getOrCreateTerminal(
    sessionId: string,
    cwd: string,
    title: string,
    launchConfig?: TerminalEngineLaunchConfig,
  ): Promise<TerminalEngineInstance> {
    const existing = this.terminals.get(sessionId);
    if (existing) {
      return existing;
    }

    const instance = new HyperTerminalSurface(
      sessionId,
      cwd,
      title,
      launchConfig,
      () => {
        this.terminals.delete(sessionId);
      },
    );

    const pending = (async () => {
      try {
        await instance.start();
        return instance;
      } catch (error) {
        instance.dispose();
        this.terminals.delete(sessionId);
        throw error;
      }
    })();

    this.terminals.set(sessionId, pending);
    return pending;
  }
}

let engineSingleton: HyperTerminalEngine | null = null;

export function getHyperTerminalEngine(): TerminalEngine {
  engineSingleton ??= new HyperTerminalEngine();
  return engineSingleton;
}
