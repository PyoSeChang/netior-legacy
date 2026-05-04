import React from 'react';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, disabled }) => {
  return (
    <label className={`inline-flex items-center gap-2.5 select-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <div
        className={`w-10 h-[22px] rounded-full relative transition-colors duration-fast ${
          checked ? 'bg-accent' : 'bg-[var(--border-default)]'
        }`}
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => !disabled && onChange(!checked)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onChange(!checked);
          }
        }}
      >
        <div
          className={`w-[18px] h-[18px] rounded-full bg-on-accent absolute top-[2px] left-[2px] transition-transform duration-fast shadow-sm ${
            checked ? 'translate-x-[18px]' : 'translate-x-0'
          }`}
        />
      </div>
      {label && <span className="text-sm text-default">{label}</span>}
    </label>
  );
};
