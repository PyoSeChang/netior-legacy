import React from 'react';

export interface DividerProps {
  vertical?: boolean;
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({ vertical, className = '' }) => {
  if (vertical) {
    return <div className={`border-none border-l border-subtle h-full mx-3 ${className}`} role="separator" />;
  }
  return <hr className={`border-none border-t border-subtle my-3 ${className}`} />;
};
