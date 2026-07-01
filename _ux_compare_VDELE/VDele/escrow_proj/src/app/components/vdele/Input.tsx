import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div>
      {label && <label className="block text-[13px] font-medium text-gray-500 mb-1.5 ml-1">{label}</label>}
      <input
        className={`w-full h-[46px] px-4 rounded-xl bg-[#F2F2F7] text-[15px] text-gray-900
          placeholder:text-gray-400 border-0 outline-none
          focus:bg-white focus:ring-2 focus:ring-[#14B8A6]/30
          disabled:opacity-50 transition-all ${error ? 'ring-2 ring-red-300' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-[12px] text-red-500 mt-1 ml-1">{error}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = '', ...props }: TextareaProps) {
  return (
    <div>
      {label && <label className="block text-[13px] font-medium text-gray-500 mb-1.5 ml-1">{label}</label>}
      <textarea
        className={`w-full px-4 py-3 rounded-xl bg-[#F2F2F7] text-[15px] text-gray-900
          placeholder:text-gray-400 border-0 outline-none min-h-[100px]
          focus:bg-white focus:ring-2 focus:ring-[#14B8A6]/30
          disabled:opacity-50 transition-all resize-none ${error ? 'ring-2 ring-red-300' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-[12px] text-red-500 mt-1 ml-1">{error}</p>}
    </div>
  );
}
