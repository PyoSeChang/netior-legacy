import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  inputSize?: 'default' | 'sm';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error, inputSize = 'default', className = '', ...props }, ref) => {
    const sizeStyle = inputSize === 'sm'
      ? 'px-3 py-1.5 text-sm'
      : 'px-3.5 py-2 text-sm';

    const baseStyle = `block w-full ${sizeStyle} text-default bg-surface-input border border-input rounded-lg outline-none transition-all duration-fast placeholder:text-muted hover:border-strong focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed`;
    const errorStyle = 'border-status-error';

    const cls = [baseStyle, error ? errorStyle : '', className].filter(Boolean).join(' ');
    return <input ref={ref} className={cls} {...props} />;
  }
);

Input.displayName = 'Input';
