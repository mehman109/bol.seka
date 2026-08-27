import React, { useState } from 'react';
import { X, Plus, Shield, Users, Flame } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: (roomData: {
    name: string;
    stake: number;
    maxPlayers: number;
    isSekaOnly: boolean;
    isPrivate: boolean;
  }) => void;
  userBalance: number;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onCreateRoom,
  userBalance,
}) => {
  const [stake, setStake] = useState<number>(0.20);
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [isSekaOnly, setIsSekaOnly] = useState<boolean>(false);
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [roomName, setRoomName] = useState<string>('');

  if (!isOpen) return null;

  const stakeOptions = [0.10, 0.20, 0.50, 1.00, 2.00, 5.00, 10.00];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userBalance < stake) {
      alert('Balansınız bu masaya oturmaq üçün kifayət etmir!');
      return;
    }
    soundManager.playChip();
    onCreateRoom({
      name: roomName.trim() || `Oyun otağı #${Math.floor(100000 + Math.random() * 900000)}`,
      stake,
      maxPlayers,
      isSekaOnly,
      isPrivate,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in font-sans">
      <div className="bg-[#1a1a1a] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-[#111] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/20 border border-[#F59E0B]/40 flex items-center justify-center text-[#F59E0B] font-black">
              +
            </div>
            <h2 className="text-base font-black text-[#F59E0B] tracking-wide">Yeni Seka Masası Yarat</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 text-white/60 hover:text-white flex items-center justify-center hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-white/70 mb-1">Masa Adı (İxtiyari)</label>
            <input
              type="text"
              placeholder="Məs: Bakı Ulduzları Masası"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#F59E0B]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-white/70 mb-2">Masa Mərci (₼)</label>
            <div className="grid grid-cols-4 gap-2">
              {stakeOptions.map((stk) => (
                <button
                  key={stk}
                  type="button"
                  onClick={() => setStake(stk)}
                  className={`py-2 px-1 rounded-xl text-xs font-black transition border font-mono ${
                    stake === stk
                      ? 'bg-[#F59E0B] text-black border-[#F59E0B] shadow-md'
                      : 'bg-[#0a0a0a] text-white/70 border-white/10 hover:border-white/20'
                  }`}
                >
                  {stk.toFixed(2)} ₼
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-white/70 mb-2">Maksimum Oyunçu Sayı</label>
            <div className="grid grid-cols-3 gap-2">
              {[2, 3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setMaxPlayers(count)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                    maxPlayers === count
                      ? 'bg-[#F59E0B] text-black border-[#F59E0B]'
                      : 'bg-[#0a0a0a] text-white/70 border-white/10'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{count} Oyunçu</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-white/10">
            <label className="flex items-center gap-3 p-2.5 rounded-xl bg-[#0a0a0a] border border-white/10 cursor-pointer">
              <input
                type="checkbox"
                checked={isSekaOnly}
                onChange={(e) => setIsSekaOnly(e.target.checked)}
                className="w-4 h-4 accent-[#F59E0B] rounded"
              />
              <div className="flex items-center gap-1.5 text-xs text-white/90 font-bold">
                <Flame className="w-4 h-4 text-[#F59E0B]" />
                <span>Yalnız Seka (Qaranlıq) rejimi</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-2.5 rounded-xl bg-[#0a0a0a] border border-white/10 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4 accent-[#F59E0B] rounded"
              />
              <div className="flex items-center gap-1.5 text-xs text-white/90 font-bold">
                <Shield className="w-4 h-4 text-green-400" />
                <span>Dostlar üçün qapalı masa</span>
              </div>
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-black font-black rounded-xl text-sm transition shadow-lg shadow-[#F59E0B]/20 active:scale-[0.98] flex items-center justify-center gap-2 mt-4 uppercase tracking-wider"
          >
            <Plus className="w-4 h-4 font-black" />
            Masanı Başlat ({stake.toFixed(2)} ₼)
          </button>
        </form>
      </div>
    </div>
  );
};
