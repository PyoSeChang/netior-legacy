import type {
  AgentDefinition,
  NarreMention,
  NarreSession,
  NarreSessionDetail,
  NarreStreamEvent,
  SkillDefinition,
  SupervisorAgentSessionSnapshot,
  SupervisorEvent,
  OrchestrationRun,
  OrchestrationTask,
  AgentAssignment,
  AgentEvent,
  AgentApprovalRequest,
  NarrePromptRuntimeOverride,
  NarrePromptRuntimeProvider,
  NarreRuntimeModelOption,
} from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export interface OrchestrationSnapshot {
  run: OrchestrationRun;
  conversation: unknown | null;
  tasks: OrchestrationTask[];
  assignments: AgentAssignment[];
  approvals: AgentApprovalRequest[];
  events: AgentEvent[];
}

export async function listSessions(rootNetworkId: string): Promise<NarreSession[]> {
  return unwrapIpc(await window.electron.narre.listSessions(rootNetworkId));
}

export async function listSkills(rootNetworkId: string): Promise<SkillDefinition[]> {
  return unwrapIpc(await window.electron.narre.listSkills(rootNetworkId));
}

export async function listSupervisorAgents(rootNetworkId?: string | null): Promise<AgentDefinition[]> {
  return unwrapIpc(await window.electron.narre.listSupervisorAgents(rootNetworkId));
}

export async function listSupervisorSkills(rootNetworkId: string): Promise<SkillDefinition[]> {
  return unwrapIpc(await window.electron.narre.listSupervisorSkills(rootNetworkId));
}

export async function listSupervisorSessions(): Promise<SupervisorAgentSessionSnapshot[]> {
  return unwrapIpc(await window.electron.narre.listSupervisorSessions());
}

export async function listSupervisorEvents(afterSeq?: number | null): Promise<SupervisorEvent[]> {
  return unwrapIpc(await window.electron.narre.listSupervisorEvents(afterSeq));
}

export async function listSupervisorRuns(rootNetworkId?: string | null): Promise<OrchestrationRun[]> {
  return unwrapIpc(await window.electron.narre.listSupervisorRuns(rootNetworkId));
}

export async function createSupervisorRun(data: {
  rootNetworkId: string;
  userRequest: string;
  mode?: string;
}): Promise<OrchestrationSnapshot> {
  return unwrapIpc(await window.electron.narre.createSupervisorRun(data));
}

export async function getSupervisorRun(runId: string): Promise<OrchestrationSnapshot> {
  return unwrapIpc(await window.electron.narre.getSupervisorRun(runId));
}

export async function planSupervisorRun(runId: string): Promise<OrchestrationSnapshot> {
  return unwrapIpc(await window.electron.narre.planSupervisorRun(runId));
}

export async function runSupervisorRun(runId: string): Promise<OrchestrationSnapshot> {
  return unwrapIpc(await window.electron.narre.runSupervisorRun(runId));
}

export async function cancelSupervisorRun(runId: string): Promise<OrchestrationSnapshot> {
  return unwrapIpc(await window.electron.narre.cancelSupervisorRun(runId));
}

export async function listSupervisorApprovals(runId: string): Promise<AgentApprovalRequest[]> {
  return unwrapIpc(await window.electron.narre.listSupervisorApprovals(runId));
}

export async function resolveSupervisorApproval(data: {
  approvalId: string;
  status: 'approved' | 'rejected' | 'cancelled';
  response?: string | null;
}): Promise<AgentApprovalRequest> {
  return unwrapIpc(await window.electron.narre.resolveSupervisorApproval(data));
}

export async function createSession(rootNetworkId: string, options?: { agentKey?: string | null }): Promise<NarreSession> {
  return unwrapIpc(await window.electron.narre.createSession({
    rootNetworkId,
    agentKey: options?.agentKey ?? null,
  }));
}

export async function getSession(sessionId: string): Promise<NarreSessionDetail> {
  return unwrapIpc(await window.electron.narre.getSession(sessionId));
}

export async function updateSessionTitle(rootNetworkId: string, sessionId: string, title: string): Promise<NarreSession> {
  return unwrapIpc(await window.electron.narre.updateSessionTitle({ rootNetworkId, sessionId, title }));
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  return unwrapIpc(await window.electron.narre.deleteSession(sessionId));
}

export async function getApiKeyStatus(): Promise<boolean> {
  return unwrapIpc(await window.electron.narre.getApiKeyStatus());
}

export async function setApiKey(key: string): Promise<boolean> {
  return unwrapIpc(await window.electron.narre.setApiKey(key));
}

export interface MentionResult {
  type: string;
  id: string;
  display: string;
  color?: string | null;
  icon?: string | null;
  description?: string | null;
  meta?: Record<string, unknown>;
}

export async function searchMentions(rootNetworkId: string, query: string): Promise<MentionResult[]> {
  return unwrapIpc(await window.electron.narre.searchMentions(rootNetworkId, query));
}

export async function listRuntimeModels(provider: NarrePromptRuntimeProvider): Promise<NarreRuntimeModelOption[]> {
  return unwrapIpc(await window.electron.narre.listRuntimeModels(provider));
}

export async function sendMessage(data: {
  sessionId?: string;
  rootNetworkId: string;
  message: string;
  mentions?: NarreMention[];
  skillIds?: string[];
  runtimeOverride?: NarrePromptRuntimeOverride;
}): Promise<void> {
  // Fire-and-forget: streaming events come via onStreamEvent
  unwrapIpc(await window.electron.narre.sendMessage(data as Record<string, unknown>));
}

export function onStreamEvent(callback: (event: NarreStreamEvent) => void): () => void {
  return window.electron.narre.onStreamEvent((event) => callback(event as NarreStreamEvent));
}

export async function respondToCard(
  sessionId: string,
  toolCallId: string,
  response: unknown,
): Promise<void> {
  unwrapIpc(await window.electron.narre.respondToCard({ sessionId, toolCallId, response }));
}

export async function interruptMessage(sessionId: string): Promise<boolean> {
  return unwrapIpc(await window.electron.narre.interruptMessage({ sessionId }));
}

export async function steerMessage(sessionId: string, message: string): Promise<boolean> {
  return unwrapIpc(await window.electron.narre.steerMessage({ sessionId, message }));
}

export const narreService = {
  listSessions,
  listSkills,
  listSupervisorAgents,
  listSupervisorSkills,
  listSupervisorSessions,
  listSupervisorEvents,
  listSupervisorRuns,
  createSupervisorRun,
  getSupervisorRun,
  planSupervisorRun,
  runSupervisorRun,
  cancelSupervisorRun,
  listSupervisorApprovals,
  resolveSupervisorApproval,
  createSession,
  getSession,
  updateSessionTitle,
  deleteSession,
  getApiKeyStatus,
  setApiKey,
  searchMentions,
  listRuntimeModels,
  sendMessage,
  onStreamEvent,
  respondToCard,
  interruptMessage,
  steerMessage,
};
