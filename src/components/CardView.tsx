import React from 'react';
import { Card as CardType } from '../types';
import { SUITS } from '../utils/sekaLogic';
import { motion } from 'motion/react';

interface CardViewProps {
  card?: CardType;
  isFacedown?: boolean;
  isInteractive?: boolean;
  onFlip?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  glow?: boolean;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  isFacedown = false,
  isInteractive = false,
  onFlip,
  size = 'md',
  className = '',
  glow = false,
}) => {
  const suitInfo = card ? SUITS.find((s) => s.suit === card.suit) : null;
  const isRed = card?.suit === 'hearts' || card?.suit === 'diamonds';

  const sizeClasses = {
    xs: 'w-7 h-10 text-[9px]',
    sm: 'w-8 h-12 sm:w-10 sm:h-14 text-[10px]',
    md: 'w-11 h-16 sm:w-13 sm:h-19 text-xs',
    lg: 'w-16 h-24 sm:w-20 sm:h-28 text-sm',
  }[size];

  return (
    <motion.div
      whileHover={isInteractive ? { y: -6, scale: 1.05 } : undefined}
      whileTap={isInteractive ? { scale: 0.96 } : undefined}
      onClick={isInteractive ? onFlip : undefined}
      className={`relative select-none perspective-500 rounded-xl transition-shadow ${sizeClasses} ${
        isInteractive ? 'cursor-pointer' : ''
      } ${
        glow ? 'ring-2 ring-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.6)]' : 'shadow-md'
      } ${className}`}
    >
      {isFacedown || !card ? (
        // Card Back (Göy naxışlı arxa fon)
        <div className="w-full h-full rounded-lg bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-950 border border-amber-400/50 p-0.5 sm:p-1 flex items-center justify-center relative overflow-hidden shadow-inner">
          {/* Detailed Geometric Pattern */}
          <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#60a5fa_1px,transparent_1px)] [background-size:6px_6px]" />
          <div className="w-full h-full border border-amber-300/30 rounded flex flex-col items-center justify-center relative z-10 bg-blue-950/40">
            <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-amber-200 p-[1px] shadow-sm flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center">
                <span className="text-amber-400 font-black text-[9px] sm:text-xs">♠</span>
              </div>
            </div>
            {size !== 'xs' && (
              <span className="text-[7px] sm:text-[8px] font-bold text-amber-300/80 tracking-widest uppercase mt-0.5">
                SEKA
              </span>
            )}
          </div>
        </div>
      ) : (
        // Card Front
        <div className="w-full h-full rounded-lg bg-gradient-to-b from-stone-50 via-white to-stone-100 border border-amber-300/70 p-1 sm:p-1.5 flex flex-col justify-between shadow-md relative overflow-hidden">
          {/* Top Left Rank & Suit */}
          <div className="flex flex-col items-start leading-none">
            <span
              className={`font-black tracking-tighter ${
                isRed ? 'text-rose-600' : 'text-slate-900'
              } ${size === 'lg' ? 'text-base sm:text-lg' : size === 'md' ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-xs'}`}
            >
              {card.rank}
            </span>
            <span
              className={`font-bold ${
                isRed ? 'text-rose-600' : 'text-slate-900'
              } ${size === 'lg' ? 'text-xs' : 'text-[9px] sm:text-[10px]'}`}
            >
              {suitInfo?.symbol}
            </span>
          </div>

          {/* Center Suit Art */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span
              className={`select-none font-bold opacity-80 ${
                isRed ? 'text-rose-600' : 'text-slate-900'
              } ${size === 'lg' ? 'text-2xl sm:text-3xl' : size === 'md' ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'}`}
            >
              {suitInfo?.symbol}
            </span>
            {size !== 'xs' && size !== 'sm' && ['K', 'Q', 'J', 'A'].includes(card.rank) && (
              <span className="absolute text-[7px] font-black text-amber-600/70 tracking-widest bottom-1">
                {card.rank === 'A' ? 'TUZ' : card.rank === 'K' ? 'KAROL' : card.rank === 'Q' ? 'DAMA' : 'VALET'}
              </span>
            )}
          </div>

          {/* Bottom Right Rank & Suit (Upside down) */}
          <div className="flex flex-col items-end leading-none rotate-180">
            <span
              className={`font-black tracking-tighter ${
                isRed ? 'text-rose-600' : 'text-slate-900'
              } ${size === 'lg' ? 'text-base sm:text-lg' : size === 'md' ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-xs'}`}
            >
              {card.rank}
            </span>
            <span
              className={`font-bold ${
                isRed ? 'text-rose-600' : 'text-slate-900'
              } ${size === 'lg' ? 'text-xs' : 'text-[9px] sm:text-[10px]'}`}
            >
              {suitInfo?.symbol}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
};
