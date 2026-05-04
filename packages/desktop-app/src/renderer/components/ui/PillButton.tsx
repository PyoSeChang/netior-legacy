import React from 'react';

export interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'xs' | 'sm' | 'md';
  isActive?: boolean;
  emphasis?: 'default' | 'muted';
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const PillButton = React.forwardRef<HTMLButtonElement, PillButtonProps>(
  (
    {
      size = 'sm',
      isActive = false,
      emphasis = 'default',
      leadingIcon,
      trailingIcon,
      children,
      className = '',
      ...props
    },
    ref,
  ) => {
    const baseStyle = 'inline-flex min-w-0 items-center gap-1.5 rounded-full border font-medium leading-none transition-colors duration-fast select-none disabled:cursor-not-allowed disabled:opacity-50';

    const sizes = {
      xs: 'h-6 px-2.5 text-[11px]',
      sm: 'h-7 px-3 text-xs',
      md: 'h-8 px-3.5 text-sm',
    };

    const inactiveStyles = {
      default: 'border-subtle bg-surface-card text-secondary hover:enabled:border-default hover:enabled:bg-state-hover hover:enabled:text-default',
      muted: 'border-subtle bg-surface-editor text-muted hover:enabled:border-default hover:enabled:bg-state-hover hover:enabled:text-default',
    };

    const activeStyle = 'border-accent bg-state-selected text-accent shadow-sm';

    const cls = [
      baseStyle,
      sizes[size],
      isActive ? activeStyle : inactiveStyles[emphasis],
      className,
    ].filter(Boolean).join(' ');

    return (
      <button ref={ref} className={cls} {...props}>
        {leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
        {children}
        {trailingIcon ? <span className="shrink-0">{trailingIcon}</span> : null}
      </button>
    );
  },
);

PillButton.displayName = 'PillButton';
