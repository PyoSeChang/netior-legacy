import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link2, X } from 'lucide-react';
import { useInstanceStore } from '../../stores/instance-store';
import { NodeVisual } from '../workspace/node-components/NodeVisual';

export interface RelationPickerProps {
  value?: string;
  onChange?: (instanceId: string | null) => void;
  disabled?: boolean;
}

export const RelationPicker: React.FC<RelationPickerProps> = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const instances = useInstanceStore((s) => s.instances);
  const selected = instances.find((c) => c.id === value);

  const filtered = useMemo(() => {
    if (!search) return instances;
    const q = search.toLowerCase();
    return instances.filter((c) => c.title.toLowerCase().includes(q));
  }, [instances, search]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    if (disabled) return;
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpen(!open);
    setSearch('');
  };

  return (
    <>
      <div
        ref={triggerRef}
        className={`flex items-center gap-2 px-3 py-1.5 bg-surface-input border border-subtle rounded-lg text-sm cursor-pointer hover:border-default transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={handleOpen}
      >
        {selected ? (
          <NodeVisual icon={selected.icon ?? 'box'} size={14} imageSize={18} className="shrink-0" />
        ) : (
          <Link2 size={14} className="shrink-0 text-muted" />
        )}
        <span className={`flex-1 ${selected ? 'text-default' : 'text-muted'}`}>
          {selected?.title || 'Select instance...'}
        </span>
        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange?.(null);
            }}
            className="text-muted hover:text-default"
          >
            <X size={12} />
          </button>
        )}
      </div>
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-surface-panel border border-default rounded-lg overflow-hidden"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: Math.max(dropdownPos.width, 200),
            zIndex: 10001,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="p-2">
            <input
              className="w-full px-2 py-1 text-sm bg-surface-input border border-subtle rounded text-default outline-none focus:border-accent"
              placeholder="Search instances..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto py-1">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm transition-colors hover:bg-state-hover ${
                  c.id === value ? 'text-accent bg-accent-muted' : 'text-default'
                }`}
                onClick={() => {
                  onChange?.(c.id);
                  setOpen(false);
                }}
              >
                <NodeVisual icon={c.icon ?? 'box'} size={14} imageSize={18} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted">No instances found</div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
