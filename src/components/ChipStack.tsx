import React from 'react';

interface ChipStackProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const ChipStack: React.FC<ChipStackProps> = ({
  amount = 0,
  size = 'md',
  showLabel = true,
}) => {
  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;

  // Determine chip style based on value
  const getChipColor = (val: number) => {
    if (val >= 5) return 'from-purple-600 to-indigo-800 border-purple-300 text-purple-100';
    if (val >= 2) return 'from-rose-600 to-red-800 border-rose-300 text-rose-100';
    if (val >= 1) return 'from-blue-600 to-cyan-800 border-blue-300 text-blue-100';
    if (val >= 0.5) return 'from-emerald-600 to-teal-800 border-emerald-300 text-emerald-100';
    return 'from-amber-500 to-yellow-700 border-amber-200 text-slate-900';
  };

  const dimClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  }[size];

  return (
    <div className="inline-flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-amber-500/30 shadow-md">
      <div
        className={`relative ${dimClasses} rounded-full bg-gradient-to-tr ${getChipColor(
          safeAmount
        )} border-2 border-dashed flex items-center justify-center font-black shadow-[0_2px_4px_rgba(0,0,0,0.5)] transform -rotate-6`}
      >
        <div className="w-full h-full rounded-full border border-white/40 flex items-center justify-center">
          <span className="text-[10px] font-extrabold drop-shadow">₼</span>
        </div>
      </div>
      {showLabel && (
        <span className="font-extrabold text-amber-300 text-xs sm:text-sm tracking-tight">
          {safeAmount.toFixed(2)} ₼
        </span>
      )}
    </div>
  );
};
