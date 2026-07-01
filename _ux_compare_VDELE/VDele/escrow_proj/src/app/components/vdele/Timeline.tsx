import React from 'react';
import { Check, Clock, AlertCircle } from 'lucide-react';

export type TimelineStep = {
  label: string;
  date?: string;
  state: 'completed' | 'active' | 'pending' | 'disputed';
};

interface TimelineProps {
  steps: TimelineStep[];
  className?: string;
}

export function Timeline({ steps, className = '' }: TimelineProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        
        const stateConfig = {
          completed: {
            icon: <Check className="w-5 h-5" />,
            iconBg: 'bg-[#10B981]',
            lineColor: 'bg-[#10B981]',
            textColor: 'text-gray-900',
          },
          active: {
            icon: <div className="w-2 h-2 bg-white rounded-full" />,
            iconBg: 'bg-[#14B8A6]',
            lineColor: 'bg-gray-200',
            textColor: 'text-gray-900',
          },
          pending: {
            icon: <Clock className="w-5 h-5" />,
            iconBg: 'bg-gray-300',
            lineColor: 'bg-gray-200',
            textColor: 'text-gray-500',
          },
          disputed: {
            icon: <AlertCircle className="w-5 h-5" />,
            iconBg: 'bg-[#EF4444]',
            lineColor: 'bg-gray-200',
            textColor: 'text-[#EF4444]',
          },
        };
        
        const config = stateConfig[step.state];
        
        return (
          <div key={index} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full ${config.iconBg} text-white flex items-center justify-center`}>
                {config.icon}
              </div>
              {!isLast && (
                <div className={`w-0.5 h-12 ${config.lineColor} mt-2`} />
              )}
            </div>
            <div className="flex-1 pt-1.5">
              <p className={`font-medium ${config.textColor}`}>{step.label}</p>
              {step.date && (
                <p className="text-sm text-gray-500 mt-0.5">{step.date}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
