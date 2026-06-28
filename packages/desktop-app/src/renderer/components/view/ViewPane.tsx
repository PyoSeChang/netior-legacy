import React, { useEffect } from 'react';
import type { World } from '@netior/shared/types';
import { useDomainStore } from '../../stores/domain-store';
import { ViewRenderer } from './ViewRenderer';

interface ViewPaneProps {
  world: World | null;
}

export function ViewPane({ world }: ViewPaneProps): JSX.Element {
  const {
    snapshot,
    models,
    views,
    activeModelId,
    activeViewType,
    loadWorldContext,
  } = useDomainStore();

  useEffect(() => {
    void loadWorldContext(world);
  }, [loadWorldContext, world]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-surface-base">
      <div className="min-h-0 flex-1">
        <ViewRenderer
          world={world}
          models={models}
          views={views}
          activeModelId={activeModelId}
          activeViewType={activeViewType}
          snapshot={snapshot}
        />
      </div>
    </section>
  );
}
