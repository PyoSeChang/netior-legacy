import React from 'react';

export interface BadgeProps {
  variant?: 'default' | 'accent' | 'success' | 'error' | 'warning';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className = '' }) => {
  const variants = {
    default: 'bg-state-hover text-secondary',
    accent: 'bg-accent-muted text-accent',
    success: 'bg-status-success/15 text-status-success',
    error: 'bg-status-error/15 text-status-error',
    warning: 'bg-status-warning/15 text-status-warning',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full leading-tight ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};
