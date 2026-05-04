import React from 'react';
import { ExternalLink } from 'lucide-react';
import { openExternal } from '../../lib/open-external';

export interface LinkInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const LinkInput: React.FC<LinkInputProps> = ({ value, onChange, placeholder = 'https://', disabled }) => {
  const handleOpenExternal = () => {
    if (value) void openExternal(value);
  };

  return (
    <div className="flex items-center gap-1">
      <input
        type="url"
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 px-3 py-1.5 text-sm text-default bg-surface-input border border-input rounded-lg outline-none transition-all duration-fast placeholder:text-muted hover:border-strong focus:border-accent disabled:opacity-50"
      />
      {value && (
        <button
          type="button"
          onClick={handleOpenExternal}
          className="p-1.5 text-muted hover:text-default transition-colors"
          title="Open link"
        >
          <ExternalLink size={14} />
        </button>
      )}
    </div>
  );
};
