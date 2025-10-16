import React from 'react';

interface SmallProps {
  children: React.ReactNode;
  className?: string;
}

export function Small({ children, className }: SmallProps) {
  return (
    <span className={`text-xs text-gray-500 ${className || ''}`}>
      {children}
    </span>
  );
}
