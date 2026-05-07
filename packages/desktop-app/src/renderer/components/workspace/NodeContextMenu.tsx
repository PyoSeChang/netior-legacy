import React, { useCallback } from 'react';
import { ExternalLink, FileText, Link, Plus, Trash2, Unlink2 } from 'lucide-react';
import { useNetworkStore } from '../../stores/network-store';
import { useEditorStore } from '../../stores/editor-store';
import { useProjectStore } from '../../stores/project-store';
import { useI18n } from '../../hooks/useI18n';
import type { NetworkObjectType } from '@netior/shared/types';
import type { WorkspaceMode } from '../../stores/ui-store';
import { WorkspaceContextMenuSurface } from './WorkspaceContextMenuSurface';

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  objectType?: NetworkObjectType;
  objectTargetId?: string;
  objectTitle?: string;
  instanceId?: string;
  fileId?: string;
  filePath?: string;
  networkId?: string;
  mode: WorkspaceMode;
  onAddConnection?: (nodeId: string) => void;
  onOpenNetwork?: (networkId: string) => void;
  onCreateNetwork?: (instanceId: string) => void;
  onAttachNetwork?: (nodeId: string) => void;
  onExcludeNode?: (nodeId: string) => void;
  onDeleteObject?: (nodeId: string, objectType: NetworkObjectType, objectTargetId: string, objectTitle?: string) => void;
  onClose: () => void;
}

