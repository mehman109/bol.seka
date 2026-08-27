import React from 'react';
import { X, BookOpen, ShieldAlert, Award, Layers } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in font-sans">
      <div className="bg-[#1a1a1a] border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#111] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#F59E0B] tracking-wide">
                Ənənəvi Seka (3 Kart) Qaydaları
              </h2>
              <p className="text-xs text-white/50">Riyazi xalların hesablanması və oyun məntiqi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 text-white/60 hover:text-white flex items-center justify-center hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Rules Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm text-white/80">
          {/* Deck Info */}
          <div className="p-4 bg-[#0a0a0a] rounded-xl border border-white/10">
            <h3 className="text-[#F59E0B] font-extrabold text-sm mb-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#F59E0B]" />
              Dəstə və Kart Dəyərləri
            </h3>
            <p className="text-xs text-white/50 mb-3">
              Oyunda cəmi 36 kartlıq dəstə istifadə olunur (6, 7, 8, 9, 10, Valet, Dama, Karol, Tuz).
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 bg-[#1a1a1a] rounded-lg border border-white/10">
                <span className="font-bold text-[#F59E0B]">Tuz (A):</span> 11 Xal
              </div>
              <div className="p-2 bg-[#1a1a1a] rounded-lg border border-white/10">
                <span className="font-bold text-[#F59E0B]">K, Q, J, 10:</span> 10 Xal
              </div>
              <div className="p-2 bg-[#1a1a1a] rounded-lg border border-white/10">
                <span className="font-bold text-[#F59E0B]">9-luq:</span> 9 Xal
              </div>
              <div className="p-2 bg-[#1a1a1a] rounded-lg border border-white/10">
                <span className="font-bold text-[#F59E0B]">8, 7, 6-lıq:</span> 8, 7, 6 Xal
              </div>
            </div>
          </div>

          {/* Special Combinations */}
          <div className="p-4 bg-[#0a0a0a] rounded-xl border border-white/10">
            <h3 className="text-[#F59E0B] font-extrabold text-sm mb-2 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#F59E0B]" />
              Əsas Kombinasiyalar və Xallar (İerarxiya)
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center p-2 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30">
                <span className="font-black text-[#F59E0B]">3 ədəd Tuz (A-A-A)</span>
                <span className="font-extrabold text-[#F59E0B] text-sm">33 Xal (Ən Güclü Əl)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30">
                <span className="font-black text-[#F59E0B]">3 ədəd 6-lıq (6-6-6) — Şeşlər</span>
                <span className="font-extrabold text-[#F59E0B] text-sm">32 Xal (Xüsusi Qayda)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-[#1a1a1a] border border-white/10">
                <span className="font-bold text-white">3 ədəd Karol / Dama / Valet / 10-luq</span>
                <span className="font-bold text-white/70">30 Xal</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-[#1a1a1a] border border-white/10">
                <span className="font-bold text-white">3 ədəd 9-luq</span>
                <span className="font-bold text-white/70">27 Xal</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-[#1a1a1a] border border-white/10">
                <span className="font-bold text-white">3 ədəd 8-lik</span>
                <span className="font-bold text-white/70">24 Xal</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-[#F59E0B]/5 border border-[#F59E0B]/20">
                <span className="font-bold text-[#F59E0B]">2 ədəd Tuz (A-A)</span>
                <span className="font-bold text-[#F59E0B]">22 Xal (Cüt Tuz Qaydası)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-[#1a1a1a] border border-white/10">
                <span className="font-bold text-white">3 ədəd 7-lik</span>
                <span className="font-bold text-white/70">21 Xal</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-[#1a1a1a] border border-white/10">
                <span className="font-bold text-white">Eyni Simvol (Məs: Tuz ♥ + Karol ♥)</span>
                <span className="font-bold text-white/70">21 Xal (11 + 10)</span>
              </div>
            </div>
          </div>

          {/* Gameplay Actions */}
          <div className="p-4 bg-[#0a0a0a] rounded-xl border border-white/10">
            <h3 className="text-[#F59E0B] font-extrabold text-sm mb-2 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#F59E0B]" />
              Oyun Gedişatı və İdarəetmə
            </h3>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-white/70">
              <li>
                <strong className="text-white">Pas et (Fold):</strong> Əldən imtina edir və banka qoyulan vəsaiti itirərək oyundan çıxır.
              </li>
              <li>
                <strong className="text-white">İrəli / Gör (Check/Call):</strong> Əvvəlki oyunçunun qoyduğu mərc məbləğinə bərabərləşir.
              </li>
              <li>
                <strong className="text-white">Artır (Raise):</strong> Banka əlavə mərc qoyaraq növbəti oyunçuların mərclərini artırmağa məcbur edir.
              </li>
              <li>
                <strong className="text-white">Seka et (Qaranlıq):</strong> Kartlara baxmadan kor-koranə gediş edərək rəqiblərə psixoloji təzyiq edir.
              </li>
              <li>
                <strong className="text-white">Baxış (Showdown):</strong> Qalan rəqiblə kartları açaraq ən yüksək xalı müəyyən edir və qalib bankı götürür.
              </li>
              <li>
                <strong className="text-white">50/50 Bölüş (Split):</strong> Son 2 oyunçu qaldıqda bankı bərabər yarıya bölməyi təklif edir.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
