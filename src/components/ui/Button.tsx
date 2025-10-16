import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  className?: string;
}

export function Button({ children, variant = 'primary', className, ...props }: ButtonProps) {
  const baseClasses = 'rounded-xl px-4 py-2 font-medium shadow-sm hover:shadow transition disabled:opacity-50';
  const variantClasses = {
    primary: 'bg-black text-white',
    secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
  };

  return (
    <button
      {...props}
      className={`${baseClasses} ${variantClasses[variant]} ${className || ''}`}
    >
      {children}
    </button>
  );
}
