import React from 'react';

type CardVariant = 'dark' | 'light' | 'pricing' | 'wallet' | 'timeline';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  className?: string;
  children: React.ReactNode;
}

export function Card({ variant = 'light', className = '', children, ...rest }: CardProps) {
  const styles = {
    dark: 'bg-gradient-to-b from-[#0B1220] to-[#15202E] text-white shadow-lg shadow-black/20',
    light: 'bg-white text-gray-900 shadow-sm shadow-black/[0.04]',
    pricing: 'bg-white text-gray-900 shadow-sm shadow-[#14B8A6]/10 ring-1 ring-[#14B8A6]/15',
    wallet: 'bg-gradient-to-br from-[#0F766E] to-[#14B8A6] text-white shadow-lg shadow-[#14B8A6]/25',
    timeline: 'bg-[#F2F2F7] text-gray-900',
  };

  return (
    <div {...rest} className={`rounded-2xl p-4 ${styles[variant]} ${className}`}>
      {children}
    </div>
  );
}
