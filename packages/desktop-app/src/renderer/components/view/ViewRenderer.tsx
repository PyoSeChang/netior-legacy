import React from 'react';
import type { DomainSnapshot } from '@netior/shared';
import type { World } from '@netior/shared/types';
import type { DomainModelSummary, DomainViewSummary } from '../../stores/domain-store';
import { CanvasView } from './CanvasView';
import { ExplorerView } from './ExplorerView';

interface ViewRendererProps {
  world: World | null;
  models: DomainModelSummary[];
  views: DomainViewSummary[];
  activeModelId: string | null;
  activeViewType: 'explorer' | 'canvas';
  snapshot: DomainSnapshot | null;
}

export function ViewRenderer({
  world,
  models,
  views,
  activeModelId,
  activeViewType,
  snapshot,
}: ViewRendererProps): JSX.Element {
  if (activeViewType === 'explorer') {
    return <ExplorerView world={world} models={models} views={views} activeModelId={activeModelId} snapshot={snapshot} />;
  }

  return <CanvasView models={models} views={views} activeModelId={activeModelId} snapshot={snapshot} />;
}
