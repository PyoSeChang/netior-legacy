import React, { useState, useCallback } from 'react';
import { X } from 'lucide-react';

export interface TagInputProps {
  value?: string[];
  onChange?: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const TagInput: React.FC<TagInputProps> = ({ value = [], onChange, placeholder = 'Add tag...', disabled }) => {
  const [input, setInput] = useState('');

  const addTag = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange?.([...value, trimmed]);
    }
    setInput('');
  }, [input, value, onChange]);

  const removeTag = (tag: string) => {
    if (disabled) return;
    onChange?.(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      onChange?.(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-surface-input border border-input rounded-lg min-h-[34px] focus-within:border-accent transition-all">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-accent-muted text-accent rounded"
        >
          {tag}
          {!disabled && (
            <button type="button" onClick={() => removeTag(tag)} className="hover:text-default">
              <X size={10} />
            </button>
          )}
        </span>
      ))}
      <input
        className="flex-1 min-w-[60px] bg-transparent text-sm text-default outline-none placeholder:text-muted"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={value.length === 0 ? placeholder : ''}
        disabled={disabled}
      />
    </div>
  );
};
