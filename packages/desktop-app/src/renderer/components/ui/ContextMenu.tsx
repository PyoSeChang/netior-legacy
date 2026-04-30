import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}

export interface ContextMenuDivider {
  type: 'divider';
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuDivider;

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleWindowBlur = () => {
      onClose();
    };
    const handleVisibilityChange = () => {
      if (document.hidden) onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onClose]);

  // Adjust position so menu doesn't overflow viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${window.innerWidth - rect.width - 4}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${window.innerHeight - rect.height - 4}px`;
    }
  }, [x, y]);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed min-w-[180px] rounded-md border border-default bg-surface-floating py-1 shadow-lg"
      style={{ left: x, top: y, zIndex: 10050, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => {
        if ('type' in item && item.type === 'divider') {
          return <div key={i} className="my-1 border-t border-subtle" />;
        }
        const menuItem = item as ContextMenuItem;
        return (
          <button
            key={i}
            className={`flex w-full items-center gap-2 px-3 py-1 text-xs ${
              menuItem.disabled
                ? 'cursor-default text-muted'
                : menuItem.danger
                  ? 'text-red-400 hover:bg-state-hover'
                  : 'text-default hover:bg-state-hover'
            }`}
            disabled={menuItem.disabled}
            onClick={() => {
              if (!menuItem.disabled) {
                menuItem.onClick();
                onClose();
              }
            }}
          >
            {menuItem.icon && <span className="w-4">{menuItem.icon}</span>}
            <span className="flex-1 text-left">{menuItem.label}</span>
            {menuItem.shortcut && (
              <span className="ml-4 text-muted">{menuItem.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
