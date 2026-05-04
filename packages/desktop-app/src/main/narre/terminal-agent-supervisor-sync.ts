import type {
  AgentProvider,
  AgentSessionSnapshot,
  Project,
  SupervisorSessionReport,
  TerminalAgentDefinition,
} from '@netior/shared/types';
import { listRemoteProjects } from '../netior-service/netior-service-client';
import { syncNarreServerWithSettings } from './narre-config';
import { getNarreServerBaseUrl } from '../process/narre-server-manager';

const SUPERVISOR_REPORT_PATH = '/supervisor/sessions/report';
const PROJECT_CACHE_TTL_MS = 10_000;
const SERVER_START_RETRY_MS = 5_000;

export interface TerminalSupervisorContext {
  cwd?: string | null;
  launchTitle?: string | null;
}

type TerminalMirrorProvider = Exclude<AgentProvider, 'narre'>;
type TerminalAgentSessionSnapshot = AgentSessionSnapshot & { provider: TerminalMirrorProvider };

export class TerminalAgentSupervisorSync {
  private readonly projectIdByRootDir = new Map<string, string>();
  private readonly reportSignatures = new Map<string, string>();
  private ensureServerPromise: Promise<string | null> | null = null;
  private lastProjectCacheAt = 0;
  private lastEnsureServerAttemptAt = 0;
  private lastWarningMessage: string | null = null;

  syncSnapshot(snapshot: AgentSessionSnapshot, context?: TerminalSupervisorContext): void {
    if (!isTerminalMirrorSnapshot(snapshot)) {
      return;
    }

    void this.reportSnapshot(snapshot, context, snapshot.status);
  }

  reportStopped(snapshot: AgentSessionSnapshot, context?: TerminalSupervisorContext): void {
    if (!isTerminalMirrorSnapshot(snapshot)) {
      return;
    }

    void this.reportSnapshot(snapshot, context, 'offline');
  }

