import React, { useState, useCallback, useEffect } from 'react';
import type { EditorTab } from '@netior/shared/types';
import { NarreHome } from './narre/NarreHome';
import { NarreChat } from './narre/NarreChat';
import { AgentTeam } from './narre/AgentTeam';
import {
  getNarreWorldUiState,
  subscribeNarreWorldUiState,
  updateNarreWorldUiState,
} from '../../lib/narre-ui-state';

interface NarreEditorProps {
  tab: EditorTab;
}

// Persist view/session state across tab switches (component unmounts/remounts)
type NarreView = 'sessionList' | 'chat' | 'agentTeam';
const narreStateCache = new Map<string, { view: NarreView; sessionId: string | null; agentKey: string | null }>();

export function NarreEditor({ tab }: NarreEditorProps): JSX.Element {
  const rootNetworkId = tab.targetId;
  const persisted = getNarreWorldUiState(rootNetworkId);
  const cached = narreStateCache.get(rootNetworkId) ?? {
    view: persisted.view as NarreView,
    sessionId: persisted.activeSessionId,
    agentKey: persisted.activeAgentKey,
  };

  const [view, setView] = useState<NarreView>(cached?.view ?? 'sessionList');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(cached?.sessionId ?? null);
  const [activeAgentKey, setActiveAgentKey] = useState<string | null>(cached?.agentKey ?? null);

  const updateCache = (v: NarreView, sid: string | null, agentKey: string | null = activeAgentKey) => {
    narreStateCache.set(rootNetworkId, { view: v, sessionId: sid, agentKey });
    if (v === 'agentTeam') {
      return;
    }
    updateNarreWorldUiState(rootNetworkId, (prev) => ({
      ...prev,
      view: v,
      activeSessionId: sid,
      activeAgentKey: agentKey,
    }));
  };

  useEffect(() => {
    return subscribeNarreWorldUiState(rootNetworkId, (next) => {
      const nextView = next.view;
      narreStateCache.set(rootNetworkId, { view: nextView, sessionId: next.activeSessionId, agentKey: next.activeAgentKey });
      setView(nextView);
      setActiveSessionId(next.activeSessionId);
      setActiveAgentKey(next.activeAgentKey);
    });
  }, [rootNetworkId]);

  const handleSelectSession = useCallback((sessionId: string, agentKey?: string | null) => {
    setActiveSessionId(sessionId);
    setActiveAgentKey(agentKey ?? null);
    setView('chat');
    updateCache('chat', sessionId, agentKey ?? null);
  }, [rootNetworkId]);

  const handleNewChat = useCallback((agentKey: string) => {
    setActiveSessionId(null);
    setActiveAgentKey(agentKey);
    setView('chat');
    updateCache('chat', null, agentKey);
  }, [rootNetworkId]);

  const handleBackToList = useCallback(() => {
    setActiveSessionId(null);
    setActiveAgentKey(null);
    setView('sessionList');
    updateCache('sessionList', null, null);
  }, [rootNetworkId]);

  const handleStartAgentTeam = useCallback(() => {
    setActiveSessionId(null);
    setActiveAgentKey(null);
    setView('agentTeam');
    updateCache('agentTeam', null, null);
  }, [rootNetworkId]);

  const handleSessionCreated = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    updateCache('chat', sessionId);
  }, [rootNetworkId]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-editor">
      <div className={view === 'agentTeam' ? 'min-h-0 flex-1' : 'flex min-h-0 flex-1 flex-col'}>
        {view === 'agentTeam' ? (
          <AgentTeam rootNetworkId={rootNetworkId} onBackHome={handleBackToList} />
        ) : (
          <div className="flex h-full min-h-0 w-full flex-col">
            {view === 'sessionList' ? (
              <NarreHome
                rootNetworkId={rootNetworkId}
                onSelectSession={handleSelectSession}
                onNewChat={handleNewChat}
                onStartAgentTeam={handleStartAgentTeam}
              />
            ) : (
              <NarreChat
                sessionId={activeSessionId}
                rootNetworkId={rootNetworkId}
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
