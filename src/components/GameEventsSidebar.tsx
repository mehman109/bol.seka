import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Activity,
  X,
  Flame,
  Trophy,
  Eye,
  Zap,
  ArrowRight,
  Shield,
  Filter,
  Copy,
  Check,
  Trash2,
  Clock,
  Coins,
  Radio,
  Search,
  Sparkles,
} from 'lucide-react';
import { GameEventLog } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface GameEventsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  events: GameEventLog[];
  onClearEvents: () => void;
  currentPot: number;
  currentStake: number;
  roundNumber: number;
  currentUserId?: string;
  roomId: string;
}

type EventFilterType = 'all' | 'bets' | 'folds' | 'wins';

export const GameEventsSidebar: React.FC<GameEventsSidebarProps> = ({
  isOpen,
  onClose,
  events,
  onClearEvents,
  currentPot,
  currentStake,
  roundNumber,
  currentUserId,
  roomId,
}) => {
  const [filter, setFilter] = useState<EventFilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (isOpen && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [events.length, isOpen, filter]);

  // Filtered list
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // Filter category
      if (filter === 'bets') {
        if (!['bet', 'check', 'call', 'raise', 'allin', 'seka'].includes(ev.actionType)) {
          return false;
        }
      } else if (filter === 'folds') {
        if (!['fold', 'showdown', 'split'].includes(ev.actionType)) {
          return false;
        }
      } else if (filter === 'wins') {
        if (!['win', 'standoff'].includes(ev.actionType)) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = ev.playerName.toLowerCase().includes(q);
        const matchDesc = ev.description.toLowerCase().includes(q);
        const matchType = ev.actionType.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchType) return false;
      }

      return true;
    });
  }, [events, filter, searchQuery]);

  const handleCopyLogs = () => {
    const textLines = events.map(
      (e) => `[${e.timeStr}] R#${e.roundNumber || 1} - ${e.playerName}: ${e.description}`
    );
    navigator.clipboard.writeText(textLines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getActionBadge = (ev: GameEventLog) => {
    switch (ev.actionType) {
      case 'raise':
        return {
          label: 'MƏRCİ QALDIRDI',
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: <Flame className="w-3 h-3 text-amber-400" />,
        };
      case 'check':
      case 'call':
        return {
          label: 'YOXLADI / CALL',
          color: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          icon: <Coins className="w-3 h-3 text-blue-400" />,
        };
      case 'bet':
        return {
          label: 'MƏRC ETDİ',
          color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          icon: <Coins className="w-3 h-3 text-indigo-400" />,
        };
      case 'fold':
        return {
          label: 'PAS KEÇDİ',
          color: 'bg-red-500/20 text-red-300 border-red-500/40',
          icon: <X className="w-3 h-3 text-red-400" />,
        };
      case 'allin':
        return {
          label: 'VBANK (ALL-IN)',
          color: 'bg-rose-600/30 text-rose-300 border-rose-500/60 animate-pulse',
          icon: <Zap className="w-3 h-3 text-rose-400" />,
        };
      case 'seka':
        return {
          label: 'TYÖŞKA (2X QARANLIQ)',
          color: 'bg-purple-600/30 text-purple-300 border-purple-500/50',
          icon: <Sparkles className="w-3 h-3 text-purple-400" />,
        };
      case 'showdown':
        return {
          label: 'AÇDIRMA',
          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          icon: <Eye className="w-3 h-3 text-emerald-400" />,
        };
      case 'win':
        return {
          label: 'QALİB (QƏLƏBƏ)',
          color: 'bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-yellow-300 border-yellow-500/60 font-black',
          icon: <Trophy className="w-3.5 h-3.5 text-amber-400" />,
        };
      case 'standoff':
        return {
          label: 'SVAR (QAYNAMA)',
          color: 'bg-orange-500/30 text-orange-300 border-orange-500/60',
          icon: <Flame className="w-3 h-3 text-orange-400" />,
        };
      case 'deal':
        return {
          label: 'KART PAYLANDI',
          color: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
          icon: <Clock className="w-3 h-3 text-slate-400" />,
        };
      default:
        return {
          label: 'SİSTEM',
          color: 'bg-white/10 text-white/70 border-white/20',
          icon: <Shield className="w-3 h-3 text-white/50" />,
        };
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop on mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-xs"
          />

          {/* Sidebar Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 240 }}
            className="absolute top-0 right-0 bottom-0 w-full max-w-md sm:max-w-lg bg-[#0e0e0e] border-l border-[#F59E0B]/30 shadow-2xl flex flex-col z-50 text-white select-none"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-[#18120a] via-[#121212] to-[#18120a] border-b border-[#F59E0B]/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#F59E0B] to-yellow-300 text-black flex items-center justify-center font-black shadow-md shadow-[#F59E0B]/30">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-black text-white tracking-wide">
                      Oyun Hadisələri & Audit
                    </h2>
                    <span className="flex items-center gap-1 bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      CANLI
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-200/60 font-mono">
                    Otaq: #{roomId} • Bütün mərc və hərəkətlər
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 flex items-center justify-center transition active:scale-95 cursor-pointer"
                title="Bağla"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Metrics Strip */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-black/60 border-b border-white/10 text-center">
              <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] text-white/50 uppercase block font-bold">Masa Bankı</span>
                <span className="text-sm font-mono font-black text-[#F59E0B]">
                  {(currentPot || 0).toFixed(2)} ₼
                </span>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] text-white/50 uppercase block font-bold">Masa Mərci</span>
                <span className="text-sm font-mono font-bold text-amber-200">
                  {(currentStake || 0).toFixed(2)} ₼
                </span>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] text-white/50 uppercase block font-bold">Cari Raund</span>
                <span className="text-sm font-mono font-bold text-emerald-400">
                  #{roundNumber || 1}
                </span>
              </div>
            </div>

            {/* Controls Bar: Category Filters & Search */}
            <div className="p-3 bg-[#131313] border-b border-white/10 space-y-2">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                    filter === 'all'
                      ? 'bg-[#F59E0B] text-black shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
                  }`}
                >
                  Hamısı ({events.length})
                </button>
                <button
                  onClick={() => setFilter('bets')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                    filter === 'bets'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
                  }`}
                >
                  Mərclər (Raise / Call)
                </button>
                <button
                  onClick={() => setFilter('folds')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                    filter === 'folds'
                      ? 'bg-red-500 text-white shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
                  }`}
                >
                  Pas / Açdırma
                </button>
                <button
                  onClick={() => setFilter('wins')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                    filter === 'wins'
                      ? 'bg-yellow-400 text-black shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
                  }`}
                >
                  🏆 Qələbələr
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Oyunçu və ya hərəkət axtar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 bg-black/60 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#F59E0B]/60"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Events Log List */}
            <div
              ref={logContainerRef}
              className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-gradient-to-b from-[#0a0a0a] to-[#121212] divide-y divide-white/5"
            >
              {filteredEvents.length === 0 ? (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 text-white/40">
                  <Activity className="w-10 h-10 mb-2 opacity-30 text-[#F59E0B]" />
                  <p className="text-xs font-bold text-white/60">Heç bir hadisə tapılmadı</p>
                  <p className="text-[11px] text-white/40 mt-1 max-w-xs">
                    Masada hər hansı mərc və ya hərəkət baş verdikdə burada anında əks olunacaq.
                  </p>
                </div>
              ) : (
                filteredEvents.map((ev, index) => {
                  const badge = getActionBadge(ev);
                  const isCurrentUser = currentUserId && ev.playerId === currentUserId;

                  return (
                    <motion.div
                      key={ev.id || `event-${index}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`pt-2.5 first:pt-0 flex flex-col gap-1.5 p-2.5 rounded-xl transition ${
                        ev.actionType === 'win'
                          ? 'bg-gradient-to-r from-amber-950/40 via-yellow-950/20 to-black border border-[#F59E0B]/40 shadow-sm'
                          : ev.actionType === 'allin'
                          ? 'bg-red-950/30 border border-red-500/30'
                          : isCurrentUser
                          ? 'bg-white/5 border border-white/10'
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      {/* Top row: Avatar, Name, Time, Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {ev.playerAvatar ? (
                            <img
                              src={ev.playerAvatar}
                              alt={ev.playerName}
                              className="w-5 h-5 rounded-full object-cover border border-white/20 shrink-0"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-[10px] text-[#F59E0B] font-bold shrink-0">
                              ♠
                            </div>
                          )}

                          <span className="text-xs font-bold text-white truncate max-w-[130px] sm:max-w-[160px]">
                            {ev.playerName}
                          </span>

                          {isCurrentUser && (
                            <span className="text-[9px] bg-amber-500 text-black px-1.5 py-0.2 rounded font-black shrink-0">
                              Siz
                            </span>
                          )}

                          {ev.roundNumber && (
                            <span className="text-[10px] text-white/40 font-mono shrink-0">
                              R#{ev.roundNumber}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${badge.color}`}
                          >
                            {badge.icon}
                            <span>{badge.label}</span>
                          </span>

                          <span className="text-[10px] font-mono text-white/40 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {ev.timeStr}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Row: Description & Amount / Pot */}
                      <div className="flex items-center justify-between gap-2 text-xs pl-7">
                        <p className="text-amber-100/90 font-medium break-words leading-relaxed text-[11px] sm:text-xs">
                          {ev.description}
                        </p>

                        {typeof ev.amount === 'number' && ev.amount > 0 && (
                          <div className="font-mono font-black text-amber-300 text-xs shrink-0 bg-black/60 px-2 py-0.5 rounded-lg border border-amber-500/20">
                            +{(ev.amount || 0).toFixed(2)} ₼
                          </div>
                        )}
                      </div>

                      {typeof ev.potAfter === 'number' && ev.potAfter > 0 && (
                        <div className="text-[10px] text-white/40 pl-7 flex items-center gap-1 font-mono">
                          <span>Ümumi Bank:</span>
                          <span className="text-amber-400 font-bold">{(ev.potAfter || 0).toFixed(2)} ₼</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-3 bg-[#121212] border-t border-[#F59E0B]/30 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLogs}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 hover:text-white rounded-xl font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  title="Bütün loqları kopyala"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-green-400 font-bold">Kopyalandı</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-white/60" />
                      <span>Loqları Kopyala</span>
                    </>
                  )}
                </button>

                <button
                  onClick={onClearEvents}
                  className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 hover:text-white rounded-xl transition active:scale-95 flex items-center gap-1 cursor-pointer"
                  title="Loqları Təmizlə"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Təmizlə</span>
                </button>
              </div>

              <div className="text-[10px] text-white/40 font-mono">
                {events.length} Hadisə Qeyd Olundu
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
