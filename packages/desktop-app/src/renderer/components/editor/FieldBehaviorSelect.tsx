import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, GitBranch, Layers3, ListTree, Sigma, SlidersHorizontal } from 'lucide-react';
import type { TranslationKey } from '@netior/shared/i18n';
import { useAnchoredDropdown } from '../../hooks/useAnchoredDropdown';
import { useI18n } from '../../hooks/useI18n';

export type FieldBehaviorMode =
  | 'none'
  | 'schema_composition'
  | 'schema_extension'
  | 'conditional_field'
  | 'computed_field'
  | 'derived_collection';

interface FieldBehaviorOption {
  value: FieldBehaviorMode;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: React.FC<{ size?: string | number; className?: string }>;
}

const OPTIONS: FieldBehaviorOption[] = [
  {
    value: 'none',
    labelKey: 'schema.fieldBehavior.none' as TranslationKey,
    descriptionKey: 'schema.fieldBehaviorDesc.none' as TranslationKey,
    icon: SlidersHorizontal,
  },
  {
    value: 'schema_composition',
    labelKey: 'schema.fieldBehavior.schemaComposition' as TranslationKey,
    descriptionKey: 'schema.fieldBehaviorDesc.schemaComposition' as TranslationKey,
    icon: Layers3,
  },
  {
    value: 'schema_extension',
    labelKey: 'schema.fieldBehavior.schemaExtension' as TranslationKey,
    descriptionKey: 'schema.fieldBehaviorDesc.schemaExtension' as TranslationKey,
    icon: GitBranch,
  },
  {
    value: 'conditional_field',
    labelKey: 'schema.fieldBehavior.conditionalField' as TranslationKey,
    descriptionKey: 'schema.fieldBehaviorDesc.conditionalField' as TranslationKey,
    icon: SlidersHorizontal,
  },
  {
    value: 'computed_field',
    labelKey: 'schema.fieldBehavior.computedField' as TranslationKey,
    descriptionKey: 'schema.fieldBehaviorDesc.computedField' as TranslationKey,
    icon: Sigma,
  },
  {
    value: 'derived_collection',
    labelKey: 'schema.fieldBehavior.derivedCollection' as TranslationKey,
    descriptionKey: 'schema.fieldBehaviorDesc.derivedCollection' as TranslationKey,
    icon: ListTree,
  },
];

interface FieldBehaviorSelectProps {
  value: FieldBehaviorMode;
  onChange: (value: FieldBehaviorMode) => void;
  disabled?: boolean;
}

export function FieldBehaviorSelect({
  value,
  onChange,
  disabled = false,
}: FieldBehaviorSelectProps): JSX.Element {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownPos = useAnchoredDropdown(open, triggerRef, {
    estimatedHeight: 320,
    minWidth: 320,
  }, dropdownRef);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = useMemo(() => OPTIONS.find((option) => option.value === value) ?? OPTIONS[0], [value]);
  const SelectedIcon = selected.icon;

  return (
    <>
      <div
        ref={triggerRef}
        className={`flex w-full min-w-[190px] items-start gap-2 rounded-lg border border-input bg-surface-input px-2.5 py-1.5 text-sm outline-none transition-all duration-fast hover:border-strong focus:border-accent ${open ? 'border-accent' : ''} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled}
      >
        <SelectedIcon size={14} className="mt-0.5 shrink-0 text-muted" />
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-default">{t(selected.labelKey)}</div>
          <div className="mt-0.5 truncate text-[11px] text-secondary">{t(selected.descriptionKey)}</div>
        </div>
        <ChevronDown size={12} className={`mt-0.5 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed overflow-hidden rounded-lg border border-default bg-surface-panel"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            maxHeight: dropdownPos.maxHeight,
            visibility: dropdownPos.ready ? 'visible' : 'hidden',
            zIndex: 10001,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
          onMouseDown={(event) => event.stopPropagation()}
          role="listbox"
        >
          <div className="max-h-[320px] overflow-y-auto py-1">
            {OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-state-hover ${option.value === value ? 'bg-accent-muted text-accent' : 'text-default'}`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Icon size={15} className="mt-0.5 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{t(option.labelKey)}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-secondary">{t(option.descriptionKey)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
