import { useEditorStore } from '../stores/editor-store';

interface OpenNetworkViewerTabOptions {
  networkId: string;
  title: string;
  rootNetworkId?: string | null;
  isDirty?: boolean;
}

export async function openNetworkViewerTab({
  networkId,
  title,
  rootNetworkId,
  isDirty,
}: OpenNetworkViewerTabOptions): Promise<void> {
  await useEditorStore.getState().openTab({
    type: 'networkViewer',
    targetId: networkId,
    title,
    rootNetworkId: rootNetworkId ?? undefined,
    isDirty,
  });
}
