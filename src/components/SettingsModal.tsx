import React, { useState, useMemo } from 'react';
import { 
  X, 
  User, 
  Settings as SettingsIcon, 
  ShieldCheck, 
  Copy, 
  Check, 
  Trophy, 
  Flame, 
  Headphones, 
  Volume2, 
  VolumeX, 
  Wallet, 
  Sparkles,
  LogOut,
  Edit2,
  MessageSquare,
  Send,
  Trash2,
  Search,
  UserPlus,
  Lightbulb,
  AlertCircle,
  MessageCircle,
  Clock
} from 'lucide-react';
import { UserProfile, PlayerMessage } from '../types';
import { soundManager } from '../utils/audio';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  allUsers?: UserProfile[];
  playerMessages?: PlayerMessage[];
  onOpenSupport: () => void;
  onOpenWallet: () => void;
  onLogout: () => void;
  onUpdateUser?: (updated: Partial<UserProfile>) => void;
  onSendPlayerMessage?: (toUserId: string, toUsername: string, text: string, category?: 'proposal' | 'critique' | 'general') => Promise<boolean>;
  onDeletePlayerMessage?: (messageId: string) => Promise<void>;
  onMarkMessageAsRead?: (messageId: string) => Promise<void>;
  initialTab?: 'profile' | 'messages';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  allUsers = [],
  playerMessages = [],
  onOpenSupport,
  onOpenWallet,
  onLogout,
  onUpdateUser,
  onSendPlayerMessage,
  onDeletePlayerMessage,
  onMarkMessageAsRead,
  initialTab = 'profile',
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'messages'>(initialTab);
  const [copied, setCopied] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newUsername, setNewUsername] = useState(user.username);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Messaging State
  const [selectedRecipient, setSelectedRecipient] = useState<{ id: string; username: string; avatar?: string } | null>(null);
  const [messageCategory, setMessageCategory] = useState<'proposal' | 'critique' | 'general'>('proposal');
  const [messageText, setMessageText] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [isAddingNewChat, setIsAddingNewChat] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const winRate = user.gamesPlayed > 0 
    ? Math.round((user.gamesWon / user.gamesPlayed) * 100) 
    : 0;

  // Unread messages count for this user
  const unreadCount = playerMessages.filter(
    (m) => m.toUserId === user.id && !m.read
  ).length;

  // Distinct conversation partners
  const conversationPartners = useMemo(() => {
    const map = new Map<string, { id: string; username: string; avatar?: string; lastMsg?: PlayerMessage; unread: number }>();

    playerMessages.forEach((msg) => {
      const isMeSender = msg.fromUserId === user.id;
      const partnerId = isMeSender ? msg.toUserId : msg.fromUserId;
      const partnerName = isMeSender ? msg.toUsername : msg.fromUsername;
      const partnerAvatar = isMeSender ? undefined : msg.fromAvatar;

      if (!partnerId || partnerId === user.id) return;

      if (!map.has(partnerId)) {
        // Find in allUsers if available
        const found = allUsers.find((u) => u.id === partnerId);
        map.set(partnerId, {
          id: partnerId,
          username: partnerName || found?.username || 'Oyunçu',
          avatar: partnerAvatar || found?.avatar,
          lastMsg: msg,
          unread: (!isMeSender && !msg.read) ? 1 : 0,
        });
      } else {
        const item = map.get(partnerId)!;
        if (!isMeSender && !msg.read) {
          item.unread += 1;
        }
      }
    });

    return Array.from(map.values());
  }, [playerMessages, user.id, allUsers]);

  // Current active conversation messages
  const currentConversationMessages = useMemo(() => {
    if (!selectedRecipient) return [];
    return playerMessages.filter(
      (m) =>
        (m.fromUserId === user.id && m.toUserId === selectedRecipient.id) ||
        (m.fromUserId === selectedRecipient.id && m.toUserId === user.id)
    ).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  }, [playerMessages, user.id, selectedRecipient]);

  // Filtered registered users to start new chat
  const filteredUsersToStart = useMemo(() => {
    const query = userSearch.toLowerCase().trim();
    return allUsers.filter((u) => {
      if (u.id === user.id) return false;
      if (!query) return true;
      return (
        u.username.toLowerCase().includes(query) ||
        u.id.toLowerCase().includes(query)
      );
    });
  }, [allUsers, user.id, userSearch]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    soundManager.playPing();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveUsername = () => {
    if (newUsername.trim() && onUpdateUser) {
      onUpdateUser({ username: newUsername.trim() });
    }
    setIsEditingName(false);
  };

  const handleAvatarChange = () => {
    if (onUpdateUser) {
      const seed = Math.random().toString(36).substring(7);
      const newAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
      onUpdateUser({ avatar: newAvatar });
      soundManager.playPing();
    }
  };

  const toggleSound = () => {
    const isMuted = soundManager.toggleMute();
    setSoundEnabled(!isMuted);
  };

  const handleSelectPartner = (partner: { id: string; username: string; avatar?: string }) => {
    setSelectedRecipient(partner);
    setIsAddingNewChat(false);
    // Mark unread incoming messages as read
    playerMessages
      .filter((m) => m.fromUserId === partner.id && m.toUserId === user.id && !m.read && m.id)
      .forEach((m) => {
        if (onMarkMessageAsRead && m.id) {
          onMarkMessageAsRead(m.id);
        }
      });
  };

  const handleSendMessage = async () => {
    if (!selectedRecipient || !messageText.trim() || isSending) return;
    setIsSending(true);
    try {
      if (onSendPlayerMessage) {
        await onSendPlayerMessage(
          selectedRecipient.id,
          selectedRecipient.username,
          messageText.trim(),
          messageCategory
        );
        setMessageText('');
        soundManager.playPing();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in font-sans">
      <div className="bg-[#161616] border border-[#F59E0B]/40 w-full max-w-xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-[#111] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F59E0B]/20 border border-[#F59E0B]/40 flex items-center justify-center text-[#F59E0B]">
              {activeTab === 'profile' ? (
                <SettingsIcon className="w-5 h-5" />
              ) : (
                <MessageSquare className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-wide flex items-center gap-2">
                <span>{activeTab === 'profile' ? 'Profil və Tənzimləmələr' : 'Oyunçularla Mesajlaşma'}</span>
              </h2>
              <p className="text-[11px] text-[#F59E0B]/90 font-medium">
                {activeTab === 'profile'
                  ? 'Oyunçu statistikası, ayarlar və admin əlaqəsi'
                  : 'Oyunçulara təklif və iradlarınızı birbaşa göndərin'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 text-white/60 hover:text-white flex items-center justify-center hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="flex border-b border-white/10 bg-[#121212] px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 text-xs font-black rounded-t-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-[#161616] text-[#F59E0B] border-t-2 border-[#F59E0B]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profil & Statistikalar</span>
          </button>

          <button
            onClick={() => setActiveTab('messages')}
            className={`px-4 py-2 text-xs font-black rounded-t-xl transition flex items-center gap-2 cursor-pointer relative ${
              activeTab === 'messages'
                ? 'bg-[#161616] text-[#F59E0B] border-t-2 border-[#F59E0B]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Təklif & İrad Mesajları</span>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white font-black text-[10px] px-1.5 py-0.2 rounded-full animate-bounce">
                👣 {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Modal Content */}
        {activeTab === 'profile' ? (
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-left">
            {/* User Profile Card */}
            <div className="p-4 rounded-2xl bg-[#111] border border-white/10 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                {/* Avatar */}
                <div className="relative group">
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl object-cover bg-black/50 border-2 border-[#F59E0B] shadow-lg p-0.5"
                  />
                  <button
                    onClick={handleAvatarChange}
                    title="Avatarı dəyiş"
                    className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-[#F59E0B] hover:bg-amber-400 text-black rounded-lg shadow-md transition cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-3 h-3 font-bold" />
                  </button>
                </div>

                {/* Info Details */}
                <div className="flex-1 text-center sm:text-left space-y-1.5 w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    {isEditingName ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          className="bg-black/60 border border-[#F59E0B] rounded-lg px-2.5 py-1 text-sm text-white font-bold focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveUsername}
                          className="px-2.5 py-1 bg-[#F59E0B] text-black font-black text-xs rounded-lg hover:bg-amber-400"
                        >
                          Saxla
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center sm:justify-start gap-2">
                        <h3 className="font-black text-lg text-white tracking-wide">{user.username}</h3>
                        <button
                          onClick={() => setIsEditingName(true)}
                          className="text-white/40 hover:text-[#F59E0B] p-1 transition"
                          title="İstifadəçi adını dəyiş"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full bg-green-950/70 border border-green-500/40 text-green-400 text-[10px] font-bold">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Qeydiyyatlı İstifadəçi</span>
                    </div>
                  </div>

                  {/* Player ID */}
                  <div className="flex items-center justify-center sm:justify-start gap-2 pt-0.5">
                    <span className="text-xs text-white/50 font-mono">ID: #{user.id}</span>
                    <button
                      onClick={handleCopyId}
                      className="flex items-center gap-1 text-[11px] text-[#F59E0B] hover:underline font-semibold bg-white/5 px-2 py-0.5 rounded border border-white/10"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-green-400" />
                          <span className="text-green-400">Kopyalandı!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Kopyala</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Balans & Cüzdana keçid */}
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-white/50">Cari Balans:</span>
                      <span className="font-mono font-black text-base text-[#F59E0B]">
                        {user.balance.toFixed(2)} ₼
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenWallet();
                      }}
                      className="px-3 py-1 bg-[#F59E0B]/20 hover:bg-[#F59E0B]/30 border border-[#F59E0B]/40 text-[#F59E0B] font-bold text-xs rounded-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      <span>Cüzdan</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Switch to Player Messaging */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-[#121926] to-blue-950/40 border border-blue-500/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-300 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">Oyunçularla Mesajlaşma (Təklif & İrad)</h4>
                  <p className="text-[10px] text-white/60">Dostlarınıza və digər oyunçulara fikirlərinizi yazın</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('messages')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <span>Mesajlara Keç</span>
                {unreadCount > 0 && <span className="bg-white text-blue-900 px-1.5 py-0.2 rounded-full text-[10px]">👣 {unreadCount}</span>}
              </button>
            </div>

            {/* Player Statistics Grid */}
            <div>
              <h4 className="text-xs font-black text-white/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>Oyun Statistikası və Nailiyyətlər</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 bg-[#111] border border-white/10 rounded-xl text-center">
                  <span className="text-[10px] text-white/50 block font-medium">Oynanılan Oyun</span>
                  <span className="font-mono font-black text-lg text-white">{user.gamesPlayed}</span>
                </div>
                <div className="p-3 bg-[#111] border border-white/10 rounded-xl text-center">
                  <span className="text-[10px] text-white/50 block font-medium">Qələbələr</span>
                  <span className="font-mono font-black text-lg text-green-400">{user.gamesWon}</span>
                </div>
                <div className="p-3 bg-[#111] border border-white/10 rounded-xl text-center">
                  <span className="text-[10px] text-white/50 block font-medium">Qazanma Faizi</span>
                  <span className="font-mono font-black text-lg text-[#F59E0B]">{winRate}%</span>
                </div>
                <div className="p-3 bg-[#111] border border-white/10 rounded-xl text-center">
                  <span className="text-[10px] text-white/50 block font-medium">Maks Bank</span>
                  <span className="font-mono font-black text-lg text-amber-300">
                    {(user.biggestPotWon || 0).toFixed(2)} ₼
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Support & Admin Contact Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-[#1e1a12] to-amber-950/40 border-2 border-[#F59E0B]/50 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3 text-center sm:text-left">
                <div className="w-11 h-11 rounded-2xl bg-[#F59E0B] text-black flex items-center justify-center shrink-0 shadow-md">
                  <Headphones className="w-6 h-6 font-black" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">Dəstək Xidməti / Adminlə Əlaqə</h4>
                  <p className="text-xs text-white/60 mt-0.5">Adminə birbaşa mesaj və təklif göndərin</p>
                </div>
              </div>

              <button
                onClick={() => {
                  onClose();
                  onOpenSupport();
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-black font-black text-xs rounded-xl transition shadow-[0_0_15px_rgba(245,158,11,0.3)] uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 cursor-pointer shrink-0"
              >
                <Headphones className="w-4 h-4 font-black" />
                <span>Adminə Mesaj Yaz</span>
              </button>
            </div>

            {/* Sound Settings */}
            <div className="p-3.5 rounded-xl bg-[#111] border border-white/10 space-y-3">
              <h4 className="text-xs font-black text-white/70 uppercase tracking-wider">
                Səs və İnterfeys Tənzimləmələri
              </h4>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-red-400" />
                  )}
                  <div>
                    <span className="text-xs font-bold text-white block">Oyun və Kart Səsləri</span>
                    <span className="text-[10px] text-white/40">Mərclər, qalibiyyət və kart paylama effektləri</span>
                  </div>
                </div>

                <button
                  onClick={toggleSound}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                    soundEnabled
                      ? 'bg-green-600/30 border-green-500 text-green-300'
                      : 'bg-red-600/20 border-red-500/40 text-red-300'
                  }`}
                >
                  {soundEnabled ? 'Açıq' : 'Bağlı'}
                </button>
              </div>
            </div>

            {/* Logout Action */}
            <div className="pt-2">
              <button
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="w-full py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Hesabdan Çıxış</span>
              </button>
            </div>
          </div>
        ) : (
          /* =========================================================
             MESSAGING TAB (Oyunçularla Mesajlaşma, Təklif və İradlar)
             ========================================================= */
          <div className="flex-1 flex flex-col p-4 sm:p-5 overflow-hidden text-left space-y-3">
            {/* Conversation Selector / Header */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
              {selectedRecipient ? (
                <div className="flex items-center gap-2.5">
                  <img
                    src={selectedRecipient.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedRecipient.id}`}
                    alt={selectedRecipient.username}
                    className="w-8 h-8 rounded-xl bg-black border border-white/10"
                  />
                  <div>
                    <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                      <span>{selectedRecipient.username}</span>
                      <span className="text-[10px] text-white/40 font-mono">#{selectedRecipient.id.slice(0, 6)}</span>
                    </h4>
                    <span className="text-[10px] text-green-400 font-semibold">● Birbaşa Çat</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-white/70 text-xs font-bold">
                  <MessageCircle className="w-4 h-4 text-[#F59E0B]" />
                  <span>Oyunçu Çatları və Təkliflər</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                {selectedRecipient && (
                  <button
                    onClick={() => setSelectedRecipient(null)}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/70 text-xs rounded-lg transition"
                  >
                    Bütün Çatlar
                  </button>
                )}
                <button
                  onClick={() => setIsAddingNewChat(!isAddingNewChat)}
                  className="px-3 py-1.5 bg-[#F59E0B] hover:bg-amber-400 text-black font-black text-xs rounded-xl transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-md"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Oyunçu Əlavə Et</span>
                </button>
              </div>
            </div>

            {/* New Chat Picker Modal/Drawer */}
            {isAddingNewChat && (
              <div className="p-3 bg-[#111] border border-[#F59E0B]/40 rounded-2xl space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-[#F59E0B]" />
                    <span>Çata Yeni Oyunçu Əlavə Et</span>
                  </span>
                  <button
                    onClick={() => setIsAddingNewChat(false)}
                    className="text-white/40 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="İstifadəçi adı və ya ID ilə axtarış..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#F59E0B]"
                    autoFocus
                  />
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 divide-y divide-white/5">
                  {filteredUsersToStart.length === 0 ? (
                    <div className="p-3 text-center text-white/40 text-xs">
                      Uyğun oyunçu tapılmadı.
                    </div>
                  ) : (
                    filteredUsersToStart.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleSelectPartner(p)}
                        className="w-full p-2 hover:bg-white/5 rounded-xl flex items-center justify-between transition cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={p.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.id}`}
                            alt={p.username}
                            className="w-7 h-7 rounded-lg bg-black border border-white/10"
                          />
                          <div>
                            <div className="text-xs font-bold text-white">{p.username}</div>
                            <div className="text-[10px] text-white/40 font-mono">ID: #{p.id.slice(0, 8)}</div>
                          </div>
                        </div>
                        <span className="text-[11px] text-[#F59E0B] font-bold">Mesaj Yaz →</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Body: Either Conversation List OR Active Conversation Messages */}
            {!selectedRecipient ? (
              /* Conversation Partner List */
              <div className="flex-1 overflow-y-auto space-y-2">
                {conversationPartners.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 text-white/30 flex items-center justify-center mx-auto">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Hələ heç bir mesajınız yoxdur</h4>
                      <p className="text-xs text-white/50 max-w-xs mx-auto mt-1">
                        Yuxarıdakı <strong>"+ Oyunçu Əlavə Et"</strong> düyməsinə basaraq digər oyunçulara təklif və fikirlərinizi bildirin.
                      </p>
                    </div>
                  </div>
                ) : (
                  conversationPartners.map((partner) => (
                    <button
                      key={partner.id}
                      onClick={() => handleSelectPartner(partner)}
                      className="w-full p-3 bg-[#111] hover:bg-[#1a1a1a] border border-white/10 hover:border-[#F59E0B]/40 rounded-2xl flex items-center justify-between gap-3 transition cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={partner.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${partner.id}`}
                            alt={partner.username}
                            className="w-10 h-10 rounded-xl bg-black border border-white/10 object-cover"
                          />
                          {partner.unread > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white font-black text-[9px] px-1.5 rounded-full border border-black animate-pulse">
                              👣 {partner.unread}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-white">{partner.username}</span>
                            <span className="text-[10px] text-white/40 font-mono">#{partner.id.slice(0, 6)}</span>
                          </div>
                          {partner.lastMsg && (
                            <p className="text-[11px] text-white/60 truncate max-w-xs mt-0.5 flex items-center gap-1">
                              {partner.lastMsg.category === 'proposal' && <span className="text-yellow-400">💡</span>}
                              {partner.lastMsg.category === 'critique' && <span className="text-red-400">✍️</span>}
                              <span>{partner.lastMsg.text}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        {partner.lastMsg && (
                          <span className="text-[10px] text-white/40 font-mono block">
                            {partner.lastMsg.date.slice(11, 16)}
                          </span>
                        )}
                        <span className="text-xs text-[#F59E0B] font-bold">Aç →</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              /* Active Messages Timeline & Message Form */
              <div className="flex-1 flex flex-col overflow-hidden space-y-3">
                {/* Messages Box */}
                <div className="flex-1 overflow-y-auto space-y-2.5 p-3 rounded-2xl bg-black/40 border border-white/5 max-h-[300px]">
                  {currentConversationMessages.length === 0 ? (
                    <div className="text-center py-8 text-white/40 text-xs">
                      {selectedRecipient.username} ilə hələ mesajlaşma olmayıb. İlk mesajı siz yazın!
                    </div>
                  ) : (
                    currentConversationMessages.map((msg) => {
                      const isMe = msg.fromUserId === user.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl p-3 text-xs relative ${
                              isMe
                                ? 'bg-gradient-to-r from-amber-600/90 to-[#F59E0B] text-black font-semibold shadow-md rounded-tr-none'
                                : 'bg-[#1e1e1e] border border-white/10 text-white shadow rounded-tl-none'
                            }`}
                          >
                            {/* Category Tag */}
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                  msg.category === 'proposal'
                                    ? isMe ? 'bg-black/20 text-black' : 'bg-yellow-950 text-yellow-300 border border-yellow-500/30'
                                    : msg.category === 'critique'
                                    ? isMe ? 'bg-black/20 text-black' : 'bg-red-950 text-red-300 border border-red-500/30'
                                    : isMe ? 'bg-black/20 text-black' : 'bg-blue-950 text-blue-300 border border-blue-500/30'
                                }`}
                              >
                                {msg.category === 'proposal'
                                  ? '💡 Təklif'
                                  : msg.category === 'critique'
                                  ? '✍️ İrad / Rəy'
                                  : '💬 Söhbət'}
                              </span>

                              {isMe && msg.id && onDeletePlayerMessage && (
                                <button
                                  onClick={() => onDeletePlayerMessage(msg.id!)}
                                  title="Mesajı sil"
                                  className="text-black/60 hover:text-black p-0.5"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>

                            <div
                              className={`text-[9px] font-mono mt-1 text-right ${
                                isMe ? 'text-black/60' : 'text-white/40'
                              }`}
                            >
                              {msg.date.slice(11, 16)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Message Category Selector */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-white/50 font-bold">Növ:</span>
                  <button
                    type="button"
                    onClick={() => setMessageCategory('proposal')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
                      messageCategory === 'proposal'
                        ? 'bg-yellow-500 text-black font-black shadow'
                        : 'bg-white/5 text-white/60 hover:text-white'
                    }`}
                  >
                    <Lightbulb className="w-3 h-3" />
                    <span>💡 Təklif</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageCategory('critique')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
                      messageCategory === 'critique'
                        ? 'bg-red-500 text-white font-black shadow'
                        : 'bg-white/5 text-white/60 hover:text-white'
                    }`}
                  >
                    <AlertCircle className="w-3 h-3" />
                    <span>✍️ İrad / Rəy</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageCategory('general')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
                      messageCategory === 'general'
                        ? 'bg-blue-500 text-white font-black shadow'
                        : 'bg-white/5 text-white/60 hover:text-white'
                    }`}
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span>💬 Ümumi</span>
                  </button>
                </div>

                {/* Input & Send Button */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`${selectedRecipient.username} üçün ${messageCategory === 'proposal' ? 'təklifinizi' : messageCategory === 'critique' ? 'iradınızı' : 'mesajınızı'} yazın...`}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="flex-1 bg-[#111] border border-white/10 focus:border-[#F59E0B] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || isSending}
                    className="p-2.5 bg-[#F59E0B] hover:bg-amber-400 disabled:opacity-40 text-black rounded-xl transition shadow-md active:scale-95 cursor-pointer font-bold shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
