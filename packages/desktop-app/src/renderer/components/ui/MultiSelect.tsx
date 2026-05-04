import React from 'react';
import { Checkbox } from './Checkbox';

export interface MultiSelectProps {
  options: { value: string; label: string }[];
  value?: string[];
  onChange?: (value: string[]) => void;
  disabled?: boolean;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ options, value = [], onChange, disabled }) => {
  const toggle = (optValue: string) => {
    if (disabled) return;
    const next = value.includes(optValue)
      ? value.filter((v) => v !== optValue)
      : [...value, optValue];
    onChange?.(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {options.map((opt) => (
        <Checkbox
          key={opt.value}
          checked={value.includes(opt.value)}
          onChange={() => toggle(opt.value)}
          label={opt.label}
          disabled={disabled}
        />
      ))}
    </div>
  );
};