  private async reportSnapshot(
    snapshot: TerminalAgentSessionSnapshot,
    context: TerminalSupervisorContext | undefined,
    status: AgentSessionSnapshot['status'],
  ): Promise<void> {
    const baseUrl = await this.ensureNarreServerBaseUrl();
    if (!baseUrl) {
      return;
    }

    const report = await this.buildReport(snapshot, context, status);
    const signature = JSON.stringify(report);
    if (this.reportSignatures.get(report.sessionId) === signature) {
      return;
    }

    try {
      const response = await fetch(`${baseUrl}${SUPERVISOR_REPORT_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report),
      });

      if (!response.ok) {
        throw new Error(`supervisor report failed: ${response.status}`);
      }

      this.reportSignatures.set(report.sessionId, signature);
    } catch (error) {
      this.warnOnce(`failed to mirror terminal agent session: ${(error as Error).message}`);
    }
  }

  private async buildReport(
    snapshot: TerminalAgentSessionSnapshot,
    context: TerminalSupervisorContext | undefined,
    status: AgentSessionSnapshot['status'],
  ): Promise<SupervisorSessionReport> {
    const cwd = context?.cwd?.trim() || null;
    const projectId = await this.resolveProjectId(cwd);

    return {
      sessionId: buildTerminalSupervisorSessionId(snapshot.provider, snapshot.sessionId),
      agent: createTerminalAgentDefinition(snapshot.provider),
      surface: snapshot.surface,
      externalSessionId: snapshot.externalSessionId,
      ...(projectId ? { projectId } : {}),
      title: resolveTerminalSessionTitle(snapshot, context),
      status,
      reason: snapshot.reason,
      metadata: {
        runtime: 'desktop-terminal',
        provider: snapshot.provider,
        terminalSessionId: snapshot.sessionId,
        turnState: snapshot.turnState,
        ...(cwd ? { cwd } : {}),
      },
    };
  }

  private async ensureNarreServerBaseUrl(): Promise<string | null> {
    const existingBaseUrl = getNarreServerBaseUrl();
    if (existingBaseUrl) {
      return existingBaseUrl;
    }

    if (this.ensureServerPromise) {
      return this.ensureServerPromise;
    }

    const now = Date.now();
    if (now - this.lastEnsureServerAttemptAt < SERVER_START_RETRY_MS) {
      return null;
    }

    this.lastEnsureServerAttemptAt = now;
    this.ensureServerPromise = (async () => {
      try {
        const started = await syncNarreServerWithSettings();
        if (!started) {
          return null;
        }
        return getNarreServerBaseUrl();
      } catch (error) {
        this.warnOnce(`failed to start narre-server for terminal mirror: ${(error as Error).message}`);
        return null;
      } finally {
        this.ensureServerPromise = null;
      }
    })();

    return this.ensureServerPromise;
  }

  private async resolveProjectId(cwd: string | null): Promise<string | null> {
    if (!cwd) {
      return null;
    }

    const normalizedCwd = normalizePathKey(cwd);
    if (!normalizedCwd) {
      return null;
    }

    const cached = this.findProjectIdForPath(normalizedCwd);
    if (cached) {
      return cached;
    }

    await this.refreshProjectCache();
    return this.findProjectIdForPath(normalizedCwd);
  }

  private findProjectIdForPath(normalizedPath: string): string | null {
    let bestMatch: { rootDir: string; projectId: string } | null = null;

    for (const [rootDir, projectId] of this.projectIdByRootDir) {
      if (!isSameOrChildPath(normalizedPath, rootDir)) {
        continue;
      }

      if (!bestMatch || rootDir.length > bestMatch.rootDir.length) {
        bestMatch = { rootDir, projectId };
      }
    }

    return bestMatch?.projectId ?? null;
  }

  private async refreshProjectCache(): Promise<void> {
    if (Date.now() - this.lastProjectCacheAt < PROJECT_CACHE_TTL_MS) {
      return;
    }

    try {
      const projects = await listRemoteProjects();
      this.projectIdByRootDir.clear();
      for (const project of projects) {
        this.addProjectRoot(project);
      }
      this.lastProjectCacheAt = Date.now();
    } catch (error) {
      this.warnOnce(`failed to resolve project id for terminal mirror: ${(error as Error).message}`);
    }
  }

  private addProjectRoot(project: Project): void {
    const normalizedRootDir = normalizePathKey(project.root_dir);
    if (!normalizedRootDir) {
      return;
    }
    this.projectIdByRootDir.set(normalizedRootDir, project.id);
  }

  private warnOnce(message: string): void {
    if (this.lastWarningMessage === message) {
      return;
    }
    this.lastWarningMessage = message;
    console.warn(`[terminal-mirror] ${message}`);
  }
}

function isTerminalMirrorSnapshot(
  snapshot: AgentSessionSnapshot,
): snapshot is TerminalAgentSessionSnapshot {
  return snapshot.provider === 'claude' || snapshot.provider === 'codex';
}

function createTerminalAgentDefinition(provider: TerminalMirrorProvider): TerminalAgentDefinition {
  if (provider === 'codex') {
    return {
      id: 'codex-cli',
      name: 'Codex CLI',
      description: 'Terminal runtime session for Codex CLI.',
      kind: 'terminal',
      terminalAgentType: 'codex-cli',
    };
  }

  return {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Terminal runtime session for Claude Code.',
    kind: 'terminal',
    terminalAgentType: 'claude-code',
  };
}

function buildTerminalSupervisorSessionId(provider: TerminalMirrorProvider, sessionId: string): string {
  return `terminal:${provider}:${sessionId}`;
}

function resolveTerminalSessionTitle(
  snapshot: AgentSessionSnapshot,
  context: TerminalSupervisorContext | undefined,
): string {
  const explicitName = snapshot.name?.trim();
  if (explicitName) {
    return explicitName;
  }

  const launchTitle = context?.launchTitle?.trim();
  if (launchTitle) {
    return launchTitle;
  }

  return snapshot.provider === 'codex' ? 'Codex CLI' : 'Claude Code';
}

function normalizePathKey(value: string): string {
  return value
    .trim()
    .replace(/[\\/]+/g, '/')
    .replace(/\/+$/g, '')
    .toLowerCase();
}

function isSameOrChildPath(candidate: string, rootDir: string): boolean {
  return candidate === rootDir || candidate.startsWith(`${rootDir}/`);
}

export const terminalAgentSupervisorSync = new TerminalAgentSupervisorSync();
