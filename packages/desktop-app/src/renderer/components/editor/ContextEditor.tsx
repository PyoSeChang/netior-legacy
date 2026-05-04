import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { EditorTab } from '@netior/shared/types';
import { useContextStore } from '../../stores/context-store';
import { useEditorStore } from '../../stores/editor-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { useI18n } from '../../hooks/useI18n';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { Button } from '../ui/Button';
import { ScrollArea } from '../ui/ScrollArea';
import { Badge } from '../ui/Badge';
import { ContextMemberPicker } from './ContextMemberPicker';
import { useNetworkStore } from '../../stores/network-store';
import {
  NetworkObjectEditorShell,
  NetworkObjectEditorSection,
  NetworkObjectMetadataList,
} from './NetworkObjectEditorShell';

interface ContextEditorProps {
  tab: EditorTab;
}

interface ContextState {
  name: string;
  description: string;
}

export function ContextEditor({ tab }: ContextEditorProps): JSX.Element {
  const { t } = useI18n();
  const contextId = tab.targetId;
  const contexts = useContextStore((s) => s.contexts);
  const membersByContext = useContextStore((s) => s.membersByContext);
  const loadMembers = useContextStore((s) => s.loadMembers);
  const addMember = useContextStore((s) => s.addMember);
  const removeMember = useContextStore((s) => s.removeMember);
  const context = contexts.find((c) => c.id === contextId);
  const nodes = useNetworkStore((s) => s.nodes);
  const edges = useNetworkStore((s) => s.edges);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!contextId) return;
    loadMembers(contextId);
  }, [contextId, loadMembers]);

  const members = membersByContext[contextId] ?? [];

  const memberSummaries = useMemo(() => {
    return members.map((member) => {
      if (member.member_type === 'object') {
        const node = nodes.find((candidate) => candidate.object?.id === member.member_id);
        const label =
          node?.concept?.title ??
          node?.file?.path?.replace(/\\/g, '/').split('/').pop() ??
          node?.object?.object_type ??
          member.member_id;
        return {
          ...member,
          label,
          kind: node?.object?.object_type ?? 'object',
        };
      }

      const edge = edges.find((candidate) => candidate.id === member.member_id);
      const source = nodes.find((candidate) => candidate.id === edge?.source_node_id);
      const target = nodes.find((candidate) => candidate.id === edge?.target_node_id);
      const label = edge
        ? `${source?.concept?.title ?? source?.file?.path?.replace(/\\/g, '/').split('/').pop() ?? '?'} -> ${
            target?.concept?.title ?? target?.file?.path?.replace(/\\/g, '/').split('/').pop() ?? '?'
          }`
        : member.member_id;
      return {
        ...member,
        label,
        kind: 'edge',
      };
    });
  }, [edges, members, nodes]);

  const session = useEditorSession<ContextState>({
    tabId: tab.id,
    load: () => {
      const c = useContextStore.getState().contexts.find((ctx) => ctx.id === contextId);
      if (!c) return { name: '', description: '' };
      return { name: c.name, description: c.description ?? '' };
    },
    save: async (state) => {
      await useContextStore.getState().updateContext(contextId, {
        name: state.name,
        description: state.description || null,
      });
      useEditorStore.getState().updateTitle(tab.id, state.name);
    },
    deps: [contextId],
  });

  const handleDelete = useCallback(async () => {
    await useContextStore.getState().deleteContext(contextId);
    useEditorStore.getState().closeTab(tab.id);
  }, [contextId, tab.id]);

  const handleAddMember = useCallback(async (memberType: 'object' | 'edge', memberId: string) => {
    await addMember(contextId, memberType, memberId);
    setPickerOpen(false);
  }, [addMember, contextId]);

  const handleRemoveMember = useCallback(async (memberId: string) => {
    await removeMember(memberId);
  }, [removeMember]);

  if (!context) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        {t('context.notFound')}
      </div>
    );
  }

  if (session.isLoading) return <></>;

  return (
    <ScrollArea className="h-full">
      <NetworkObjectEditorShell
        badge={t('context.title')}
        title={session.state.name || context.name}
        subtitle={t('editorShell.networkObject' as never)}
        description={t('context.description')}
        actions={(
          <Button
            size="sm"
            variant="ghost"
            className="text-status-error hover:text-status-error"
            onClick={handleDelete}
          >
            {t('common.delete')}
          </Button>
        )}
      >
        <NetworkObjectEditorSection title={t('editorShell.overview' as never)}>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">{t('context.name')}</label>
            <Input
              value={session.state.name}
              onChange={(e) => session.setState((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">{t('context.description')}</label>
            <TextArea
              value={session.state.description}
              onChange={(e) => session.setState((prev) => ({ ...prev, description: e.target.value }))}
              rows={4}
            />
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection
          title={t('context.members')}
          actions={(
            <Button type="button" size="sm" variant="secondary" onClick={() => setPickerOpen(true)}>
              {t('context.addMember')}
            </Button>
          )}
        >
          <div className="rounded-lg border border-subtle bg-surface-editor">
            {memberSummaries.length > 0 ? (
              <div className="flex flex-col divide-y divide-subtle">
                {memberSummaries.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 px-3 py-2">
                    <Badge variant={member.member_type === 'edge' ? 'default' : 'accent'}>
                      {member.kind}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-sm text-default">{member.label}</span>
                    <button
                      type="button"
                      className="text-xs text-muted transition-colors hover:text-status-error"
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-3 py-4 text-xs text-muted">{t('context.noMembers')}</div>
            )}
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('editorShell.metadata' as never)} defaultOpen={false}>
          <NetworkObjectMetadataList
            items={[
              { label: t('editorShell.objectId' as never), value: <code className="font-mono text-xs">{context.id}</code> },
            ]}
          />
        </NetworkObjectEditorSection>
      </NetworkObjectEditorShell>
      {pickerOpen && (
        <ContextMemberPicker
          existingMembers={members}
          onSelect={handleAddMember}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </ScrollArea>
  );
}
