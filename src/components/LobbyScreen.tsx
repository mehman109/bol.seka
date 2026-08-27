import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Users, Shield, Flame, Wallet, Gift, User, Home, BookOpen, Headphones, RefreshCw, Settings, Sparkles, X, ArrowRight, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Room, UserProfile, BalanceMode } from '../types';
import { soundManager } from '../utils/audio';

interface LobbyScreenProps {
  user: UserProfile;
  rooms: Room[];
  unreadMessagesCount?: number;
  onJoinRoom: (room: Room, isSpectator?: boolean, balanceMode?: BalanceMode) => void;
  onOpenCreateRoom: () => void;
  onOpenWallet: () => void;
  onOpenDeposit?: () => void;
  onOpenWithdraw?: () => void;
  onOpenBonus: () => void;
  onClaimBonus?: (amount: number) => void;
  onOpenRules: () => void;
  onOpenSupport: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onRefreshRooms: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  user,
  rooms,
  unreadMessagesCount = 0,
  onJoinRoom,
  onOpenCreateRoom,
  onOpenWallet,
  onOpenDeposit,
  onOpenBonus,
  onClaimBonus,
  onOpenRules,
  onOpenSupport,
  onOpenSettings,
  onLogout,
  onRefreshRooms,
}) => {
  const [activeTab, setActiveTab] = useState<'lobby' | 'wallet' | 'bonus' | 'rules' | 'account'>('lobby');
  const [filterStake, setFilterStake] = useState<'all' | 'low' | 'mid' | 'high' | 'seka'>('all');
  const headerScrollRef = useRef<HTMLDivElement>(null);

  const scrollHeader = (direction: 'left' | 'right') => {
    soundManager.playPing();
    if (headerScrollRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      headerScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Table Join & Balance Choice Modal State
  const [selectedRoomForJoin, setSelectedRoomForJoin] = useState<Room | null>(null);
  const [balanceJoinWarning, setBalanceJoinWarning] = useState<string | null>(null);

  const filteredRooms = rooms.filter((r) => {
    if (filterStake === 'low') return r.stake <= 0.5;
    if (filterStake === 'mid') return r.stake > 0.5 && r.stake <= 2.0;
    if (filterStake === 'high') return r.stake > 2.0;
    if (filterStake === 'seka') return r.isSekaOnly;
    return true;
  });

  const handleJoin = (room: Room) => {
    soundManager.playPing();
    const isFull = room.currentPlayers >= room.maxPlayers;
    if (isFull) {
      // Direct spectator mode if table is full
      onJoinRoom(room, true, 'wallet');
    } else {
      // Open Join Modal for balance mode selection
      setBalanceJoinWarning(null);
      setSelectedRoomForJoin(room);
    }
  };

  const handlePlayWithBonus = (room: Room) => {
    const bonusBal = user.bonusBalance || 0;
    if (bonusBal < (room?.stake || 0)) {
      soundManager.playFold();
      setBalanceJoinWarning(
        `Bonus balansınız (${(bonusBal || 0).toFixed(2)} ₼) bu masanın mərci (${((room && room.stake) || 0).toFixed(2)} ₼) üçün kifayət etmir. Zəhmət olmasa "Bonus 5.00 ₼" düyməsindən bonusunuzu aktiv edin!`
      );
      return;
    }
    soundManager.playWin();
    setSelectedRoomForJoin(null);
    onJoinRoom(room, false, 'bonus');
  };

  const handlePlayWithWallet = (room: Room) => {
    if ((user.balance || 0) < room.stake) {
      soundManager.playPing();
      setSelectedRoomForJoin(null);
      // Auto-redirect to Deposit screen as requested
      if (onOpenDeposit) {
        onOpenDeposit();
      } else {
        onOpenWallet();
      }
      return;
    }
    soundManager.playPing();
    setSelectedRoomForJoin(null);
    onJoinRoom(room, false, 'wallet');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col justify-between pb-20 sm:pb-0 relative overflow-hidden font-sans">
      {/* Background dot matrix pattern */}
      <div className="absolute inset-0 bg-dot-pattern opacity-20 pointer-events-none" />

      {/* Top Header / Üst Panel - Bütöv menyu sağa-sola rahat sürüşdürülə və idarə oluna bilən */}
      <header className="sticky top-0 z-30 bg-[#1a1a1a] border-b border-[#F59E0B]/30 shadow-lg select-none relative">
        {/* Left Scroll Button */}
        <button
          onClick={() => scrollHeader('left')}
          title="Menyunu sola sürüşdür"
          className="absolute left-1 top-1/2 -translate-y-1/2 z-40 bg-black/80 hover:bg-black text-[#F59E0B] p-1.5 rounded-r-lg border border-l-0 border-[#F59E0B]/40 shadow-md transition active:scale-90 cursor-pointer hidden xs:flex items-center justify-center"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Right Scroll Button */}
        <button
          onClick={() => scrollHeader('right')}
          title="Menyunu sağa sürüşdür"
          className="absolute right-1 top-1/2 -translate-y-1/2 z-40 bg-black/80 hover:bg-black text-[#F59E0B] p-1.5 rounded-l-lg border border-r-0 border-[#F59E0B]/40 shadow-md transition active:scale-90 cursor-pointer hidden xs:flex items-center justify-center"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div ref={headerScrollRef} className="overflow-x-auto no-scrollbar py-2.5 px-3 sm:px-8 scroll-smooth">
          <div className="flex items-center justify-between gap-3 sm:gap-6 min-w-max max-w-6xl mx-auto touch-pan-x">
            {/* Logo: SEKA CLUB */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-[#F59E0B] via-amber-400 to-yellow-300 p-0.5 shadow-[0_0_15px_rgba(245,158,11,0.3)] shrink-0">
                <div className="w-full h-full bg-[#0a0a0a] rounded-[10px] flex items-center justify-center">
                  <span className="text-base sm:text-lg font-black text-[#F59E0B]">♠</span>
                </div>
              </div>
              <div>
                <div className="font-black text-sm sm:text-base tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-[#F59E0B] font-serif leading-tight">
                  SEKA CLUB
                </div>
                <span className="text-[8px] sm:text-[9px] font-bold text-[#F59E0B]/80 tracking-widest uppercase block">
                  Onlayn Seka Klubu
                </span>
              </div>
            </div>

            {/* Center/Right: Balance + New Room + Settings */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Balans Göstəricisi */}
              <button
                onClick={() => {
                  soundManager.playPing();
                  onOpenWallet();
                }}
                title="Şəxsi Cüzdan və Balans"
                className="flex items-center bg-black/40 hover:bg-black/60 border border-[#F59E0B]/20 hover:border-[#F59E0B]/50 rounded-full px-3.5 py-1.5 shadow-inner transition active:scale-95 cursor-pointer gap-2"
              >
                <div className="flex items-center gap-1">
                  <span className="text-[#F59E0B] font-bold text-xs">₼</span>
                  <span className="font-mono font-bold text-sm sm:text-base text-white">
                    {((user && user.balance) || 0).toFixed(2)}
                  </span>
                </div>
                <span className="bg-[#F59E0B]/15 text-[#F59E0B] text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-[#F59E0B]/30">
                  Cüzdan
                </span>
              </button>

              {/* Bonus Balansı Göstəricisi (0.00 ₼) */}
              <div
                title="Bonus Balansı (Yalnız Oyun Masaları Üçündür)"
                className="flex items-center bg-[#141414] border border-purple-500/40 rounded-full px-3 py-1.5 shadow-inner gap-1.5"
              >
                <Gift className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[10px] text-purple-300/70 font-semibold hidden xs:inline">Bonus:</span>
                <span className="font-mono font-black text-sm text-[#F59E0B]">
                  {((user && user.bonusBalance) || 0).toFixed(2)} ₼
                </span>
              </div>

              {/* Bonus 5.00 AZN Düyməsi */}
              {!user.bonusClaimed && (
                <button
                  onClick={() => {
                    soundManager.playWin();
                    if (onClaimBonus) {
                      onClaimBonus(5.0);
                      confetti({
                        particleCount: 140,
                        spread: 80,
                        origin: { y: 0.2 },
                        colors: ['#F59E0B', '#10B981', '#FFFFFF', '#A855F7'],
                      });
                    }
                  }}
                  title="5.00 AZN Bonusu Dərhal Götür"
                  className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 border border-yellow-300 text-black font-black text-xs sm:text-sm rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.5)] active:scale-95 transition flex items-center gap-1.5 shrink-0 cursor-pointer animate-pulse"
                >
                  <Sparkles className="w-4 h-4 text-black animate-spin" />
                  <span className="font-black whitespace-nowrap">Bonus 5.00 ₼</span>
                </button>
              )}

              {/* Əsas Əməliyyat Düyməsi: + YENİ OTAQ */}
              <button
                onClick={() => {
                  soundManager.playPing();
                  onOpenCreateRoom();
                }}
                className="px-3 sm:px-4 py-2 bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-black font-black text-xs sm:text-sm rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.25)] active:scale-95 transition flex items-center gap-1.5 shrink-0 uppercase tracking-wider cursor-pointer"
              >
                <Plus className="w-4 h-4 font-black" />
                <span className="hidden xs:inline">+ YENİ OTAQ</span>
                <span className="xs:hidden">OTAQ</span>
              </button>

              {/* Ayarlar və Oyunçu Profili Düyməsi (+ Otaq düyməsinin yanında) */}
              <button
                onClick={() => {
                  soundManager.playPing();
                  onOpenSettings();
                }}
                title="Ayarlar və Oyunçu Profili"
                className="relative px-3 sm:px-3.5 py-2 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#F59E0B]/40 hover:border-[#F59E0B] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md active:scale-95 transition flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Settings className="w-4 h-4 text-[#F59E0B]" />
                <span className="hidden sm:inline">Profil</span>
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white font-black text-[11px] px-1.5 py-0.5 rounded-full border-2 border-black animate-bounce shadow-lg">
                    👣
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full p-4 flex-1 space-y-4 relative z-10">
        {/* Quick Lobby Stats & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'all', label: 'Bütün Masalar' },
              { id: 'low', label: '0.10 — 0.50 ₼' },
              { id: 'mid', label: '1.00 — 2.00 ₼' },
              { id: 'high', label: '5.00 ₼ +' },
              { id: 'seka', label: '🔥 Yalnız Seka' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterStake(f.id as typeof filterStake)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 border ${
                  filterStake === f.id
                    ? 'bg-[#F59E0B] text-black border-[#F59E0B] shadow-md font-extrabold'
                    : 'bg-[#1a1a1a] text-white/60 border-white/10 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs text-white/60">
              Aktiv Masalar: <strong className="text-[#F59E0B] font-mono">{filteredRooms.length}</strong>
            </span>
            <button
              onClick={() => {
                soundManager.playPing();
                onRefreshRooms();
              }}
              title="Yenilə"
              className="p-1.5 bg-[#1a1a1a] border border-white/10 hover:border-[#F59E0B]/40 rounded-lg text-white/60 hover:text-[#F59E0B] transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Otaqlar Siyahısı (Card Formatında) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredRooms.map((room) => {
            const isFull = room.currentPlayers >= room.maxPlayers;
            const isWaiting = room.status === 'waiting';

            return (
              <div
                key={room.id}
                className="bg-[#1a1a1a] border border-white/10 hover:border-[#F59E0B]/50 rounded-2xl p-4 shadow-xl flex flex-col justify-between transition group relative overflow-hidden"
              >
                {/* Top of Card */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#F59E0B] font-black text-sm">♠</span>
                        <h4 className="font-extrabold text-sm text-white group-hover:text-[#F59E0B] transition">
                          {room.name}
                        </h4>
                      </div>
                      <span className="text-[11px] text-white/40 font-mono">ID: #{room.id}</span>
                    </div>

                    {/* Table Stake Badge */}
                    <div className="px-2.5 py-1 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/40 text-[#F59E0B] font-black text-xs shrink-0 flex items-center gap-1">
                      <span>Mərc:</span>
                      <strong className="text-[#F59E0B] font-mono">{((room && room.stake) || 0).toFixed(2)} ₼</strong>
                    </div>
                  </div>

                  {/* Badges / Status row */}
                  <div className="flex items-center gap-2 my-3">
                    {/* Status Etiketi: Yaşıl "Gözləyir" və ya Qırmızı "Oyunda" */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 border ${
                        isWaiting
                          ? 'bg-green-900/40 border-green-500/40 text-green-400'
                          : 'bg-red-900/40 border-red-500/40 text-red-400'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                          isWaiting ? 'bg-green-400' : 'bg-red-400'
                        }`}
                      />
                      {isWaiting ? 'Gözləyir' : 'Oyunda'}
                    </span>

                    {/* Oyunçu Sayı Statusu */}
                    <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/40 border border-white/10 text-white/70 text-xs font-mono font-bold">
                      <Users className="w-3.5 h-3.5 text-white/50" />
                      <span>
                        {room.currentPlayers} / {room.maxPlayers}
                      </span>
                    </div>

                    {room.isSekaOnly && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-900/40 border border-purple-500/30 text-purple-300 text-[10px] font-bold flex items-center gap-1">
                        <Flame className="w-3 h-3 text-purple-400" /> Seka
                      </span>
                    )}

                    {room.isPrivate && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-900/40 border border-blue-500/30 text-blue-300 text-[10px] font-bold flex items-center gap-1">
                        <Shield className="w-3 h-3 text-blue-400" /> Qapalı
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Button: Əgər masa doludursa "İzlə", boş yer varsa "Otur / Qoşul" */}
                <button
                  onClick={() => handleJoin(room)}
                  className={`w-full py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 ${
                    isFull
                      ? 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
                      : 'bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-black shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                  }`}
                >
                  {isFull ? (
                    <>
                      <span>👁️ Masanı İzlə</span>
                    </>
                  ) : (
                    <>
                      <span>💺 Otur / Qoşul ({((room && room.stake) || 0).toFixed(2)} ₼)</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </main>

      {/* Aşağı Naviqasiya Paneli (Bottom Nav): Əsas səhifə (Aktiv) | Cüzdan | Bonus | Qaydalar | Hesab */}
      <nav className="fixed sm:relative bottom-0 left-0 right-0 z-30 bg-[#111] border-t border-white/5 px-4 py-2">
        <div className="max-w-md mx-auto flex items-center justify-around">
          <button
            onClick={() => setActiveTab('lobby')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
              activeTab === 'lobby' ? 'text-[#F59E0B] font-bold' : 'text-white/50 hover:text-white'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px]">Əsas səhifə</span>
          </button>

          <button
            onClick={() => {
              soundManager.playPing();
              onOpenWallet();
            }}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-white/50 hover:text-[#F59E0B] transition"
          >
            <Wallet className="w-5 h-5" />
            <span className="text-[10px]">Cüzdan</span>
          </button>

          <button
            onClick={() => {
              soundManager.playPing();
              onOpenBonus();
            }}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-white/50 hover:text-[#F59E0B] transition relative"
          >
            <Gift className="w-5 h-5 text-[#F59E0B]" />
            <span className="absolute top-1 right-3 w-2 h-2 bg-[#F59E0B] rounded-full animate-ping" />
            <span className="text-[10px] text-[#F59E0B] font-bold">Bonus</span>
          </button>

          <button
            onClick={() => {
              soundManager.playPing();
              onOpenRules();
            }}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-white/50 hover:text-white transition"
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px]">Qaydalar</span>
          </button>

          <button
            onClick={() => {
              soundManager.playPing();
              onOpenSettings();
            }}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-white/50 hover:text-[#F59E0B] transition relative"
          >
            <User className="w-5 h-5" />
            <span className="text-[10px]">Profil</span>
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-1 right-2 bg-red-600 text-white font-black text-[10px] px-1 rounded-full animate-bounce shadow">
                👣
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Floating Support Button on Lobby */}
      <div className="fixed bottom-18 sm:bottom-6 right-4 z-20">
        <button
          onClick={onOpenSupport}
          title="Canlı Dəstək"
          className="w-12 h-12 rounded-full bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-black flex items-center justify-center shadow-lg shadow-[#F59E0B]/30 transition hover:scale-105 active:scale-95 font-bold"
        >
          <Headphones className="w-5 h-5 font-black" />
        </button>
      </div>

      {/* Masaya Giriş və Balans Seçimi Modalı */}
      <AnimatePresence>
        {selectedRoomForJoin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              className="bg-[#181818] border border-[#F59E0B]/40 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 text-white relative overflow-hidden"
            >
              {/* Top ambient glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-[#F59E0B]/20 blur-2xl pointer-events-none" />

              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3.5 relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#F59E0B] to-amber-300 p-0.5 shadow-md">
                    <div className="w-full h-full bg-[#0a0a0a] rounded-[10px] flex items-center justify-center">
                      <span className="text-base font-black text-[#F59E0B]">♠</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">
                      {selectedRoomForJoin.name}
                    </h3>
                    <p className="text-[11px] text-white/50">Masa Mərci: <strong className="text-[#F59E0B] font-mono">{((selectedRoomForJoin && selectedRoomForJoin.stake) || 0).toFixed(2)} ₼</strong></p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedRoomForJoin(null)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Notice text */}
              <div className="text-center relative z-10">
                <h4 className="text-base font-black text-white mb-1">
                  Masa Balansını Seçin
                </h4>
                <p className="text-xs text-white/60 leading-relaxed">
                  Bu masada oynamaq üçün istifadə etmək istədiyiniz balansı seçin:
                </p>
              </div>

              {/* Balans Kartları İcmalı */}
              <div className="grid grid-cols-2 gap-3 relative z-10">
                {/* Bonus Balansı Kartı */}
                <div className="bg-[#111] border border-white/10 rounded-2xl p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-white/60 flex items-center gap-1">
                      <Gift className="w-3.5 h-3.5 text-[#F59E0B]" /> Bonus
                    </span>
                    {(user.bonusBalance || 0) >= (selectedRoomForJoin?.stake || 0) ? (
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-yellow-500/50" />
                    )}
                  </div>
                  <div className="text-lg font-mono font-extrabold text-[#F59E0B]">
                    {((user && user.bonusBalance) || 0).toFixed(2)} ₼
                  </div>
                  <span className="text-[10px] text-white/40 mt-1">
                    {(user.bonusBalance || 0) >= (selectedRoomForJoin?.stake || 0)
                      ? 'Oynamaq mümkündür'
                      : 'Kifayət deyil'}
                  </span>
                </div>

                {/* Cüzdan Real Balansı Kartı */}
                <div className="bg-[#111] border border-white/10 rounded-2xl p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-white/60 flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5 text-blue-400" /> Cüzdan
                    </span>
                    {(user.balance || 0) >= (selectedRoomForJoin?.stake || 0) ? (
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-red-500/50" />
                    )}
                  </div>
                  <div className="text-lg font-mono font-extrabold text-white">
                    {((user && user.balance) || 0).toFixed(2)} ₼
                  </div>
                  <span className="text-[10px] text-white/40 mt-1">
                    {(user.balance || 0) >= (selectedRoomForJoin?.stake || 0)
                      ? 'Oynamaq mümkündür'
                      : '0.00 ₼ (Depozit edin)'}
                  </span>
                </div>
              </div>

              {/* Warning Alert if bonus insufficient */}
              {balanceJoinWarning && (
                <div className="p-3 rounded-2xl bg-amber-950/60 border border-[#F59E0B]/50 text-amber-200 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p>{balanceJoinWarning}</p>
                    <button
                      onClick={() => {
                        setSelectedRoomForJoin(null);
                        onOpenBonus();
                      }}
                      className="mt-2 text-xs font-black text-black bg-[#F59E0B] hover:bg-[#F59E0B]/90 px-3 py-1 rounded-lg transition inline-flex items-center gap-1"
                    >
                      <Gift className="w-3.5 h-3.5" />
                      <span>5.00 ₼ Bonusu Aktiv Et</span>
                    </button>
                  </div>
                </div>
              )}

              {/* İki Əsas Seçim Düyməsi */}
              <div className="space-y-3 relative z-10 pt-1">
                {/* 1. Bonus Balans İlə Oyna */}
                <button
                  type="button"
                  onClick={() => handlePlayWithBonus(selectedRoomForJoin)}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 via-[#F59E0B] to-yellow-500 hover:brightness-110 text-black font-black rounded-2xl text-xs sm:text-sm transition shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-[0.98] uppercase tracking-wider flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-black" />
                    <span>Bonus Balans ilə Oyna</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono font-bold text-xs bg-black/15 px-2.5 py-1 rounded-xl">
                    <span>{((user && user.bonusBalance) || 0).toFixed(2)} ₼</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                  </div>
                </button>

                {/* 2. Cüzdan Balansı İlə Oyna */}
                <button
                  type="button"
                  onClick={() => handlePlayWithWallet(selectedRoomForJoin)}
                  className="w-full py-3.5 px-4 bg-[#222] hover:bg-[#282828] border border-white/15 hover:border-[#F59E0B]/50 text-white font-bold rounded-2xl text-xs sm:text-sm transition active:scale-[0.98] uppercase tracking-wider flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#F59E0B]" />
                    <span>Cüzdan Balansı ilə Oyna</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono font-bold text-xs bg-white/10 px-2.5 py-1 rounded-xl">
                    <span>{((user && user.balance) || 0).toFixed(2)} ₼</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                  </div>
                </button>
              </div>

              {/* Alt İzah */}
              <p className="text-[11px] text-white/40 text-center relative z-10">
                💡 Cüzdan balansı 0.00 ₼ olan zaman "Cüzdan Balansı ilə Oyna" seçildikdə sistem dərhal depozit pəncərəsini açır.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
