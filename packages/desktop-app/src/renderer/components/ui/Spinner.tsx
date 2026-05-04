import React from 'react';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-9 h-9',
  };

  return <div className={`inline-block border-2 border-default border-t-accent rounded-full animate-spin ${sizes[size]} ${className}`} role="status" aria-label="Loading" />;
};
