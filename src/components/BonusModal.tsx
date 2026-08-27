import React from 'react';
import { X, Gift, Trophy, CheckCircle2, Flame, Award, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundManager } from '../utils/audio';

interface BonusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaimBonus: (amount: number) => void;
  hasClaimedWelcomeBonus: boolean;
}

export const BonusModal: React.FC<BonusModalProps> = ({
  isOpen,
  onClose,
  onClaimBonus,
  hasClaimedWelcomeBonus,
}) => {
  if (!isOpen) return null;

  const handleClaimWelcome = () => {
    if (hasClaimedWelcomeBonus) return;
    const welcomeAmount = 5.0; // 5.00 AZN welcome bonus
    onClaimBonus(welcomeAmount);
    soundManager.playWin();
    confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.5 },
      colors: ['#F59E0B', '#EAB308', '#10B981', '#FFFFFF'],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in font-sans">
      <div className="bg-[#1a1a1a] border border-[#F59E0B]/30 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#111] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F59E0B]/20 border border-[#F59E0B]/40 flex items-center justify-center text-[#F59E0B]">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#F59E0B] tracking-wide">
                Xüsusi Bonus Mərkəzi
              </h2>
              <p className="text-[11px] text-white/50">Hədiyyələr və qeydiyyat təşviqi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 text-white/60 hover:text-white flex items-center justify-center hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Main 5.00 AZN Welcome Bonus Card */}
          <div className="p-4.5 rounded-2xl bg-gradient-to-b from-[#221c11] to-[#12100b] border-2 border-[#F59E0B]/60 text-left relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 p-3 opacity-10 text-[#F59E0B] text-7xl font-serif select-none">
              ♠
            </div>

            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#F59E0B] text-black font-black text-[10px] rounded-full uppercase tracking-wider mb-2 shadow">
                  <Award className="w-3 h-3" />
                  Qeydiyyat Hədiyyəsi
                </span>
                <h3 className="font-black text-white text-lg flex items-center gap-1.5">
                  <span>5.00 ₼ Xoş Gəldin Bonusu</span>
                </h3>
                <p className="text-xs text-white/70 mt-1 leading-relaxed">
                  Bütün yeni qeydiyyatdan keçən oyunçular üçün dərhal 5.00 ₼ Bonus Balansı! (Cüzdan balansına isə yalnız depozit edilir)
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#F59E0B]/20 border border-[#F59E0B]/50 flex items-center justify-center text-[#F59E0B] shrink-0">
                <Trophy className="w-6 h-6" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#F59E0B]/20 relative z-10">
              {hasClaimedWelcomeBonus ? (
                <div className="flex items-center justify-center gap-2 py-2.5 bg-green-950/60 border border-green-500/40 rounded-xl text-xs text-green-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>5.00 ₼ Xoş Gəldin Bonusu Bonus Balansınıza Əlavə Olunub</span>
                </div>
              ) : (
                <button
                  onClick={handleClaimWelcome}
                  className="w-full py-3 bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-black font-black rounded-xl text-sm transition shadow-[0_0_20px_rgba(245,158,11,0.3)] uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  <Gift className="w-4 h-4 font-black" />
                  <span>5.00 ₼ Bonusu Bonus Balansına Götür</span>
                </button>
              )}
            </div>
          </div>

          {/* Seka Rules / Activity Rewards Info */}
          <div className="p-4 rounded-xl bg-[#111] border border-white/10 space-y-2.5">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#F59E0B]" />
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Bonus və Oyun Qaydaları
              </h4>
            </div>
            <ul className="text-xs text-white/60 space-y-1.5 list-disc list-inside">
              <li>Xoş gəldin bonusu hər oyunçuya yalnız 1 dəfə verilir.</li>
              <li>Bonus məbləği ilə bütün Seka masalarında dərhal oyuna başlaya bilərsiniz.</li>
              <li>Qazanılan məbləğləri Cüzdan bölməsindən komissiyasız çıxara bilərsiniz.</li>
            </ul>
          </div>

          {/* Fair play guarantee */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-white/40 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
            <span>Ədalətli oyun və şəffaf bonus sistemi</span>
          </div>
        </div>
      </div>
    </div>
  );
};
