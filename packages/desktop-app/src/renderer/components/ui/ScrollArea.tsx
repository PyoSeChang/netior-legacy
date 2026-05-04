import React from 'react';

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  style?: React.CSSProperties;
}

export const ScrollArea: React.FC<ScrollAreaProps> = ({ children, className = '', style, ...props }) => {
  return (
    <div className={`netior-scrollbar overflow-y-auto overflow-x-hidden ${className}`} style={style} {...props}>
      {children}
    </div>
  );
};
