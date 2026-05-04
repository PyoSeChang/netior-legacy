import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, footer, width }) => {
  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [open, handleEsc]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200" style={{ zIndex: 10000 }} onClick={onClose}>
      <div
        className="bg-surface-floating border border-subtle rounded-xl shadow-2xl max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200 ring-1 ring-black/10"
        style={width ? { width } : { width: 'min(90vw, 520px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-subtle">
            <span className="text-lg font-semibold text-default">{title}</span>
            <IconButton label="Close" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </div>
        )}
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-3 border-t border-subtle">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};
