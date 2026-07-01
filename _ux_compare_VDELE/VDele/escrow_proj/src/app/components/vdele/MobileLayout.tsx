import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
  onBack?: () => void;
  headerVariant?: 'light' | 'dark';
  bottomBar?: React.ReactNode;
}

export function MobileLayout({ children, title, onBack, headerVariant = 'light', bottomBar }: MobileLayoutProps) {
  const isDark = headerVariant === 'dark';

  return (
    <div className="w-full h-screen flex flex-col bg-[#F2F2F7]">
      {/* iOS-style header with subtle backdrop */}
      {(title || onBack) && (
        <div
          className={`px-4 flex items-center gap-2 flex-shrink-0 ${
            isDark
              ? 'bg-[#0B1220]/95 text-white'
              : 'bg-white/80 text-gray-900 border-b border-gray-200/50'
          }`}
          style={{
            minHeight: 48,
            backdropFilter: isDark ? 'none' : 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: isDark ? 'none' : 'blur(20px) saturate(180%)',
          } as any}
        >
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 rounded-full" style={{ minWidth: 36, minHeight: 36 }}>
              <ArrowLeft className="w-[22px] h-[22px]" style={{ strokeWidth: 2.5 }} />
            </button>
          )}
          {title && <h1 className="text-[17px] font-semibold flex-1 truncate">{title}</h1>}
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'none' } as any}>
        {children}
      </div>
      
      {bottomBar && (
        <div
          className="bg-white/80 border-t border-gray-200/50 px-4 pt-2 pb-2.5 flex-shrink-0"
          style={{ backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)' } as any}
        >
          {bottomBar}
        </div>
      )}
    </div>
  );
}
