import React, { useState, useCallback, useEffect } from 'react';
import type { EditorTab } from '@netior/shared/types';
import { NarreHome } from './narre/NarreHome';
import { NarreChat } from './narre/NarreChat';
import { AgentTeam } from './narre/AgentTeam';
import {
  getNarreProjectUiState,
  subscribeNarreProjectUiState,
  updateNarreProjectUiState,
} from '../../lib/narre-ui-state';

interface NarreEditorProps {
  tab: EditorTab;
}

// Persist view/session state across tab switches (component unmounts/remounts)
type NarreView = 'sessionList' | 'chat' | 'agentTeam';
const narreStateCache = new Map<string, { view: NarreView; sessionId: string | null; agentKey: string | null }>();

export function NarreEditor({ tab }: NarreEditorProps): JSX.Element {
  const projectId = tab.targetId;
  const persisted = getNarreProjectUiState(projectId);
  const cached = narreStateCache.get(projectId) ?? {
    view: persisted.view as NarreView,
    sessionId: persisted.activeSessionId,
    agentKey: null,
  };

  const [view, setView] = useState<NarreView>(cached?.view ?? 'sessionList');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(cached?.sessionId ?? null);
  const [activeAgentKey, setActiveAgentKey] = useState<string | null>(cached?.agentKey ?? null);

  const updateCache = (v: NarreView, sid: string | null, agentKey: string | null = activeAgentKey) => {
    narreStateCache.set(projectId, { view: v, sessionId: sid, agentKey });
    if (v === 'agentTeam') {
      return;
    }
    updateNarreProjectUiState(projectId, (prev) => ({
      ...prev,
      view: v,
      activeSessionId: sid,
    }));
  };

  useEffect(() => {
    return subscribeNarreProjectUiState(projectId, (next) => {
      const nextView = next.view;
      const cachedAgentKey = narreStateCache.get(projectId)?.agentKey ?? null;
      narreStateCache.set(projectId, { view: nextView, sessionId: next.activeSessionId, agentKey: cachedAgentKey });
      setView(nextView);
      setActiveSessionId(next.activeSessionId);
      setActiveAgentKey(cachedAgentKey);
    });
  }, [projectId]);

  const handleSelectSession = useCallback((sessionId: string, agentKey?: string | null) => {
    setActiveSessionId(sessionId);
    setActiveAgentKey(agentKey ?? null);
    setView('chat');
    updateCache('chat', sessionId, agentKey ?? null);
  }, [projectId]);

  const handleNewChat = useCallback((agentKey: string) => {
    setActiveSessionId(null);
    setActiveAgentKey(agentKey);
    setView('chat');
    updateCache('chat', null, agentKey);
  }, [projectId]);

  const handleBackToList = useCallback(() => {
    setActiveSessionId(null);
    setActiveAgentKey(null);
    setView('sessionList');
    updateCache('sessionList', null, null);
  }, [projectId]);

  const handleStartAgentTeam = useCallback(() => {
    setActiveSessionId(null);
    setActiveAgentKey(null);
    setView('agentTeam');
    updateCache('agentTeam', null, null);
  }, [projectId]);

  const handleSessionCreated = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    updateCache('chat', sessionId);
  }, [projectId]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-editor">
      <div className={view === 'agentTeam' ? 'min-h-0 flex-1' : 'flex min-h-0 flex-1 flex-col'}>
        {view === 'agentTeam' ? (
          <AgentTeam projectId={projectId} onBackHome={handleBackToList} />
        ) : (
          <div className="flex h-full min-h-0 w-full flex-col">
            {view === 'sessionList' ? (
              <NarreHome
                projectId={projectId}
                onSelectSession={handleSelectSession}
                onNewChat={handleNewChat}
                onStartAgentTeam={handleStartAgentTeam}
              />
            ) : (
              <NarreChat
                sessionId={activeSessionId}
                projectId={projectId}
                agentKey={activeAgentKey}
                onBackToList={handleBackToList}
                onSessionCreated={handleSessionCreated}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
