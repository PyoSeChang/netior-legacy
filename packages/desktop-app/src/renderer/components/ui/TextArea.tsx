import React from 'react';

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ error, className = '', style, ...props }, ref) => {
    const baseStyle = 'block w-full min-h-[80px] px-3 py-2.5 text-default bg-surface-input border border-input rounded-lg outline-none resize-y transition-all duration-fast placeholder:text-muted hover:border-strong focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed';
    const errorStyle = 'border-status-error';

    const cls = [baseStyle, error ? errorStyle : '', className].filter(Boolean).join(' ');

    return (
      <textarea
        ref={ref}
        className={cls}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--font-body-size)',
          lineHeight: 'var(--font-body-line-height)',
          letterSpacing: 'var(--font-body-letter-spacing)',
          ...style,
        }}
        {...props}
      />
    );
  }
);

TextArea.displayName = 'TextArea';
