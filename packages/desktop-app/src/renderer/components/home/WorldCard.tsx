import React from 'react';
import { Orbit, Trash2 } from 'lucide-react';
import type { World } from '@netior/shared/types';
import { getWorldRootDir } from '../../utils/world-utils';

interface WorldCardProps {
  world: World;
  onOpen: (world: World) => void;
  onDelete: (id: string) => void;
}

export function WorldCard({ world, onOpen, onDelete }: WorldCardProps): JSX.Element {
  return (
    <div
      className="group flex cursor-pointer items-center gap-3 rounded-lg border border-subtle bg-surface-card px-4 py-3 transition-colors duration-fast hover:border-default hover:bg-state-hover"
      onClick={() => onOpen(world)}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-muted text-accent">
        <Orbit size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-default">{world.name}</p>
        <p className="truncate text-xs text-muted">{getWorldRootDir(world)}</p>
      </div>
      <button
        className="shrink-0 rounded p-1 text-muted opacity-0 transition-opacity duration-fast hover:bg-state-hover hover:text-status-error group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(world.id);
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
