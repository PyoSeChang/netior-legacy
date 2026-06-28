import React, { useEffect } from 'react';
import { ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import {
  ACTIVITY_BAR_BOTTOM_ITEM_DEFINITIONS,
  ACTIVITY_BAR_TOP_ITEM_DEFINITIONS,
} from '../../lib/activity-bar-items';
import { useActivityBarStore } from '../../stores/activity-bar-store';

function getSectionId(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '-');
}

function MoveButtons({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  moveUpLabel,
  moveDownLabel,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  moveUpLabel: string;
  moveDownLabel: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded-md text-secondary transition-colors hover:bg-state-hover hover:text-default disabled:cursor-not-allowed disabled:opacity-40"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        title={moveUpLabel}
        aria-label={moveUpLabel}
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded-md text-secondary transition-colors hover:bg-state-hover hover:text-default disabled:cursor-not-allowed disabled:opacity-40"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        title={moveDownLabel}
        aria-label={moveDownLabel}
      >
        <ChevronDown size={14} />
      </button>
    </div>
  );
}

function ReorderableRow({
  icon: Icon,
  label,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  moveUpLabel,
  moveDownLabel,
}: {
  icon: LucideIcon;
  label: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  moveUpLabel: string;
  moveDownLabel: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-editor text-secondary">
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-default">{label}</div>
      </div>
      <MoveButtons
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        moveUpLabel={moveUpLabel}
        moveDownLabel={moveDownLabel}
      />
    </div>
  );
}

export function SidebarSettingsPanel(): JSX.Element {
  const { t } = useI18n();
  const config = useActivityBarStore((state) => state.config);
  const ensureLoaded = useActivityBarStore((state) => state.ensureLoaded);
  const moveTopItem = useActivityBarStore((state) => state.moveTopItem);
  const moveBottomItem = useActivityBarStore((state) => state.moveBottomItem);

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  const moveUpLabel = t('settings.sidebarMoveUp' as never);
  const moveDownLabel = t('settings.sidebarMoveDown' as never);
  const topItemsTitle = t('settings.sidebarTopItems' as never);
  const bottomItemsTitle = t('settings.sidebarBottomItems' as never);

  return (
    <div data-section="sidebar">
      <section data-section={getSectionId(topItemsTitle)} className="mb-8">
        <h3 className="text-base font-semibold text-default">{topItemsTitle}</h3>
        <p className="mb-4 mt-1 text-sm text-secondary">{t('settings.sidebarTopItemsDesc' as never)}</p>
        <div className="divide-y divide-subtle overflow-hidden rounded-lg border border-subtle">
          {config.topItemOrder.map((itemKey, index) => {
            const definition = ACTIVITY_BAR_TOP_ITEM_DEFINITIONS[itemKey];
            return (
              <ReorderableRow
                key={itemKey}
                icon={definition.icon}
                label={t(definition.labelKey)}
                canMoveUp={index > 0}
                canMoveDown={index < config.topItemOrder.length - 1}
                onMoveUp={() => { void moveTopItem(index, -1); }}
                onMoveDown={() => { void moveTopItem(index, 1); }}
                moveUpLabel={moveUpLabel}
                moveDownLabel={moveDownLabel}
              />
            );
          })}
        </div>
      </section>

      <section data-section={getSectionId(bottomItemsTitle)} className="mb-8">
        <h3 className="text-base font-semibold text-default">{bottomItemsTitle}</h3>
        <p className="mb-4 mt-1 text-sm text-secondary">{t('settings.sidebarBottomItemsDesc' as never)}</p>
        <div className="divide-y divide-subtle overflow-hidden rounded-lg border border-subtle">
          {config.bottomItemOrder.map((itemKey, index) => {
            const definition = ACTIVITY_BAR_BOTTOM_ITEM_DEFINITIONS[itemKey];
            return (
              <ReorderableRow
                key={itemKey}
                icon={definition.icon}
                label={t(definition.labelKey)}
                canMoveUp={index > 0}
                canMoveDown={index < config.bottomItemOrder.length - 1}
                onMoveUp={() => { void moveBottomItem(index, -1); }}
                onMoveDown={() => { void moveBottomItem(index, 1); }}
                moveUpLabel={moveUpLabel}
                moveDownLabel={moveDownLabel}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