export function NodeContextMenu({
  x,
  y,
  nodeId,
  objectType,
  objectTargetId,
  objectTitle,
  instanceId,
  fileId,
  filePath,
  networkId,
  mode,
  onAddConnection,
  onOpenNetwork,
  onCreateNetwork,
  onAttachNetwork,
  onExcludeNode,
  onDeleteObject,
  onClose,
}: NodeContextMenuProps): JSX.Element {
  const { t } = useI18n();
  const { currentNetwork } = useNetworkStore();
  const openProject = useProjectStore((state) => state.openProject);
  const deleteProject = useProjectStore((state) => state.deleteProject);

  const openObjectEditor = useCallback(() => {
    if (!objectType || !objectTargetId) return;

    if (objectType === 'network') {
      useEditorStore.getState().openTab({
        type: 'network',
        targetId: objectTargetId,
        title: objectTitle ?? t('network.name' as never),
        projectId: currentNetwork?.project_id ?? undefined,
      });
    } else if (objectType === 'project') {
      useEditorStore.getState().openTab({
        type: 'project',
        targetId: objectTargetId,
        title: objectTitle ?? t('project.name'),
      });
    } else if (objectType === 'instance') {
      useEditorStore.getState().openTab({
        type: 'instance',
        targetId: objectTargetId,
        title: objectTitle ?? t('instance.title'),
        networkId: currentNetwork?.id,
        nodeId,
      });
    } else if (objectType === 'model') {
      useEditorStore.getState().openTab({
        type: 'model',
        targetId: objectTargetId,
        title: objectTitle ?? t('model.title'),
      });
    } else if (objectType === 'schema') {
      useEditorStore.getState().openTab({
        type: 'schema',
        targetId: objectTargetId,
        title: objectTitle ?? t('schema.title'),
        projectId: currentNetwork?.project_id ?? undefined,
      });
    } else if (objectType === 'context') {
      useEditorStore.getState().openTab({
        type: 'context',
        targetId: objectTargetId,
        title: objectTitle ?? t('context.title' as never),
      });
    } else if (objectType === 'file' && filePath) {
      useEditorStore.getState().openTab({
        type: 'file',
        targetId: filePath,
        title: objectTitle ?? filePath.replace(/\\/g, '/').split('/').pop() ?? 'File',
      });
    }
    onClose();
  }, [currentNetwork?.id, filePath, nodeId, objectTargetId, objectTitle, objectType, onClose, t]);

  const canOpenEditor =
    !!objectType &&
    !!objectTargetId &&
    ['network', 'project', 'instance', 'schema', 'model', 'context', 'file'].includes(objectType);
  const canDeleteObject =
    !!objectType &&
    !!objectTargetId &&
    ['instance', 'schema', 'model'].includes(objectType);

  const handleOpenNetwork = useCallback(() => {
    if (networkId) onOpenNetwork?.(networkId);
    onClose();
  }, [onOpenNetwork, networkId, onClose]);

  const handleOpenProject = useCallback(() => {
    if (objectType !== 'project' || !objectTargetId) return;
    const project = useProjectStore.getState().projects.find((item) => item.id === objectTargetId);
    if (project) {
      void openProject(project);
    }
    onClose();
  }, [objectTargetId, objectType, onClose, openProject]);

  const handleCreateNetwork = useCallback(() => {
    if (instanceId) onCreateNetwork?.(instanceId);
    onClose();
  }, [onCreateNetwork, instanceId, onClose]);

  const handleAttachNetwork = useCallback(() => {
    onAttachNetwork?.(nodeId);
    onClose();
  }, [nodeId, onAttachNetwork, onClose]);

  const handleAddConnection = useCallback(() => {
    onAddConnection?.(nodeId);
    onClose();
  }, [onAddConnection, nodeId, onClose]);

  const handleExclude = useCallback(async () => {
    const isUniverseProjectNode =
      objectType === 'project'
      && !!objectTargetId
      && currentNetwork?.kind === 'universe'
      && currentNetwork.parent_network_id === null;

    if (isUniverseProjectNode) {
      await deleteProject(objectTargetId);
      if (currentNetwork) {
        await useNetworkStore.getState().openNetwork(currentNetwork.id);
      }
      onClose();
      return;
    }

    onExcludeNode?.(nodeId);
    onClose();
  }, [currentNetwork?.kind, currentNetwork?.parent_network_id, deleteProject, nodeId, objectTargetId, objectType, onClose, onExcludeNode]);

  const handleDeleteObject = useCallback(() => {
    if (!canDeleteObject || !objectType || !objectTargetId) return;
    onDeleteObject?.(nodeId, objectType, objectTargetId, objectTitle);
    onClose();
  }, [canDeleteObject, nodeId, objectTargetId, objectTitle, objectType, onClose, onDeleteObject]);

  return (
    <WorkspaceContextMenuSurface x={x} y={y} onClose={onClose}>
      {/* Portal: open network */}
      {networkId && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-state-hover cursor-pointer"
          onClick={handleOpenNetwork}
        >
          <ExternalLink size={14} />
          {t('network.openSubNetwork')}
        </button>
      )}

      {objectType === 'project' && objectTargetId && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-state-hover cursor-pointer"
          onClick={handleOpenProject}
        >
          <ExternalLink size={14} />
          {t('common.open')}
        </button>
      )}

      {canOpenEditor && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-state-hover cursor-pointer"
          onClick={openObjectEditor}
        >
          <ExternalLink size={14} />
          {t('editor.openInEditor')}
        </button>
      )}

      {/* Network creation */}
      {instanceId && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-state-hover cursor-pointer"
          onClick={handleCreateNetwork}
        >
          <Plus size={14} />
          {t('network.createNetwork')}
        </button>
      )}

      {instanceId && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-state-hover cursor-pointer"
          onClick={handleAttachNetwork}
        >
          <Link size={14} />
          {t('network.connectNetwork') ?? 'Connect Network'}
        </button>
      )}

      {/* Edit metadata (file/dir nodes only) */}
      {fileId && currentNetwork && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-default hover:bg-state-hover cursor-pointer"
          onClick={() => {
            useEditorStore.getState().openTab({
              type: 'fileMetadata',
              targetId: fileId,
              title: filePath?.replace(/\\/g, '/').split('/').pop() ?? 'Metadata',
              networkId: currentNetwork.id,
            });
            onClose();
          }}
        >
          <FileText size={14} />
          {t('fileMetadata.editMetadata')}
        </button>
      )}

      {/* Edge connection (edit mode only) */}
      {mode === 'edit' && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-state-hover cursor-pointer"
          onClick={handleAddConnection}
        >
          <Link size={14} />
          {t('edge.addConnection')}
        </button>
      )}

      {/* Exclude from this network */}
      <button
        className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-state-hover cursor-pointer"
        onClick={handleExclude}
      >
        <Unlink2 size={14} />
        {t('network.excludeFromNetwork')}
      </button>

      {canDeleteObject && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-state-hover cursor-pointer"
          onClick={handleDeleteObject}
        >
          <Trash2 size={14} />
          {t('network.deleteObjectPermanently')}
        </button>
      )}
    </WorkspaceContextMenuSurface>
  );
}
