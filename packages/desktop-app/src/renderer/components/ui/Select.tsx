import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import { useAnchoredDropdown } from '../../hooks/useAnchoredDropdown';

export interface SelectOption {
  value: string;
  label: string;
  icon?: string | null;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  selectSize?: 'default' | 'sm';
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

function SelectIconMarker({ className = '' }: { className?: string }): JSX.Element {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 rounded-sm border border-subtle bg-surface-hover ${className}`}
      aria-hidden="true"
    />
  );
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder,
  id,
  disabled,
  selectSize = 'default',
  searchable = false,
  searchPlaceholder = 'Search',
  emptyMessage = 'No results',
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownPos = useAnchoredDropdown(open, buttonRef, {
    estimatedHeight: 220,
  }, dropdownRef);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target) &&
          dropdownRef.current && !dropdownRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      return;
    }

    if (!searchable) return;

    const handle = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(handle);
  }, [open, searchable]);

  const selectedOption = options.find((o) => o.value === value);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredOptions = searchable && normalizedSearch.length > 0
    ? options.filter((opt) => (
      opt.label.toLowerCase().includes(normalizedSearch) ||
      opt.value.toLowerCase().includes(normalizedSearch)
    ))
    : options;

  const handleOpen = () => {
    if (disabled) return;
    setOpen(!open);
  };

  const handleSelect = (optValue: string) => {
    onChange?.({ target: { value: optValue } });
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpen();
    }
  };

  const sizeStyle = selectSize === 'sm'
    ? 'px-3 py-1.5 text-sm'
    : 'px-3 py-2 text-sm';

  const itemSizeStyle = selectSize === 'sm'
    ? 'px-3 py-1.5 text-sm'
    : 'px-3 py-2 text-sm';
  const searchAreaHeight = searchable ? 52 : 0;

  return (
    <div className="relative block w-full" ref={ref}>
      <div
        ref={buttonRef}
        id={id}
        className={`flex items-center w-full ${sizeStyle} text-default bg-surface-input border border-input rounded-lg cursor-pointer outline-none text-left transition-all duration-fast hover:border-strong focus:border-accent ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${open ? 'border-accent' : ''
          }`}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled}
      >
        {selectedOption?.icon && (
          <SelectIconMarker className="mr-2 shrink-0" />
        )}
        <span className={`block overflow-hidden text-ellipsis whitespace-nowrap flex-1 ${selectedOption ? '' : 'text-muted'}`}>
          {selectedOption?.label || placeholder || ''}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-muted ml-2 transition-transform duration-fast ${open ? 'rotate-180' : ''}`} />
      </div>
      {open &&
        createPortal(
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
            role="listbox"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {searchable && (
              <div className="border-b border-subtle px-2 py-2">
                <div className="flex items-center gap-2 rounded-md border border-subtle bg-surface-editor px-2.5 py-1.5">
                  <Search size={14} className="shrink-0 text-muted" />
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full bg-transparent text-sm text-default outline-none placeholder:text-muted"
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setOpen(false);
                      }
                    }}
                  />
                </div>
              </div>
            )}
            <div
              className="overflow-y-auto py-1"
              style={{
                maxHeight: Math.max(72, dropdownPos.maxHeight - searchAreaHeight),
              }}
            >
              {filteredOptions.length > 0 ? filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  className={`flex w-full items-center gap-2 ${itemSizeStyle} text-left cursor-pointer transition-colors duration-fast hover:bg-state-hover ${opt.value === value ? 'text-accent bg-accent-muted' : 'text-default'
                    }`}
                  onClick={() => handleSelect(opt.value)}
                >
                  {opt.icon && <SelectIconMarker className="shrink-0" />}
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                </button>
              )) : (
                <div className={`px-3 py-2 text-sm text-muted ${itemSizeStyle}`}>
                  {emptyMessage}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
