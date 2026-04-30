import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface WorkspaceContextMenuSurfaceProps {
  x: number;
  y: number;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function WorkspaceContextMenuSurface({
  x,
  y,
  onClose,
  children,
  className = '',
}: WorkspaceContextMenuSurfaceProps): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const handleWindowBlur = () => {
      onClose();
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [onClose]);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${Math.max(4, window.innerWidth - rect.width - 4)}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${Math.max(4, window.innerHeight - rect.height - 4)}px`;
    }
  }, [x, y]);

  return createPortal(
    <div
      ref={menuRef}
      className={`fixed min-w-[180px] rounded-md border border-default bg-surface-floating py-1 shadow-lg ${className}`}
      style={{ left: x, top: y, zIndex: 10050, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
