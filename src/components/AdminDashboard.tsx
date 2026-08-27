import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldAlert,
  Users,
  CreditCard,
  MessageSquare,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  RefreshCw,
  Eye,
  Send,
  PlusCircle,
  MinusCircle,
  Activity,
  Award,
  Wallet,
  Sparkles,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Bell,
  BellRing,
  Layers,
  Tv,
  Flame,
  Sliders,
  Plus,
  Minus,
  AlertTriangle,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  Trash2,
  UserX,
  History,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { UserProfile, DepositReceipt, Room, TableRake, ActivityLog } from '../types';
import {
  subscribeToAllUsers,
  subscribeToPendingDeposits,
  subscribeToAllAdminMessages,
  subscribeToTableRakes,
  subscribeToActivityLogs,
  subscribeToRoomsInFirestore,
  createRoomInFirestore,
  kickPlayerFromRoomInFirestore,
  approveDepositInFirestore,
  rejectDepositInFirestore,
  approveWithdrawalInFirestore,
  rejectWithdrawalInFirestore,
  adminSendReplyToUser,
  adminUpdateUserBalance,
  adminAdjustUserBalance,
  adminResetUserBalance,
  deleteUserFromFirestore,
  deleteActivityLogInFirestore,
  clearAllActivityLogsInFirestore,
  deleteDepositInFirestore,
  deleteTableRakeInFirestore,
  deleteRoomInFirestore,
  deleteAdminMessageInFirestore,
  logActivityToFirestore,
  AdminMessage,
} from '../services/firebaseService';

interface AdminDashboardProps {
  onBackToLogin: () => void;
  rooms?: Room[];
  onJoinRoom?: (room: Room) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onBackToLogin,
  rooms = [],
  onJoinRoom,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'deposits' | 'rakes' | 'users' | 'rooms' | 'messages' | 'activity'>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [deposits, setDeposits] = useState<DepositReceipt[]>([]);
  const [tableRakes, setTableRakes] = useState<TableRake[]>([]);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Live rooms local list (allows admin to manage / reset)
  const [liveRooms, setLiveRooms] = useState<Room[]>(rooms.length > 0 ? rooms : [
    { id: '611420', name: 'Oyun otağı #611420', stake: 0.20, maxPlayers: 4, currentPlayers: 4, status: 'in_game' },
    { id: '748291', name: 'Oyun otağı #748291', stake: 0.20, maxPlayers: 4, currentPlayers: 3, status: 'waiting' },
    { id: '912304', name: 'Oyun otağı #912304', stake: 0.50, maxPlayers: 4, currentPlayers: 2, status: 'waiting' },
    { id: '104922', name: 'Oyun otağı #104922', stake: 1.00, maxPlayers: 4, currentPlayers: 1, status: 'waiting' },
    { id: '450831', name: 'Oyun otağı #450831', stake: 2.00, maxPlayers: 4, currentPlayers: 4, status: 'in_game' },
    { id: '890123', name: 'Oyun otağı #890123', stake: 5.00, maxPlayers: 4, currentPlayers: 2, status: 'waiting', isSekaOnly: true },
  ]);

  // Update live rooms when props change
  useEffect(() => {
    if (rooms && rooms.length > 0) {
      setLiveRooms(rooms);
    }
  }, [rooms]);

  // Search & Filter States
  const [userSearch, setUserSearch] = useState('');
  const [userSortBy, setUserSortBy] = useState<'balance' | 'games' | 'wins'>('balance');
  const [depositFilter, setDepositFilter] = useState<'all' | 'pending' | 'deposits' | 'withdrawals' | 'approved' | 'rejected'>('pending');
  const [roomFilter, setRoomFilter] = useState<'all' | 'in_game' | 'waiting'>('all');
  const [rakeSearch, setRakeSearch] = useState('');
  const [rakeFilter, setRakeFilter] = useState<'all' | 'high' | 'today'>('all');
  const [activitySearch, setActivitySearch] = useState('');
  const [activityFilter, setActivityFilter] = useState<'all' | 'login' | 'games' | 'financial' | 'messages' | 'admin'>('all');
  const [copiedPlayerCard, setCopiedPlayerCard] = useState<string | null>(null);

  // Selected item modals / balance adjustment states
  const [selectedReceipt, setSelectedReceipt] = useState<DepositReceipt | null>(null);
  const [replyingToUser, setReplyingToUser] = useState<{ id: string; name: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  
  // User deletion confirmation modal
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  
  // Balance quick edit modal for specific user
  const [balanceEditUser, setBalanceEditUser] = useState<UserProfile | null>(null);
  const [balanceMode, setBalanceMode] = useState<'adjust' | 'set'>('adjust');
  const [balanceAdjustmentAmount, setBalanceAdjustmentAmount] = useState<string>('5');
  const [balanceReason, setBalanceReason] = useState<string>('Admin Balans Artırımı');
  
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [audioNotificationEnabled, setAudioNotificationEnabled] = useState(true);

  // Real-time Firebase subscriptions
  useEffect(() => {
    setLoading(true);

    const unsubUsers = subscribeToAllUsers((userList) => {
      setUsers(userList);
      setLoading(false);
    });

    const unsubDeposits = subscribeToPendingDeposits((depositList) => {
      setDeposits(depositList);
    });

    const unsubMessages = subscribeToAllAdminMessages((msgList) => {
      setMessages(msgList);
    });

    const unsubRakes = subscribeToTableRakes((rakeList) => {
      setTableRakes(rakeList);
    });

    const unsubActivity = subscribeToActivityLogs((logList) => {
      setActivityLogs(logList);
    });

    const unsubRooms = subscribeToRoomsInFirestore((roomsList) => {
      if (roomsList && roomsList.length > 0) {
        setLiveRooms(roomsList);
      }
    });

    return () => {
      unsubUsers();
      unsubDeposits();
      unsubMessages();
      unsubRakes();
      unsubActivity();
      unsubRooms();
    };
  }, []);

  const totalRakeCollected = useMemo(() => {
    return tableRakes.reduce((acc, r) => acc + (r.rakeAmount || 0), 0);
  }, [tableRakes]);

  const totalTablePotWon = useMemo(() => {
    return tableRakes.reduce((acc, r) => acc + (r.totalPot || 0), 0);
  }, [tableRakes]);

  const totalNetPayouts = useMemo(() => {
    return tableRakes.reduce((acc, r) => acc + (r.netPayout || 0), 0);
  }, [tableRakes]);

  const pendingDeposits = useMemo(() => {
    return deposits.filter((d) => d.status === 'pending' && (d.type === 'deposit' || !d.type));
  }, [deposits]);

  const pendingWithdrawals = useMemo(() => {
    return deposits.filter((d) => d.status === 'pending' && d.type === 'withdrawal');
  }, [deposits]);

  const allPendingCount = useMemo(() => {
    return deposits.filter((d) => d.status === 'pending').length;
  }, [deposits]);

  const pendingDepositsCount = allPendingCount;

  const totalSystemBalance = users.reduce((acc, u) => acc + (u.balance || 0), 0);
  const totalGamesPlayed = users.reduce((acc, u) => acc + (u.gamesPlayed || 0), 0);
  const totalWins = users.reduce((acc, u) => acc + (u.gamesWon || 0), 0);

  // Play subtle chime when new pending deposit is detected
  useEffect(() => {
    if (allPendingCount > 0 && audioNotificationEnabled) {
      soundManager.playPing();
    }
  }, [allPendingCount, audioNotificationEnabled]);

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPlayerCard(id);
    soundManager.playPing();
    setTimeout(() => setCopiedPlayerCard(null), 2500);
  };

  // Helper to find user profile by ID or username
  const getPlayerProfile = (userId: string, fallbackUsername?: string): UserProfile | undefined => {
    return users.find(
      (u) =>
        u &&
        (u.id === userId ||
          (Boolean(u.username && fallbackUsername) &&
            String(u.username).toLowerCase() === String(fallbackUsername).toLowerCase()))
    );
  };

  // Deposit Actions
  const handleApproveDeposit = async (dep: DepositReceipt) => {
    if (!dep.id) return;
    soundManager.playWin();
    const success = await approveDepositInFirestore(dep.id, dep.userId, dep.amount || 0);
    if (success) {
      showNotification(`✅ ${dep.username} üçün ${(dep.amount || 0).toFixed(2)} ₼ depozit təsdiqləndi və balansa oturdu!`);
      if (selectedReceipt?.id === dep.id) setSelectedReceipt(null);
    }
  };

  const handleRejectDeposit = async (dep: DepositReceipt) => {
    if (!dep.id) return;
    soundManager.playFold();
    const success = await rejectDepositInFirestore(dep.id, 'Çek məlumatı uyğun gəlmədi');
    if (success) {
      showNotification(`❌ ${dep.username} depoziti rədd edildi.`);
      if (selectedReceipt?.id === dep.id) setSelectedReceipt(null);
    }
  };

  // Withdrawal Actions
  const handleApproveWithdrawal = async (dep: DepositReceipt) => {
    if (!dep.id) return;
    soundManager.playWin();
    const success = await approveWithdrawalInFirestore(dep.id, dep.userId, dep.amount || 0);
    if (success) {
      showNotification(`✅ ${dep.username} üçün ${(dep.amount || 0).toFixed(2)} ₼ çıxarış təsdiqləndi və tamamlandı!`);
    }
  };

  const handleRejectWithdrawal = async (dep: DepositReceipt) => {
    if (!dep.id) return;
    soundManager.playFold();
    const reason = window.prompt('İmtina səbəbini qeyd edin (balans oyunçuya geri qaytarılacaq):', 'Kart məlumatları düzgün deyil') || 'Məlumat xətası';
    const success = await rejectWithdrawalInFirestore(dep.id, dep.userId, dep.amount || 0, reason);
    if (success) {
      showNotification(`↩️ ${dep.username} çıxarışı rədd edildi və ${(dep.amount || 0).toFixed(2)} ₼ balansı geri qaytarıldı.`);
    }
  };

  // Quick Balance Increase / Decrease (+ / -) directly
  const handleQuickAdjust = async (userId: string, username: string, delta: number) => {
    const isAdding = delta > 0;
    if (isAdding) {
      soundManager.playWin();
    } else {
      soundManager.playFold();
    }
    const success = await adminAdjustUserBalance(
      userId,
      delta,
      isAdding ? 'Admin Tərəfindən Balans Artımı' : 'Admin Tərəfindən Balans Azaldılması'
    );
    if (success) {
      showNotification(
        `${isAdding ? '➕' : '➖'} ${username} balansına ${isAdding ? '+' : ''}${(delta || 0).toFixed(2)} ₼ tətbiq edildi!`
      );
    }
  };

  // Reset User Balance to 0.00 AZN directly
  const handleResetBalance = async (userId: string, username: string) => {
    if (!window.confirm(`${username} adlı oyunçunun balansını 0.00 ₼ etmək istədiyinizə əminsiniz?`)) {
      return;
    }
    soundManager.playFold();
    const success = await adminResetUserBalance(userId, 'Admin Tərəfindən Balans Sıfırlandı');
    if (success) {
      showNotification(`⭕ ${username} balansı uğurla 0.00 ₼ olaraq sıfırlandı!`);
      if (balanceEditUser && balanceEditUser.id === userId) {
        setBalanceEditUser(null);
      }
    }
  };

  // Detailed Modal Balance Save
  const handleSaveBalanceModal = async () => {
    if (!balanceEditUser) return;
    const amountNum = parseFloat(balanceAdjustmentAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      alert('Zəhmət olmasa düzgün məbləğ daxil edin.');
      return;
    }

    if (balanceMode === 'adjust') {
      if (amountNum <= 0) {
        alert('Dəyişiklik məbləği 0-dan böyük olmalıdır.');
        return;
      }
      const isDecrease = balanceReason.includes('Azalt') || balanceReason.includes('Çıxarış');
      const delta = isDecrease ? -amountNum : amountNum;
      
      if (isDecrease) {
        soundManager.playFold();
      } else {
        soundManager.playWin();
      }

      const success = await adminAdjustUserBalance(balanceEditUser.id, delta, balanceReason || 'Admin Balans Dəyişimi');
      if (success) {
        showNotification(`✅ ${balanceEditUser.username} balansı ${delta > 0 ? '+' : ''}${(delta || 0).toFixed(2)} ₼ dəyişdirildi.`);
        setBalanceEditUser(null);
      }
    } else if (balanceMode === 'set') {
      // Direct Set Balance
      if (amountNum === 0) {
        soundManager.playFold();
      } else {
        soundManager.playWin();
      }
      const success = await adminUpdateUserBalance(balanceEditUser.id, amountNum, balanceReason || 'Admin Birbaşa Balans Təyini');
      if (success) {
        showNotification(`✅ ${balanceEditUser.username} balansı birbaşa ${(amountNum || 0).toFixed(2)} ₼ təyin edildi.`);
        setBalanceEditUser(null);
      }
    }
  };

  // Master Refresh & Full Database Sync Function
  const handleMasterRefresh = async () => {
    setIsRefreshing(true);
    soundManager.playWin();
    try {
      // Re-trigger all Firestore subscriptions by creating quick event
      await logActivityToFirestore({
        userId: 'admin',
        username: 'Baş Admin',
        actionType: 'admin_action',
        details: 'Admin panelindən layihənin bütün məlumatları, aktivlikləri və bazası yeniləndi və sinxronlaşdırıldı.',
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      });
      showNotification('🔄 Bütün məlumatlar, oyunçular, jurnallar və dəyişikliklər Firestore ilə yeniləndi!');
    } catch (e) {
      console.error(e);
      showNotification('Yeniləmə tamamlandı.');
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // Delete / Ban User Directly from System
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    soundManager.playFold();
    const success = await deleteUserFromFirestore(userToDelete.id, userToDelete.username);
    if (success) {
      showNotification(`🗑️ ${userToDelete.username} (ID: ${userToDelete.id}) hesabı tamamilə silindi və ləğv edildi!`);
      setUserToDelete(null);
      if (balanceEditUser?.id === userToDelete.id) {
        setBalanceEditUser(null);
      }
    } else {
      showNotification('İstifadəçi silinərkən xəta baş verdi.');
    }
  };

  // Delete Individual Activity Log
  const handleDeleteActivityLog = async (logId: string) => {
    soundManager.playFold();
    const success = await deleteActivityLogInFirestore(logId);
    if (success) {
      showNotification('🗑️ Hərəkət qeydi uğurla silindi.');
    }
  };

  // Clear All Activity Logs
  const handleClearAllActivityLogs = async () => {
    if (!window.confirm('Bütün aktivlik tarixçəsini və hərəkətləri təmizləmək istədiyinizə əminsiniz?')) {
      return;
    }
    soundManager.playFold();
    const success = await clearAllActivityLogsInFirestore();
    if (success) {
      showNotification('🧹 Bütün aktivlik jurnalı təmizləndi!');
    }
  };

  // Delete Deposit / Receipt
  const handleDeleteDeposit = async (depositId?: string) => {
    if (!depositId) return;
    if (!window.confirm('Bu depozit / çıxarış qeydini bazadan birdəfəlik silmək istəyirsiniz?')) return;
    soundManager.playFold();
    const success = await deleteDepositInFirestore(depositId);
    if (success) {
      showNotification('🗑️ Depozit qeydi bazadan silindi.');
      if (selectedReceipt?.id === depositId) setSelectedReceipt(null);
    }
  };

  // Delete Table Rake Record
  const handleDeleteTableRake = async (rakeId?: string) => {
    if (!rakeId) return;
    if (!window.confirm('Bu komissiya qeydini bazadan silmək istəyirsiniz?')) return;
    soundManager.playFold();
    const success = await deleteTableRakeInFirestore(rakeId);
    if (success) {
      showNotification('🗑️ Komissiya qeydi silindi.');
    }
  };

  // Delete Live Room
  const handleDeleteRoom = async (roomId: string) => {
    if (!window.confirm(`Masa #${roomId} tamamilə silinsin?`)) return;
    soundManager.playFold();
    setLiveRooms((prev) => prev.filter((r) => r.id !== roomId));
    await deleteRoomInFirestore(roomId);
    showNotification(`🗑️ Masa #${roomId} ləğv edildi.`);
  };

  // Delete Admin Message
  const handleDeleteAdminMessage = async (msgId: string) => {
    soundManager.playFold();
    const success = await deleteAdminMessageInFirestore(msgId);
    if (success) {
      showNotification('🗑️ Mesaj qeydi silindi.');
    }
  };

  // Send Admin Reply
  const handleSendReply = async () => {
    if (!replyingToUser || !replyText.trim()) return;
    soundManager.playPing();
    const success = await adminSendReplyToUser(replyingToUser.id, replyText.trim());
    if (success) {
      showNotification(`✉️ ${replyingToUser.name} oyunçusuna cavab göndərildi.`);
      setReplyText('');
      setReplyingToUser(null);
    }
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    const query = (userSearch || '').toLowerCase();
    const list = users.filter((u) => {
      if (!u) return false;
      const uName = (u.username || '').toLowerCase();
      const uId = (u.id || '').toLowerCase();
      return uName.includes(query) || uId.includes(query);
    });

    return list.sort((a, b) => {
      if (userSortBy === 'balance') return (b.balance || 0) - (a.balance || 0);
      if (userSortBy === 'games') return (b.gamesPlayed || 0) - (a.gamesPlayed || 0);
      if (userSortBy === 'wins') return (b.gamesWon || 0) - (a.gamesWon || 0);
      return 0;
    });
  }, [users, userSearch, userSortBy]);

  // Filtered Deposits and Withdrawals
  const filteredDeposits = useMemo(() => {
    return deposits.filter((d) => {
      if (depositFilter === 'all') return true;
      if (depositFilter === 'pending') return d.status === 'pending';
      if (depositFilter === 'deposits') return d.type === 'deposit' || !d.type;
      if (depositFilter === 'withdrawals') return d.type === 'withdrawal';
      if (depositFilter === 'approved') return d.status === 'approved';
      if (depositFilter === 'rejected') return d.status === 'rejected';
      return true;
    });
  }, [deposits, depositFilter]);

  // Filtered Rooms
  const filteredRooms = useMemo(() => {
    return liveRooms.filter((r) => {
      if (roomFilter === 'all') return true;
      return r.status === roomFilter;
    });
  }, [liveRooms, roomFilter]);

  // Filtered Table Rakes / Commissions
  const filteredTableRakes = useMemo(() => {
    return tableRakes.filter((r) => {
      if (rakeFilter === 'high' && (r.rakeAmount || 0) < 0.50) return false;
      if (rakeFilter === 'today') {
        const todayStr = new Date().toISOString().substring(0, 10);
        if (!r.date.startsWith(todayStr)) return false;
      }
      if (rakeSearch.trim()) {
        const q = rakeSearch.toLowerCase();
        const matchRoom = (r.roomName || '').toLowerCase().includes(q) || (r.roomId || '').toLowerCase().includes(q);
        const matchWinner = (r.winnerName || '').toLowerCase().includes(q);
        return matchRoom || matchWinner;
      }
      return true;
    });
  }, [tableRakes, rakeSearch, rakeFilter]);

  // Filtered Activity Logs
  const filteredActivityLogs = useMemo(() => {
    return activityLogs.filter((log) => {
      if (activityFilter === 'login' && !['login', 'register', 'logout'].includes(log.actionType)) return false;
      if (activityFilter === 'games' && !['bet', 'win', 'seka', 'join_room', 'leave_room'].includes(log.actionType)) return false;
      if (activityFilter === 'financial' && !['deposit_request', 'deposit_approved', 'deposit_rejected', 'withdrawal_request', 'withdrawal_approved', 'withdrawal_rejected', 'bonus_claimed'].includes(log.actionType)) return false;
      if (activityFilter === 'messages' && log.actionType !== 'direct_message') return false;
      if (activityFilter === 'admin' && !['admin_action', 'delete_action'].includes(log.actionType)) return false;

      if (activitySearch.trim()) {
        const q = activitySearch.toLowerCase();
        const matchUser = (log.username || '').toLowerCase().includes(q) || (log.userId || '').toLowerCase().includes(q);
        const matchDetails = (log.details || '').toLowerCase().includes(q);
        const matchType = (log.actionType || '').toLowerCase().includes(q);
        return matchUser || matchDetails || matchType;
      }
      return true;
    });
  }, [activityLogs, activityFilter, activitySearch]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans flex flex-col selection:bg-[#F59E0B] selection:text-black">
      {/* Top Admin Header */}
      <header className="bg-[#121212] border-b border-white/10 px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToLogin}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white/70 hover:text-white transition flex items-center gap-1.5 text-xs font-bold active:scale-95"
            title="Giriş Ekranına Qayıt"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Girişə Qayıt</span>
          </button>
          <div className="h-6 w-[1px] bg-white/10" />
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 shadow-inner">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-wide text-white flex items-center gap-2">
                <span>SEKA ♠ BAŞ ADMİN İDARƏETMƏ PANELSİ</span>
                <span className="px-2 py-0.5 rounded-full bg-red-950/80 border border-red-500/50 text-red-400 text-[10px] uppercase font-mono font-bold">
                  CANLI BAZA
                </span>
              </h1>
              <p className="text-[11px] text-white/50">Mərkəzi İdarəetmə, Bütün Hərəkətlər və İcazə Nəzarəti</p>
            </div>
          </div>
        </div>

        {/* Real-time Status & Alert Indicators */}
        <div className="flex items-center gap-2.5">
          {/* Master Refresh and Apply Changes Button */}
          <button
            onClick={handleMasterRefresh}
            disabled={isRefreshing}
            title="Bütün məlumatları, dəyişiklikləri və bazanı tam yenilə"
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-black text-xs font-black transition active:scale-95 shadow-md shadow-amber-950/50 cursor-pointer ${
              isRefreshing ? 'opacity-70 animate-pulse' : ''
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-black ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Yenilənir...' : 'Bütün Dəyişiklikləri Yenilə'}</span>
          </button>

          {pendingDepositsCount > 0 && (
            <button
              onClick={() => {
                setActiveTab('deposits');
                setDepositFilter('pending');
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-900/60 border border-red-500/60 text-red-200 text-xs font-black animate-pulse hover:bg-red-800/80 transition cursor-pointer shadow-lg shadow-red-950/50"
            >
              <BellRing className="w-4 h-4 text-red-400 animate-bounce" />
              <span>{pendingDepositsCount} Gözləyən Depozit Çeki!</span>
            </button>
          )}

          <button
            onClick={() => setAudioNotificationEnabled(!audioNotificationEnabled)}
            className={`p-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
              audioNotificationEnabled
                ? 'bg-amber-500/20 border-[#F59E0B]/40 text-[#F59E0B]'
                : 'bg-white/5 border-white/10 text-white/40'
            }`}
            title={audioNotificationEnabled ? 'Səsli Bildiriş Aktivdir' : 'Səsli Bildiriş Deaktivdir'}
          >
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">{audioNotificationEnabled ? 'Səs: Açıq' : 'Səs: Sönülü'}</span>
          </button>
        </div>
      </header>

      {/* Floating Action Notification Toast */}
      {actionNotice && (
        <div className="fixed top-20 right-4 z-50 bg-[#F59E0B] text-black font-black px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs animate-in slide-in-from-top-4 border-2 border-black/20">
          <Sparkles className="w-4 h-4" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Navigation Tabs Bar */}
      <div className="bg-[#121212] border-b border-white/10 px-4 sm:px-8 flex gap-2 overflow-x-auto no-scrollbar py-2.5 sticky top-[65px] z-30 shadow-md">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-[#F59E0B] text-black shadow-lg shadow-amber-950/30'
              : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Ümumi Baxış & Statistika</span>
        </button>

        {/* 2. ACTIVITY LOGS TAB */}
        <button
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'activity'
              ? 'bg-[#F59E0B] text-black shadow-lg shadow-amber-950/30'
              : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
          }`}
        >
          <History className="w-4 h-4 text-cyan-400" />
          <span>Aktivlik Jurnalı & Hərəkətlər ({activityLogs.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('deposits');
            setDepositFilter('pending');
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 relative cursor-pointer ${
            activeTab === 'deposits'
              ? 'bg-[#F59E0B] text-black shadow-lg shadow-amber-950/30'
              : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Gözləyən & Bütün Depozitlər</span>
          {pendingDepositsCount > 0 ? (
            <span className="px-2 py-0.5 bg-red-600 text-white rounded-full text-[10px] font-black animate-pulse">
              {pendingDepositsCount}
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-white/10 text-white/60 rounded-full text-[10px] font-bold">
              {deposits.length}
            </span>
          )}
        </button>

        {/* MASA MƏRCLƏRİ (%10 KOMİSSİYA) TAB */}
        <button
          onClick={() => setActiveTab('rakes')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'rakes'
              ? 'bg-[#F59E0B] text-black shadow-lg shadow-amber-950/30'
              : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
          }`}
        >
          <Flame className="w-4 h-4 text-emerald-400" />
          <span>Masa Mərcləri (%10 Komissiya)</span>
          <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 rounded-full text-[10px] font-black">
            {(totalRakeCollected || 0).toFixed(2)} ₼
          </span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'users'
              ? 'bg-[#F59E0B] text-black shadow-lg shadow-amber-950/30'
              : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Qeydiyyatlı Oyunçular ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('rooms')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'rooms'
              ? 'bg-[#F59E0B] text-black shadow-lg shadow-amber-950/30'
              : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
          }`}
        >
          <Tv className="w-4 h-4" />
          <span>Oynanılan Oyunlar & Otaqlar ({liveRooms.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('messages')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'messages'
              ? 'bg-[#F59E0B] text-black shadow-lg shadow-amber-950/30'
              : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Dəstək Mesajları ({messages.length})</span>
        </button>
      </div>

      {/* Main Content Body */}
      <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
        
        {/* 1. OVERVIEW & METRICS TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Top Metric Cards with Dedicated Navigation Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              
              {/* Card 1: Gözləyən Depozitlər */}
              <div className={`p-5 rounded-2xl border shadow-xl flex flex-col justify-between transition ${
                pendingDepositsCount > 0
                  ? 'bg-gradient-to-br from-amber-950/40 to-[#181818] border-amber-500/50'
                  : 'bg-[#161616] border-white/10'
              }`}>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white/60 uppercase tracking-wider block">
                      Gözləyən Depozitlər
                    </span>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      pendingDepositsCount > 0
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                        : 'bg-amber-500/10 text-[#F59E0B] border border-[#F59E0B]/20'
                    }`}>
                      <Clock className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-white font-mono mt-2 flex items-baseline gap-2">
                    <span className={pendingDepositsCount > 0 ? 'text-red-400' : 'text-white'}>
                      {pendingDepositsCount}
                    </span>
                    <span className="text-xs text-white/40 font-normal">sorğu</span>
                  </div>
                  <p className="text-[11px] text-white/50 mt-1">
                    {pendingDepositsCount > 0 ? '🔴 Təsdiq gözləyən yeni çeklər var!' : 'Hazırda gözləyən ödəniş çeki yoxdur'}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setActiveTab('deposits');
                    setDepositFilter('pending');
                  }}
                  className="mt-4 w-full py-2 bg-[#F59E0B] hover:bg-amber-400 text-black font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Depozitləri Yoxla & Təsdiqlə →</span>
                </button>
              </div>

              {/* Card 2: Masa Mərcləri (%10 Komissiya) */}
              <div className="p-5 rounded-2xl bg-[#161616] border border-emerald-500/30 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white/60 uppercase tracking-wider block">
                      Masa Komissiyası (%10)
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
                      <Flame className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-emerald-400 font-mono mt-2 flex items-baseline gap-1">
                    <span>{(totalRakeCollected || 0).toFixed(2)}</span>
                    <span className="text-base text-emerald-400">₼</span>
                  </div>
                  <p className="text-[11px] text-emerald-400/80 mt-1 font-semibold">
                    Toplam {tableRakes.length} raunddan yığılan %10 gəlir
                  </p>
                </div>

                <button
                  onClick={() => setActiveTab('rakes')}
                  className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-black font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <Flame className="w-4 h-4" />
                  <span>Masa Mərcləri Ekranı ({tableRakes.length}) →</span>
                </button>
              </div>

              {/* Card 3: Qeydiyyatlı Oyunçular */}
              <div className="p-5 rounded-2xl bg-[#161616] border border-white/10 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white/60 uppercase tracking-wider block">
                      Qeydiyyatlı Oyunçular
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-white font-mono mt-2 flex items-baseline gap-2">
                    <span>{users.length}</span>
                    <span className="text-xs text-white/40 font-normal">hesab</span>
                  </div>
                  <p className="text-[11px] text-green-400 mt-1 font-semibold flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Real-time qeydiyyat bazası</span>
                  </p>
                </div>

                <button
                  onClick={() => setActiveTab('users')}
                  className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  <span>Bütün Oyunçuların Siyahısı ({users.length}) →</span>
                </button>
              </div>

              {/* Card 4: Oynanılan Oyunlar & Otaqlar */}
              <div className="p-5 rounded-2xl bg-[#161616] border border-white/10 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white/60 uppercase tracking-wider block">
                      Oynanılan Oyunlar & Otaqlar
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                      <Tv className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-purple-400 font-mono mt-2 flex items-baseline gap-2">
                    <span>{liveRooms.length}</span>
                    <span className="text-xs text-white/40 font-normal">aktiv masa</span>
                  </div>
                  <p className="text-[11px] text-white/50 mt-1">
                    Cəmi {totalGamesPlayed} oyun seansı keçirilib
                  </p>
                </div>

                <button
                  onClick={() => setActiveTab('rooms')}
                  className="mt-4 w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <Tv className="w-4 h-4" />
                  <span>Canlı Masalara Nəzarət Et →</span>
                </button>
              </div>

              {/* Card 5: Dövriyyədəki Balans */}
              <div className="p-5 rounded-2xl bg-[#161616] border border-white/10 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white/60 uppercase tracking-wider block">
                      Dövriyyədəki Balans
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30 flex items-center justify-center">
                      <Wallet className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-[#F59E0B] font-mono mt-2 flex items-baseline gap-1">
                    <span>{(totalSystemBalance || 0).toFixed(2)}</span>
                    <span className="text-base text-[#F59E0B]">₼</span>
                  </div>
                  <p className="text-[11px] text-white/50 mt-1">
                    Bütün oyunçu cüzdanlarının cəmi
                  </p>
                </div>

                <button
                  onClick={() => {
                    setActiveTab('users');
                    setUserSortBy('balance');
                  }}
                  className="mt-4 w-full py-2 bg-white/10 hover:bg-white/20 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <Sliders className="w-4 h-4 text-[#F59E0B]" />
                  <span>Balans İdarəetməsi →</span>
                </button>
              </div>
            </div>

            {/* Quick Live Preview: Pending Deposits & Live Rooms Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Recent Pending / New Deposits Box */}
              <div className="p-5 rounded-2xl bg-[#141414] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#F59E0B]" />
                    <span>Gözləyən & Son Depozit Çekləri</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('deposits')}
                    className="text-xs text-[#F59E0B] hover:underline font-bold"
                  >
                    Bütün Çeklər ({deposits.length}) →
                  </button>
                </div>

                {deposits.slice(0, 5).length === 0 ? (
                  <div className="text-center py-10 text-white/40 text-xs">
                    Hələ heç bir depozit daxil olmayıb.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {deposits.slice(0, 5).map((dep) => {
                      const player = getPlayerProfile(dep.userId, dep.username);
                      return (
                        <div
                          key={dep.id}
                          className="p-3.5 rounded-xl bg-[#1a1a1a] border border-white/5 flex items-center justify-between gap-3 hover:border-white/20 transition"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={player?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${dep.userId}`}
                              alt={dep.username}
                              className="w-9 h-9 rounded-xl bg-black/60 border border-white/10 shrink-0"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-xs">{dep.username}</span>
                                <span className="text-[10px] text-[#F59E0B] font-mono font-bold bg-[#F59E0B]/10 px-1.5 py-0.2 rounded">
                                  Balans: {player ? `${((player && player.balance) || 0).toFixed(2)} ₼` : '...'}
                                </span>
                              </div>
                              <div className="text-[10px] text-white/40 font-mono mt-0.5 flex items-center gap-2">
                                <span>{dep.method}</span>
                                <span>•</span>
                                <span>{dep.date}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-[#F59E0B] mr-1">
                              +{((dep && dep.amount) || 0).toFixed(2)} ₼
                            </span>
                            {dep.status === 'pending' ? (
                              <button
                                onClick={() => handleApproveDeposit(dep)}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-black font-black text-xs rounded-lg transition active:scale-95 cursor-pointer"
                              >
                                Təsdiq
                              </button>
                            ) : (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  dep.status === 'approved'
                                    ? 'bg-green-950 text-green-400 border border-green-500/30'
                                    : 'bg-red-950 text-red-400 border border-red-500/30'
                                }`}
                              >
                                {dep.status === 'approved' ? 'Təsdiqlənib' : 'İmtina'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Active Game Rooms Snapshot Box */}
              <div className="p-5 rounded-2xl bg-[#141414] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Tv className="w-4 h-4 text-purple-400" />
                    <span>Canlı Otaqlar & Masalar</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('rooms')}
                    className="text-xs text-purple-400 hover:underline font-bold"
                  >
                    Bütün Masaları İzlə →
                  </button>
                </div>

                <div className="space-y-2.5">
                  {liveRooms.slice(0, 5).map((room) => (
                    <div
                      key={room.id}
                      className="p-3.5 rounded-xl bg-[#1a1a1a] border border-white/5 flex items-center justify-between gap-3 hover:border-purple-500/30 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center font-black text-xs text-purple-300">
                          {((room && room.stake) || 0).toFixed(2)}₼
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{room.name}</span>
                            {room.isSekaOnly && (
                              <span className="text-[9px] bg-red-950 text-red-400 border border-red-500/30 px-1.5 py-0.2 rounded uppercase font-bold">
                                Seka
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-white/40 font-mono mt-0.5">
                            Oyunçular: {room.currentPlayers}/{room.maxPlayers}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            room.status === 'in_game'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                              : 'bg-green-950 text-green-400 border border-green-500/30'
                          }`}
                        >
                          {room.status === 'in_game' ? '🔴 Oyundadır' : '🟢 Gözləyir'}
                        </span>
                        {onJoinRoom && (
                          <button
                            onClick={() => onJoinRoom(room)}
                            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-lg transition"
                          >
                            İzlə
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* 2. ACTIVITY LOGS & FULL SYSTEM AUDIT TAB */}
        {activeTab === 'activity' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Toolbar */}
            <div className="bg-[#141414] p-4 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="İstifadəçi adı, ID, hərəkət növü və ya təfərrüat ilə axtarış..."
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#F59E0B]"
                />
              </div>

              {/* Filter pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setActivityFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activityFilter === 'all' ? 'bg-[#F59E0B] text-black font-black' : 'bg-white/5 text-white/70'
                  }`}
                >
                  Bütün Hərəkətlər ({activityLogs.length})
                </button>
                <button
                  onClick={() => setActivityFilter('login')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activityFilter === 'login' ? 'bg-cyan-500 text-black font-black' : 'bg-white/5 text-white/70'
                  }`}
                >
                  Giriş & Qeydiyyat
                </button>
                <button
                  onClick={() => setActivityFilter('games')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activityFilter === 'games' ? 'bg-emerald-500 text-black font-black' : 'bg-white/5 text-white/70'
                  }`}
                >
                  Oyun, Mərc & Uduşlar
                </button>
                <button
                  onClick={() => setActivityFilter('financial')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activityFilter === 'financial' ? 'bg-purple-500 text-white font-black' : 'bg-white/5 text-white/70'
                  }`}
                >
                  Depozit & Çıxarışlar
                </button>
                <button
                  onClick={() => setActivityFilter('messages')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activityFilter === 'messages' ? 'bg-blue-500 text-white font-black' : 'bg-white/5 text-white/70'
                  }`}
                >
                  Mesajlaşma (Təklif & İrad)
                </button>
                <button
                  onClick={() => setActivityFilter('admin')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activityFilter === 'admin' ? 'bg-red-600 text-white font-black' : 'bg-white/5 text-white/70'
                  }`}
                >
                  Admin Əməliyyatları
                </button>

                <button
                  onClick={handleClearAllActivityLogs}
                  title="Bütün aktivlik tarixçəsini təmizlə"
                  className="px-3 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-800 border border-red-500/40 text-red-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Jurnalı Təmizlə</span>
                </button>
              </div>
            </div>

            {/* Activity Logs Table */}
            <div className="bg-[#141414] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1c1c1c] text-white/60 uppercase font-black tracking-wider border-b border-white/10">
                    <tr>
                      <th className="p-4">Tarix & Saat</th>
                      <th className="p-4">İstifadəçi</th>
                      <th className="p-4">Hərəkət Növü</th>
                      <th className="p-4">Təfərrüat / Ətraflı Məlumat</th>
                      <th className="p-4">Əlaqədar ID / Məbləğ</th>
                      <th className="p-4 text-right">Ləğv / Silmə</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium">
                    {filteredActivityLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-white/40">
                          Hərəkət qeydi tapılmadı.
                        </td>
                      </tr>
                    ) : (
                      filteredActivityLogs.map((log) => {
                        let badgeColor = 'bg-white/10 text-white';
                        let typeName = log.actionType;

                        if (log.actionType === 'register') {
                          badgeColor = 'bg-cyan-950 border border-cyan-500/50 text-cyan-300';
                          typeName = 'Yeni Qeydiyyat';
                        } else if (log.actionType === 'login') {
                          badgeColor = 'bg-blue-950 border border-blue-500/50 text-blue-300';
                          typeName = 'Sistemə Giriş';
                        } else if (log.actionType === 'logout') {
                          badgeColor = 'bg-gray-800 border border-gray-600 text-gray-300';
                          typeName = 'Çıxış';
                        } else if (log.actionType === 'join_room') {
                          badgeColor = 'bg-indigo-950 border border-indigo-500/50 text-indigo-300';
                          typeName = 'Masaya Daxil Olma';
                        } else if (log.actionType === 'leave_room') {
                          badgeColor = 'bg-zinc-800 border border-zinc-600 text-zinc-300';
                          typeName = 'Masadan Çıxış';
                        } else if (log.actionType === 'bet') {
                          badgeColor = 'bg-amber-950 border border-amber-500/50 text-amber-300';
                          typeName = 'Mərc Qoyuldu';
                        } else if (log.actionType === 'win') {
                          badgeColor = 'bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-black';
                          typeName = '🏆 Qələbə & Bank Uduşu';
                        } else if (log.actionType === 'seka') {
                          badgeColor = 'bg-red-950 border border-red-500/60 text-red-300 font-black';
                          typeName = '🔥 SEKA Açıldı';
                        } else if (log.actionType === 'deposit_request') {
                          badgeColor = 'bg-yellow-950 border border-yellow-500/50 text-yellow-300';
                          typeName = 'Depozit Sorğusu';
                        } else if (log.actionType === 'deposit_approved') {
                          badgeColor = 'bg-green-950 border border-green-500/50 text-green-300';
                          typeName = 'Depozit Təsdiqləndi';
                        } else if (log.actionType === 'deposit_rejected') {
                          badgeColor = 'bg-red-950 border border-red-500/50 text-red-300';
                          typeName = 'Depozit İmtina';
                        } else if (log.actionType === 'withdrawal_request') {
                          badgeColor = 'bg-orange-950 border border-orange-500/50 text-orange-300';
                          typeName = 'Çıxarış Sorğusu';
                        } else if (log.actionType === 'withdrawal_approved') {
                          badgeColor = 'bg-emerald-950 border border-emerald-500/50 text-emerald-300';
                          typeName = 'Çıxarış Ödənildi';
                        } else if (log.actionType === 'withdrawal_rejected') {
                          badgeColor = 'bg-rose-950 border border-rose-500/50 text-rose-300';
                          typeName = 'Çıxarış İmtina';
                        } else if (log.actionType === 'bonus_claimed') {
                          badgeColor = 'bg-purple-950 border border-purple-500/50 text-purple-300';
                          typeName = '🎁 5.00₼ Bonus Aktiv Edildi';
                        } else if (log.actionType === 'direct_message') {
                          badgeColor = 'bg-sky-950 border border-sky-500/50 text-sky-300';
                          typeName = '💬 Oyunçu Mesajı';
                        } else if (log.actionType === 'admin_action') {
                          badgeColor = 'bg-red-900 border border-red-400 text-white font-black';
                          typeName = '🛡️ Admin Əməliyyatı';
                        } else if (log.actionType === 'delete_action') {
                          badgeColor = 'bg-red-950 border border-red-600 text-red-200 font-black';
                          typeName = '🗑️ Silmə Əməliyyatı';
                        }

                        return (
                          <tr key={log.id} className="hover:bg-white/5 transition">
                            {/* Date */}
                            <td className="p-4 font-mono text-white/60 text-[11px] whitespace-nowrap">
                              {log.date}
                            </td>

                            {/* User */}
                            <td className="p-4">
                              <div className="font-bold text-white text-xs">{log.username}</div>
                              <div className="text-[10px] font-mono text-white/40">ID: {log.userId}</div>
                            </td>

                            {/* Action Type */}
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold inline-block ${badgeColor}`}>
                                {typeName}
                              </span>
                            </td>

                            {/* Details */}
                            <td className="p-4 text-white/90 text-xs max-w-md">
                              {log.details}
                            </td>

                            {/* Room / Amount info */}
                            <td className="p-4 font-mono text-[11px]">
                              {log.amount !== undefined && (
                                <span className="text-emerald-400 font-bold mr-2">
                                  {((log && log.amount) || 0).toFixed(2)} ₼
                                </span>
                              )}
                              {log.roomId && (
                                <span className="text-amber-300 bg-black/40 px-1.5 py-0.5 rounded border border-amber-500/30">
                                  #{log.roomId}
                                </span>
                              )}
                              {log.targetUserId && (
                                <span className="text-blue-300 text-[10px] block mt-0.5">
                                  Hədəf ID: {log.targetUserId}
                                </span>
                              )}
                            </td>

                            {/* Delete button (Admin exclusive) */}
                            <td className="p-4 text-right">
                              {log.id && (
                                <button
                                  onClick={() => handleDeleteActivityLog(log.id!)}
                                  title="Bu hərəkət qeydini bazadan sil"
                                  className="p-1.5 rounded-lg bg-red-950/80 hover:bg-red-800 border border-red-500/40 text-red-300 transition active:scale-95 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. DEPOSITS & WITHDRAWALS MANAGEMENT TAB */}
        {activeTab === 'deposits' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Filter Tabs & Quick Summary */}
            <div className="bg-[#141414] p-4 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setDepositFilter('pending')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                    depositFilter === 'pending'
                      ? 'bg-red-600 text-white shadow-lg shadow-red-950/50'
                      : 'bg-white/5 hover:bg-white/10 text-white/70'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Gözləyən Sorğular ({allPendingCount})</span>
                </button>
                <button
                  onClick={() => setDepositFilter('deposits')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    depositFilter === 'deposits'
                      ? 'bg-emerald-600 text-black font-black'
                      : 'bg-white/5 hover:bg-white/10 text-white/70'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>Depozitlər ({deposits.filter(d => d.type === 'deposit' || !d.type).length})</span>
                </button>
                <button
                  onClick={() => setDepositFilter('withdrawals')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    depositFilter === 'withdrawals'
                      ? 'bg-amber-600 text-black font-black'
                      : 'bg-white/5 hover:bg-white/10 text-white/70'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Çıxarışlar ({deposits.filter(d => d.type === 'withdrawal').length})</span>
                </button>
                <button
                  onClick={() => setDepositFilter('approved')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    depositFilter === 'approved'
                      ? 'bg-green-600 text-black font-black'
                      : 'bg-white/5 hover:bg-white/10 text-white/70'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Təsdiqlənənlər</span>
                </button>
                <button
                  onClick={() => setDepositFilter('rejected')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    depositFilter === 'rejected'
                      ? 'bg-red-900 text-white font-black'
                      : 'bg-white/5 hover:bg-white/10 text-white/70'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>İmtina Edilənlər</span>
                </button>
                <button
                  onClick={() => setDepositFilter('all')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    depositFilter === 'all'
                      ? 'bg-[#F59E0B] text-black font-black'
                      : 'bg-white/5 hover:bg-white/10 text-white/70'
                  }`}
                >
                  Hamısı ({deposits.length})
                </button>
              </div>

              <div className="text-xs text-white/60 font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                <span>Admin birbaşa hər oyunçunun balansını buradan artıra və azalda bilər</span>
              </div>
            </div>

            {/* Deposits & Withdrawals Table with Rich Player Profile & Quick Balance Controls */}
            <div className="bg-[#141414] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1c1c1c] text-white/60 uppercase font-black tracking-wider border-b border-white/10">
                    <tr>
                      <th className="p-4">Növ / Oyunçu</th>
                      <th className="p-4">Cari Balans</th>
                      <th className="p-4">Məbləğ</th>
                      <th className="p-4">Kart / Metod / Tarix</th>
                      <th className="p-4">Ödəniş Çeki / Kartı</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-center">Balans Artır / Azalt (Admin)</th>
                      <th className="p-4 text-right">Admin Qərarı</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-white/90 font-medium">
                    {filteredDeposits.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-white/40">
                          <AlertTriangle className="w-8 h-8 text-white/20 mx-auto mb-2" />
                          <span>Heç bir depozit və ya çıxarış sorğusu tapılmadı.</span>
                        </td>
                      </tr>
                    ) : (
                      filteredDeposits.map((dep) => {
                        const player = getPlayerProfile(dep.userId, dep.username);
                        const isWithdrawal = dep.type === 'withdrawal';
                        return (
                          <tr key={dep.id} className={`hover:bg-white/5 transition ${isWithdrawal ? 'bg-amber-950/5' : ''}`}>
                            {/* Type & Player profile info */}
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <img
                                    src={player?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${dep.userId}`}
                                    alt={dep.username}
                                    className="w-10 h-10 rounded-xl bg-black/60 border border-white/10 shrink-0"
                                  />
                                  <span className={`absolute -bottom-1 -right-1 text-[8px] font-black px-1 rounded ${
                                    isWithdrawal ? 'bg-amber-500 text-black' : 'bg-emerald-500 text-black'
                                  }`}>
                                    {isWithdrawal ? 'ÇIX' : 'DEP'}
                                  </span>
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-black text-white text-xs">{dep.username}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                      isWithdrawal ? 'bg-amber-950 text-amber-300 border border-amber-500/30' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                    }`}>
                                      {isWithdrawal ? 'Çıxarış' : 'Depozit'}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-white/40 font-mono block">
                                    ID: #{dep.userId.slice(0, 8)}...
                                  </span>
                                  {player && (
                                    <span className="text-[10px] text-green-400 font-semibold">
                                      {player.gamesPlayed} oyun / {player.gamesWon} qələbə
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Current player live balance */}
                            <td className="p-4">
                              <div className="font-mono font-black text-sm text-[#F59E0B]">
                                {player ? `${((player && player.balance) || 0).toFixed(2)} ₼` : '0.00 ₼'}
                              </div>
                              <span className="text-[10px] text-white/40">Hesab balansı</span>
                            </td>

                            {/* Amount */}
                            <td className={`p-4 font-mono font-black text-base ${
                              isWithdrawal ? 'text-amber-400' : 'text-green-400'
                            }`}>
                              {isWithdrawal ? `-${((dep && dep.amount) || 0).toFixed(2)} ₼` : `+${((dep && dep.amount) || 0).toFixed(2)} ₼`}
                            </td>

                            {/* Method / Card Number & Date */}
                            <td className="p-4">
                              {isWithdrawal && dep.cardNumber ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-amber-300 text-[11px] bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                                      {dep.cardNumber}
                                    </span>
                                    <button
                                      onClick={() => handleCopyText(dep.cardNumber || '', dep.id || '')}
                                      title="Kart nömrəsini kopyala"
                                      className="p-1 bg-white/10 hover:bg-white/20 rounded text-white/80 transition cursor-pointer"
                                    >
                                      {copiedPlayerCard === dep.id ? (
                                        <Check className="w-3 h-3 text-green-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                  <span className="text-[10px] text-white/40 font-mono block">{dep.date}</span>
                                </div>
                              ) : (
                                <div>
                                  <span className="px-2 py-0.5 rounded bg-white/10 text-white/80 font-mono text-[11px] block w-max">
                                    {dep.method}
                                  </span>
                                  <span className="text-[10px] text-white/40 font-mono mt-0.5 block">{dep.date}</span>
                                </div>
                              )}
                            </td>

                            {/* Receipt or Card Preview */}
                            <td className="p-4">
                              {isWithdrawal ? (
                                <div className="flex items-center gap-1 text-amber-300/80 text-[11px] font-mono">
                                  <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Bank Kartına</span>
                                </div>
                              ) : dep.receiptImage ? (
                                <button
                                  onClick={() => setSelectedReceipt(dep)}
                                  className="px-2.5 py-1.5 rounded-xl bg-[#F59E0B]/20 text-[#F59E0B] hover:bg-[#F59E0B]/30 flex items-center gap-1.5 font-bold transition cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Çekə Bax</span>
                                </button>
                              ) : (
                                <span className="text-white/30 text-[11px]">Şəkil yoxdur</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="p-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  dep.status === 'approved'
                                    ? 'bg-green-950/80 border border-green-500/40 text-green-400'
                                    : dep.status === 'pending'
                                    ? 'bg-red-950/80 border border-red-500/40 text-red-300 animate-pulse'
                                    : 'bg-zinc-800 border border-white/10 text-white/50'
                                }`}
                              >
                                {dep.status === 'approved' ? 'Təsdiqləndi' : dep.status === 'pending' ? 'Gözləyir' : 'İmtina'}
                              </span>
                            </td>

                            {/* Player Direct Balance Controls (+ / - / Sıfırla) */}
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleResetBalance(dep.userId, dep.username)}
                                  title="Balansı Sıfırla (0.00 ₼)"
                                  className="px-2 py-1 bg-red-900/90 hover:bg-red-700 border border-red-500/60 text-red-100 font-black text-[11px] rounded-lg transition active:scale-95 cursor-pointer shadow-sm flex items-center gap-0.5"
                                >
                                  <span>0₼</span>
                                </button>
                                <button
                                  onClick={() => handleQuickAdjust(dep.userId, dep.username, -10)}
                                  title="Balansdan 10 ₼ Azalt"
                                  className="px-1.5 py-1 bg-red-950/80 hover:bg-red-800 border border-red-500/40 text-red-300 font-black text-[11px] rounded-lg transition active:scale-95 cursor-pointer"
                                >
                                  -10₼
                                </button>
                                <button
                                  onClick={() => handleQuickAdjust(dep.userId, dep.username, -5)}
                                  title="Balansdan 5 ₼ Azalt"
                                  className="px-1.5 py-1 bg-red-950/80 hover:bg-red-800 border border-red-500/40 text-red-300 font-black text-[11px] rounded-lg transition active:scale-95 cursor-pointer"
                                >
                                  -5₼
                                </button>
                                <button
                                  onClick={() => handleQuickAdjust(dep.userId, dep.username, 5)}
                                  title="Balansa 5 ₼ Əlavə Et"
                                  className="px-1.5 py-1 bg-green-950/80 hover:bg-green-800 border border-green-500/40 text-green-300 font-black text-[11px] rounded-lg transition active:scale-95 cursor-pointer"
                                >
                                  +5₼
                                </button>
                                <button
                                  onClick={() => handleQuickAdjust(dep.userId, dep.username, 10)}
                                  title="Balansa 10 ₼ Əlavə Et"
                                  className="px-1.5 py-1 bg-green-950/80 hover:bg-green-800 border border-green-500/40 text-green-300 font-black text-[11px] rounded-lg transition active:scale-95 cursor-pointer"
                                >
                                  +10₼
                                </button>
                                <button
                                  onClick={() => {
                                    if (player) {
                                      setBalanceEditUser(player);
                                      setBalanceAdjustmentAmount('10');
                                    }
                                  }}
                                  title="Fərdi Məbləğ Seçimi"
                                  className="p-1 bg-[#F59E0B]/20 hover:bg-[#F59E0B]/40 text-[#F59E0B] rounded-lg transition cursor-pointer ml-1"
                                >
                                  <Sliders className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                            {/* Approve / Reject Actions */}
                            <td className="p-4 text-right space-x-1.5">
                              {dep.status === 'pending' ? (
                                isWithdrawal ? (
                                  <>
                                    <button
                                      onClick={() => handleApproveWithdrawal(dep)}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-black font-black text-xs rounded-xl transition shadow-md active:scale-95 cursor-pointer"
                                    >
                                      Ödənildi ({((dep && dep.amount) || 0).toFixed(2)} ₼)
                                    </button>
                                    <button
                                      onClick={() => handleRejectWithdrawal(dep)}
                                      className="px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/40 border border-red-500/40 text-red-300 font-bold text-xs rounded-xl transition cursor-pointer"
                                      title="İmtina et və balansı oyunçuya qaytar"
                                    >
                                      İmtina (Qaytar)
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleApproveDeposit(dep)}
                                      className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-black font-black text-xs rounded-xl transition shadow-md active:scale-95 cursor-pointer"
                                    >
                                      Təsdiq (+{((dep && dep.amount) || 0).toFixed(2)} ₼)
                                    </button>
                                    <button
                                      onClick={() => handleRejectDeposit(dep)}
                                      className="px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/40 border border-red-500/40 text-red-300 font-bold text-xs rounded-xl transition cursor-pointer"
                                    >
                                      İmtina
                                    </button>
                                  </>
                                )
                              ) : (
                                <div className="flex items-center justify-end gap-1.5">
                                  <span className="text-[11px] text-white/40">Tamamlandı</span>
                                  <button
                                    onClick={() => handleDeleteDeposit(dep.id)}
                                    title="Bu qeydi bazadan sil"
                                    className="p-1 rounded-lg bg-red-950/70 hover:bg-red-800 border border-red-500/40 text-red-300 transition cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 2.5. MASA MƏRCLƏRİ (%10 KOMİSSİYA) TAB */}
        {activeTab === 'rakes' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Top Revenue Metric Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Box 1: Toplam %10 Masa Komissiyası */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/50 via-[#161616] to-[#121212] border-2 border-emerald-500/50 shadow-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-wider block">
                    Toplam %10 Masa Komissiyası
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-inner">
                    <Flame className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-black text-emerald-400 font-mono mt-3 flex items-baseline gap-1">
                  <span>{(totalRakeCollected || 0).toFixed(2)}</span>
                  <span className="text-base text-emerald-400">₼</span>
                </div>
                <p className="text-[11px] text-emerald-300/80 mt-1 font-semibold">
                  Masalardan avtomatik toplanan 10% xalis gəlir
                </p>
              </div>

              {/* Box 2: Toplam Masa Bankı (100% Mərclər) */}
              <div className="p-5 rounded-2xl bg-[#161616] border border-white/10 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/60 uppercase tracking-wider block">
                    Toplam Masa Bankı (100%)
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-[#F59E0B] border border-[#F59E0B]/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-black text-white font-mono mt-3 flex items-baseline gap-1">
                  <span>{(totalTablePotWon || 0).toFixed(2)}</span>
                  <span className="text-base text-[#F59E0B]">₼</span>
                </div>
                <p className="text-[11px] text-white/50 mt-1">
                  Masalarda oyunçuların qoyduğu 100% mərclər
                </p>
              </div>

              {/* Box 3: Qaliblərə Ödənilən Net Uduş (90%) */}
              <div className="p-5 rounded-2xl bg-[#161616] border border-white/10 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/60 uppercase tracking-wider block">
                    Qaliblərə Net Ödəniş (90%)
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-black text-blue-400 font-mono mt-3 flex items-baseline gap-1">
                  <span>{(totalNetPayouts || 0).toFixed(2)}</span>
                  <span className="text-base text-blue-400">₼</span>
                </div>
                <p className="text-[11px] text-white/50 mt-1">
                  Komissiya çıxıldıqdan sonra oyunçulara çatan
                </p>
              </div>

              {/* Box 4: Ümumi Tamamlanan Raundlar */}
              <div className="p-5 rounded-2xl bg-[#161616] border border-white/10 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/60 uppercase tracking-wider block">
                    Tamamlanan Raundlar
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                    <Tv className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-black text-white font-mono mt-3 flex items-baseline gap-2">
                  <span>{tableRakes.length}</span>
                  <span className="text-xs text-white/40 font-normal">raund</span>
                </div>
                <p className="text-[11px] text-white/50 mt-1">
                  Real-time qeydə alınmış masa seansları
                </p>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-[#141414] p-4 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Otaq adı, Otaq ID və ya Qalib adı ilə axtar..."
                  value={rakeSearch}
                  onChange={(e) => setRakeSearch(e.target.value)}
                  className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setRakeFilter('all')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    rakeFilter === 'all'
                      ? 'bg-emerald-600 text-black font-black'
                      : 'bg-[#1f1f1f] text-white/70 hover:text-white'
                  }`}
                >
                  Bütün Mərclər ({tableRakes.length})
                </button>
                <button
                  onClick={() => setRakeFilter('today')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    rakeFilter === 'today'
                      ? 'bg-emerald-600 text-black font-black'
                      : 'bg-[#1f1f1f] text-white/70 hover:text-white'
                  }`}
                >
                  Bugünkü Mərclər
                </button>
                <button
                  onClick={() => setRakeFilter('high')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    rakeFilter === 'high'
                      ? 'bg-emerald-600 text-black font-black'
                      : 'bg-[#1f1f1f] text-white/70 hover:text-white'
                  }`}
                >
                  Yüksək Komissiyalar (≥ 0.50 ₼)
                </button>
              </div>
            </div>

            {/* Table Rakes List */}
            <div className="bg-[#141414] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#181818]">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                    Masalardan Toplanan 10% Komissiya Qeydləri
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50">Cəmi: {filteredTableRakes.length} qeyd</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-[#1a1a1a] text-[11px] font-bold text-white/50 uppercase tracking-wider border-b border-white/10">
                      <th className="p-4">Otaq & Masa</th>
                      <th className="p-4">Tarix & Saat</th>
                      <th className="p-4 text-right">Toplam Masa Bankı (100%)</th>
                      <th className="p-4 text-right">10% Komissiya (Gəlir)</th>
                      <th className="p-4 text-right">Qalibə Ödəniş (90%)</th>
                      <th className="p-4">Qalib Oyunçu</th>
                      <th className="p-4 text-center">Raund & Mərc</th>
                      <th className="p-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {filteredTableRakes.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-white/40">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <Flame className="w-10 h-10 text-white/20 animate-pulse" />
                            <p className="font-bold text-white/70">Hələ ki, masa mərci qeydi tapılmadı</p>
                            <p className="text-xs max-w-md text-white/40">
                              Oyunçular masalarda kart oynadıqca hər raundun 100% toplanan bankından çıxılan 10% komissiya avtomatik olaraq bu ekrana toplanır.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredTableRakes.map((rake, idx) => (
                        <tr key={rake.id || idx} className="hover:bg-white/[0.03] transition">
                          {/* Room Name & ID */}
                          <td className="p-4">
                            <div className="font-bold text-white">{rake.roomName}</div>
                            <div className="text-[10px] text-white/40 font-mono">ID: #{rake.roomId}</div>
                          </td>

                          {/* Date */}
                          <td className="p-4 text-white/70 font-mono text-[11px]">
                            {rake.date}
                          </td>

                          {/* 100% Total Table Pot */}
                          <td className="p-4 text-right font-mono font-bold text-white">
                            {((rake && rake.totalPot) || 0).toFixed(2)} ₼
                          </td>

                          {/* 10% House Commission */}
                          <td className="p-4 text-right">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-500/50 text-emerald-400 font-mono font-black text-xs shadow-sm">
                              +{((rake && rake.rakeAmount) || 0).toFixed(2)} ₼
                            </span>
                          </td>

                          {/* 90% Net Payout to Winner */}
                          <td className="p-4 text-right font-mono font-bold text-blue-400">
                            {((rake && rake.netPayout) || 0).toFixed(2)} ₼
                          </td>

                          {/* Winner Name */}
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-amber-500/20 text-[#F59E0B] flex items-center justify-center font-black text-[10px]">
                                🏆
                              </div>
                              <span className="font-bold text-white">{rake.winnerName}</span>
                            </div>
                          </td>

                          {/* Round & Stake */}
                          <td className="p-4 text-center">
                            <div className="font-mono text-[11px] text-white/80">Raund #{rake.roundNumber}</div>
                            <div className="text-[10px] text-white/40 font-mono">Mərc: {((rake && rake.stake) || 0).toFixed(2)} ₼</div>
                          </td>

                          {/* Status */}
                          <td className="p-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Toplandı</span>
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. REGISTERED USERS TAB */}
        {activeTab === 'users' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Search & Sort Tool Bar */}
            <div className="bg-[#141414] p-4 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="İstifadəçi adı və ya ID ilə anında axtarış..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#F59E0B]"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">Sırala:</span>
                <button
                  onClick={() => setUserSortBy('balance')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    userSortBy === 'balance' ? 'bg-[#F59E0B] text-black font-black' : 'bg-white/5 text-white/70'
                  }`}
                >
                  Balansa Görə
                </button>
                <button
                  onClick={() => setUserSortBy('games')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    userSortBy === 'games' ? 'bg-[#F59E0B] text-black font-black' : 'bg-white/5 text-white/70'
                  }`}
                >
                  Oyun Sayı
                </button>
                <button
                  onClick={() => setUserSortBy('wins')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    userSortBy === 'wins' ? 'bg-[#F59E0B] text-black font-black' : 'bg-white/5 text-white/70'
                  }`}
                >
                  Qələbə Sayı
                </button>
              </div>
            </div>

            {/* Registered Users Table */}
            <div className="bg-[#141414] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1c1c1c] text-white/60 uppercase font-black tracking-wider border-b border-white/10">
                    <tr>
                      <th className="p-4">Oyunçu</th>
                      <th className="p-4">Unikal ID</th>
                      <th className="p-4">Cari Balans</th>
                      <th className="p-4">Oyun / Qələbə</th>
                      <th className="p-4">Seka Sayı</th>
                      <th className="p-4">Maksimum Uduş</th>
                      <th className="p-4 text-center">Sürətli Balans Dəyişimi</th>
                      <th className="p-4 text-right">Əməliyyatlar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-10 text-center text-white/40">
                          Axtarışa uyğun oyunçu tapılmadı.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-white/5 transition">
                          {/* Player info */}
                          <td className="p-4 flex items-center gap-3">
                            <img
                              src={u.avatar}
                              alt={u.username}
                              className="w-10 h-10 rounded-xl bg-black/60 border border-white/10"
                            />
                            <div>
                              <span className="font-black text-white text-xs block">{u.username}</span>
                              <span className="text-[10px] text-green-400 font-mono">Qeydiyyatlı İstifadəçi</span>
                            </div>
                          </td>

                          {/* ID */}
                          <td className="p-4 font-mono text-white/50 text-[11px]">
                            {u.id}
                          </td>

                          {/* Balance */}
                          <td className="p-4 font-mono font-black text-base text-[#F59E0B]">
                            {((u && u.balance) || 0).toFixed(2)} ₼
                          </td>

                          {/* Stats */}
                          <td className="p-4 font-mono">
                            <span className="text-white font-bold">{u.gamesPlayed}</span>
                            <span className="text-white/40"> / </span>
                            <span className="text-green-400 font-bold">{u.gamesWon} qələbə</span>
                          </td>

                          {/* Seka count */}
                          <td className="p-4 font-mono text-red-400 font-bold">
                            {u.sekaCount || 0}
                          </td>

                          {/* Max pot won */}
                          <td className="p-4 font-mono text-amber-300 font-bold">
                            {((u && u.biggestPotWon) || 0).toFixed(2)} ₼
                          </td>

                          {/* Quick Adjust Buttons */}
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleResetBalance(u.id, u.username)}
                                title="Balansı Sıfırla (0.00 ₼)"
                                className="px-2 py-1 bg-red-900/90 hover:bg-red-700 border border-red-500/60 text-red-100 font-black text-[11px] rounded-lg transition active:scale-95 cursor-pointer shadow-sm"
                              >
                                0₼
                              </button>
                              <button
                                onClick={() => handleQuickAdjust(u.id, u.username, -50)}
                                title="Balansdan 50 ₼ Azalt"
                                className="px-1.5 py-1 bg-red-950 hover:bg-red-800 border border-red-500/40 text-red-300 font-black text-[11px] rounded-lg transition active:scale-95 cursor-pointer"
                              >
                                -50₼
                              </button>
                              <button
                                onClick={() => handleQuickAdjust(u.id, u.username, -10)}
                                title="Balansdan 10 ₼ Azalt"
                                className="px-1.5 py-1 bg-red-950 hover:bg-red-800 border border-red-500/40 text-red-300 font-black text-[11px] rounded-lg transition active:scale-95 cursor-pointer"
                              >
                                -10₼
                              </button>
                              <button
                                onClick={() => handleQuickAdjust(u.id, u.username, 10)}
                                title="Balansa 10 ₼ Əlavə Et"
                                className="px-1.5 py-1 bg-green-950 hover:bg-green-800 border border-green-500/40 text-green-300 font-black text-[11px] rounded-lg transition active:scale-95 cursor-pointer"
                              >
                                +10₼
                              </button>
                              <button
                                onClick={() => handleQuickAdjust(u.id, u.username, 50)}
                                title="Balansa 50 ₼ Əlavə Et"
                                className="px-1.5 py-1 bg-green-950 hover:bg-green-800 border border-green-500/40 text-green-300 font-black text-[11px] rounded-lg transition active:scale-95 cursor-pointer"
                              >
                                +50₼
                              </button>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                onClick={() => {
                                  setBalanceEditUser(u);
                                  setBalanceAdjustmentAmount('10');
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-[#F59E0B]/20 hover:bg-[#F59E0B]/30 border border-[#F59E0B]/40 text-[#F59E0B] font-bold text-xs transition cursor-pointer"
                              >
                                Balansı İdarə Et
                              </button>
                              <button
                                onClick={() => {
                                  setReplyingToUser({ id: u.id, name: u.username });
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/40 text-blue-300 font-bold text-xs transition cursor-pointer"
                              >
                                Mesaj Yaz
                              </button>
                              <button
                                onClick={() => setUserToDelete(u)}
                                title="İstifadəçini və Hesabını Tamamilə Sil / Ləğv Et"
                                className="px-2.5 py-1.5 rounded-xl bg-red-950/90 hover:bg-red-800 border border-red-500/50 text-red-300 hover:text-white font-bold text-xs transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-sm"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span>İstifadəçini Sil</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 4. LIVE ROOMS & ACTIVE GAMES MONITORING TAB */}
        {activeTab === 'rooms' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Rooms Toolbar */}
            <div className="bg-[#141414] p-4 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRoomFilter('all')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    roomFilter === 'all' ? 'bg-purple-600 text-white font-black' : 'bg-white/5 text-white/70'
                  }`}
                >
                  Bütün Otaqlar ({liveRooms.length})
                </button>
                <button
                  onClick={() => setRoomFilter('in_game')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    roomFilter === 'in_game' ? 'bg-amber-500 text-black font-black' : 'bg-white/5 text-white/70'
                  }`}
                >
                  Canlı Oyunda Olanlar ({liveRooms.filter((r) => r.status === 'in_game').length})
                </button>
                <button
                  onClick={() => setRoomFilter('waiting')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    roomFilter === 'waiting' ? 'bg-green-600 text-black font-black' : 'bg-white/5 text-white/70'
                  }`}
                >
                  Oyunçu Gözləyənlər ({liveRooms.filter((r) => r.status === 'waiting').length})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const newId = Math.floor(100000 + Math.random() * 900000).toString();
                    const newRoom: Room = {
                      id: newId,
                      name: `Admin Nəzarət Otağı #${newId}`,
                      stake: 1.00,
                      maxPlayers: 4,
                      currentPlayers: 1,
                      status: 'waiting',
                    };
                    setLiveRooms((prev) => [newRoom, ...prev]);
                    showNotification(`🎲 Yeni #${newId} nömrəli nəzarət otağı açıldı!`);
                  }}
                  className="px-3.5 py-2 bg-[#F59E0B] hover:bg-amber-400 text-black font-black text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Yeni Nəzarət Masası Aç</span>
                </button>
              </div>
            </div>

            {/* Rooms Grid Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map((room) => {
                const roomPlayers: any[] = Array.isArray((room as any).players) ? (room as any).players : [];
                return (
                  <div
                    key={room.id}
                    className="bg-[#141414] border border-white/10 hover:border-purple-500/50 rounded-2xl p-5 space-y-4 shadow-xl transition flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-purple-950 border border-purple-500/40 flex items-center justify-center text-purple-300 font-bold text-xs">
                            ♠
                          </div>
                          <div>
                            <h4 className="font-black text-white text-xs">{room.name}</h4>
                            <span className="text-[10px] text-white/40 font-mono">ID: #{room.id}</span>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            room.status === 'in_game' || room.status === 'betting'
                              ? 'bg-amber-950 border border-amber-500/40 text-amber-300 animate-pulse'
                              : 'bg-green-950 border border-green-500/40 text-green-400'
                          }`}
                        >
                          {room.status === 'in_game' || room.status === 'betting' ? '🔴 Oyundadır' : '🟢 Gözləyir'}
                        </span>
                      </div>

                      {/* Room Stats */}
                      <div className="bg-[#1c1c1c] p-3 rounded-xl border border-white/5 space-y-2 text-xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-white/50">Mərc (Stake):</span>
                          <span className="text-[#F59E0B] font-black">{((room && room.stake) || 0).toFixed(2)} ₼</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/50">Oyunçu Sayı:</span>
                          <span className="text-white font-bold">{room.currentPlayers || roomPlayers.length} / {room.maxPlayers}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/50">Oyun Rejimi:</span>
                          <span className="text-white/80">{room.isSekaOnly ? 'Yalnız Seka' : 'Klassik Seka'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/50">Masadakı Bank:</span>
                          <span className="text-green-400 font-bold">
                            {typeof (room as any).pot === 'number' ? `${((room as any).pot || 0).toFixed(2)} ₼` : `${(((room && room.stake) || 0) * (room.currentPlayers || 1)).toFixed(2)} ₼`}
                          </span>
                        </div>
                      </div>

                      {/* Seated Players List with Kick Button */}
                      <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-2">
                        <span className="text-[11px] font-black text-white/70 uppercase tracking-wider block">
                          Masada Olan Oyunçular ({roomPlayers.length})
                        </span>
                        {roomPlayers.length === 0 ? (
                          <span className="text-[10px] text-white/30 italic block">Hazırda masa boşdur</span>
                        ) : (
                          <div className="space-y-1.5">
                            {roomPlayers.filter(Boolean).map((p: any, idx: number) => {
                              const pName = p?.username || p?.name || 'Oyunçu';
                              const pId = p?.id || `player-${idx}`;
                              return (
                                <div
                                  key={pId}
                                  className="flex items-center justify-between p-1.5 rounded-lg bg-white/5 border border-white/5 text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <img
                                      src={p?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${pId}`}
                                      alt={pName}
                                      className="w-6 h-6 rounded-full bg-black/60 border border-white/10"
                                    />
                                    <div>
                                      <span className="text-bold text-white text-[11px] block">{pName}</span>
                                      <span className="text-[9px] text-[#F59E0B] font-mono">{((p && p.balance) || 0).toFixed(2)} ₼</span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={async () => {
                                      if (confirm(`${pName} oyunçusunu masadan çıxarmaq istədiyinizə əminsiniz?`)) {
                                        const success = await kickPlayerFromRoomInFirestore(room.id, pId);
                                        if (success) {
                                          showNotification(`🚫 ${pName} masadan çıxarıldı.`);
                                        } else {
                                          showNotification('Xəta baş verdi.');
                                        }
                                      }
                                    }}
                                    title="Oyunçunu Masadan Çıxart"
                                    className="px-2 py-1 rounded bg-red-950 hover:bg-red-800 border border-red-500/40 text-red-300 hover:text-white font-bold text-[10px] transition cursor-pointer active:scale-95 flex items-center gap-1"
                                  >
                                    <UserX className="w-3 h-3" />
                                    <span>Otaqdan Çıxart</span>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Room Admin Controls */}
                    <div className="flex gap-2 pt-2 border-t border-white/5">
                      {onJoinRoom && (
                        <button
                          onClick={() => onJoinRoom(room)}
                          className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                        >
                          <Tv className="w-3.5 h-3.5" />
                          <span>Masanı İzlə</span>
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (confirm(`Masa #${room.id} (${room.name}) oyun ekranından tamamilə ləğv edilsin / silinsin?`)) {
                            const success = await deleteRoomInFirestore(room.id);
                            if (success) {
                              setLiveRooms((prev) => prev.filter((r) => r.id !== room.id));
                              showNotification(`🗑️ Masa #${room.id} uğurla ləğv edildi və silindi.`);
                            } else {
                              showNotification('Xəta baş verdi.');
                            }
                          }
                        }}
                        className="px-3 py-2 bg-red-950/90 hover:bg-red-800 border border-red-500/50 text-red-300 hover:text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm"
                        title="Masanı Ləğv Et və Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Masanı Ləğv Et</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. MESSAGES / SUPPORT TAB */}
        {activeTab === 'messages' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-[#141414] p-5 rounded-2xl border border-white/10 space-y-4">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#F59E0B]" />
                <span>Oyunçulardan Gələn Dəstək və Admin Müraciətləri</span>
              </h3>

              <div className="space-y-3">
                {messages.length === 0 ? (
                  <p className="text-xs text-white/40 py-12 text-center">Hələ heç bir müraciət daxil olmayıb.</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className="p-4 rounded-xl bg-[#1a1a1a] border border-white/5 space-y-2.5 hover:border-white/20 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs text-[#F59E0B]">{msg.username}</span>
                          <span className="text-[10px] text-white/40 font-mono">ID: {msg.userId}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/60">
                            {msg.sender === 'user' ? 'Oyunçu Mesajı' : 'Admin Cavabı'}
                          </span>
                        </div>
                        <span className="text-[10px] text-white/40 font-mono">{msg.date}</span>
                      </div>

                      <p className="text-xs text-white/90 leading-relaxed bg-[#111] p-3 rounded-lg border border-white/5">
                        {msg.text}
                      </p>

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => setReplyingToUser({ id: msg.userId, name: msg.username })}
                          className="px-3.5 py-1.5 bg-[#F59E0B] text-black font-black text-xs rounded-xl transition hover:bg-amber-400 flex items-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Bu İstifadəçiyə Cavab Yaz</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal: View Deposit Receipt / Check Details */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#181818] border border-[#F59E0B]/40 max-w-md w-full rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#F59E0B]" />
                <span>Ödəniş Çeki və Oyunçu Məlumatı</span>
              </h3>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="w-8 h-8 rounded-full bg-white/5 text-white/60 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Player details */}
            <div className="bg-[#111] p-3 rounded-2xl border border-white/5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-white/50">Oyunçu Adı:</span>
                <span className="font-black text-white">{selectedReceipt.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Oyunçu ID:</span>
                <span className="font-mono text-white/70">{selectedReceipt.userId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Depozit Məbləği:</span>
                <span className="font-mono font-black text-[#F59E0B] text-sm">
                  +{((selectedReceipt && selectedReceipt.amount) || 0).toFixed(2)} ₼
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Metod və Tarix:</span>
                <span className="font-mono text-white/70">{selectedReceipt.method} • {selectedReceipt.date}</span>
              </div>
            </div>

            {/* Receipt Image Display */}
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-black max-h-64 flex items-center justify-center p-1">
              {selectedReceipt.receiptImage ? (
                <img
                  src={selectedReceipt.receiptImage}
                  alt="Ödəniş qəbzi"
                  className="max-h-60 object-contain w-full rounded-xl"
                />
              ) : (
                <p className="text-xs text-white/40 p-8">Şəkil yüklənməyib</p>
              )}
            </div>

            {/* Quick Balance Controls in Modal */}
            <div className="bg-[#111] p-3 rounded-2xl border border-white/5">
              <span className="text-[11px] text-white/50 block mb-2 font-bold">Oyunçunun Balansını Dəyiş:</span>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  onClick={() => handleQuickAdjust(selectedReceipt.userId, selectedReceipt.username, -5)}
                  className="py-1.5 bg-red-950/80 hover:bg-red-800 text-red-300 rounded-lg text-xs font-bold border border-red-500/30"
                >
                  -5 ₼
                </button>
                <button
                  onClick={() => handleQuickAdjust(selectedReceipt.userId, selectedReceipt.username, -1)}
                  className="py-1.5 bg-red-950/80 hover:bg-red-800 text-red-300 rounded-lg text-xs font-bold border border-red-500/30"
                >
                  -1 ₼
                </button>
                <button
                  onClick={() => handleQuickAdjust(selectedReceipt.userId, selectedReceipt.username, 1)}
                  className="py-1.5 bg-green-950/80 hover:bg-green-800 text-green-300 rounded-lg text-xs font-bold border border-green-500/30"
                >
                  +1 ₼
                </button>
                <button
                  onClick={() => handleQuickAdjust(selectedReceipt.userId, selectedReceipt.username, 5)}
                  className="py-1.5 bg-green-950/80 hover:bg-green-800 text-green-300 rounded-lg text-xs font-bold border border-green-500/30"
                >
                  +5 ₼
                </button>
              </div>
            </div>

            {/* Deposit Approve / Reject Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleApproveDeposit(selectedReceipt)}
                className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-black font-black text-xs rounded-xl transition uppercase tracking-wider active:scale-95 cursor-pointer"
              >
                Təsdiqlə (+{((selectedReceipt && selectedReceipt.amount) || 0).toFixed(2)} ₼)
              </button>
              <button
                onClick={() => handleRejectDeposit(selectedReceipt)}
                className="flex-1 py-3 bg-red-600/30 hover:bg-red-600/50 border border-red-500/40 text-red-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                İmtina Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Admin Balance Manager (Artır / Azalt / Sıfırla / Təyin Et) */}
      {balanceEditUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#181818] border border-[#F59E0B]/40 max-w-sm w-full rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#F59E0B]" />
                <h3 className="text-sm font-black text-white">Balans İdarəetməsi</h3>
              </div>
              <button
                onClick={() => setBalanceEditUser(null)}
                className="w-7 h-7 rounded-full bg-white/5 text-white/60 hover:text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* User details & Live Projected Balance */}
            <div className="bg-[#111] p-3 rounded-2xl border border-white/5 space-y-2">
              <div className="flex items-center gap-3">
                <img src={balanceEditUser.avatar} alt={balanceEditUser.username} className="w-10 h-10 rounded-xl bg-black" />
                <div>
                  <span className="font-black text-white text-xs block">{balanceEditUser.username}</span>
                  <span className="text-xs text-[#F59E0B] font-mono font-bold">
                    Cari Balans: {((balanceEditUser && balanceEditUser.balance) || 0).toFixed(2)} ₼
                  </span>
                </div>
              </div>

              {/* Calculated Result Preview */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-white/50">Əməliyyatdan Sonrakı:</span>
                <span className="font-mono font-black text-green-400 text-sm">
                  {(() => {
                    const num = parseFloat(balanceAdjustmentAmount) || 0;
                    if (balanceMode === 'set') {
                      return `${num.toFixed(2)} ₼`;
                    }
                    const isDecrease = balanceReason.includes('Azalt') || balanceReason.includes('Çıxarış');
                    const next = Math.max(0, ((balanceEditUser && balanceEditUser.balance) || 0) + (isDecrease ? -num : num));
                    return `${next.toFixed(2)} ₼`;
                  })()}
                </span>
              </div>
            </div>

            {/* Mode selection: Artır/Azalt vs Birbaşa Təyin */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBalanceMode('adjust')}
                className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                  balanceMode === 'adjust' ? 'bg-[#F59E0B] text-black font-black' : 'bg-white/5 text-white/60'
                }`}
              >
                Artır / Azalt (+ / -)
              </button>
              <button
                type="button"
                onClick={() => setBalanceMode('set')}
                className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                  balanceMode === 'set' ? 'bg-[#F59E0B] text-black font-black' : 'bg-white/5 text-white/60'
                }`}
              >
                Birbaşa Məbləğ Təyin Et
              </button>
            </div>

            {/* Reason selector (Artır və ya Azalt) */}
            {balanceMode === 'adjust' && (
              <div>
                <label className="text-xs text-white/50 block mb-1 font-bold">Əməliyyat Növü</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBalanceReason('Admin Balans Artırımı')}
                    className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
                      !balanceReason.includes('Azalt') && !balanceReason.includes('Çıxarış')
                        ? 'bg-green-600 text-black font-black'
                        : 'bg-white/5 text-white/60'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Balansı Artır (+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBalanceReason('Admin Balans Azaldılması')}
                    className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
                      balanceReason.includes('Azalt') || balanceReason.includes('Çıxarış')
                        ? 'bg-red-600 text-white font-black'
                        : 'bg-white/5 text-white/60'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                    <span>Balansı Azalt (-)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Amount input & preset buttons */}
            <div>
              <label className="text-xs text-white/50 block mb-1 font-bold">
                {balanceMode === 'adjust' ? 'Dəyişiklik Məbləği (₼)' : 'Yeni Dəqiq Balans (₼)'}
              </label>
              <input
                type="number"
                step="0.50"
                value={balanceAdjustmentAmount}
                onChange={(e) => setBalanceAdjustmentAmount(e.target.value)}
                className="w-full bg-[#111] border border-white/10 rounded-xl p-3 text-sm font-mono font-bold text-white focus:outline-none focus:border-[#F59E0B]"
                autoFocus
              />

              <div className="grid grid-cols-5 gap-1.5 mt-2">
                {['1', '5', '10', '50', '100'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBalanceAdjustmentAmount(preset)}
                    className="py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-white/80 cursor-pointer transition"
                  >
                    {preset} ₼
                  </button>
                ))}
              </div>
            </div>

            {/* Quick 1-Click Zero Out Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => handleResetBalance(balanceEditUser.id, balanceEditUser.username)}
                className="w-full py-2 bg-red-950/80 hover:bg-red-800 border border-red-500/40 text-red-300 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Balansı Dərhal Sıfırla (0.00 ₼)</span>
              </button>
            </div>

            <button
              onClick={handleSaveBalanceModal}
              className="w-full py-3 bg-[#F59E0B] hover:bg-amber-400 text-black font-black text-xs rounded-xl transition uppercase tracking-wider shadow-lg active:scale-95 cursor-pointer"
            >
              Balansı Saxla və Tətbiq Et
            </button>
          </div>
        </div>
      )}

      {/* Modal: Admin Reply to User */}
      {replyingToUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#181818] border border-[#F59E0B]/40 max-w-md w-full rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#F59E0B]" />
                <span>Cavab Göndər: {replyingToUser.name}</span>
              </h3>
              <button
                onClick={() => setReplyingToUser(null)}
                className="w-8 h-8 rounded-full bg-white/5 text-white/60 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <textarea
              rows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Oyunçunun ekranında bildiriş kimi çıxacaq rəsmi admin cavabını yazın..."
              className="w-full bg-[#111] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#F59E0B]"
              autoFocus
            />

            <button
              onClick={handleSendReply}
              className="w-full py-3 bg-[#F59E0B] hover:bg-amber-400 text-black font-black text-xs rounded-xl transition uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg active:scale-95 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Cavabı Göndər</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal: Delete & Ban User Confirmation */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1a1212] border-2 border-red-500/60 max-w-md w-full rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-red-500/20 pb-3">
              <div className="flex items-center gap-2 text-red-400 font-black text-sm">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span>İstifadəçini Sil və Ləğv Et</span>
              </div>
              <button
                onClick={() => setUserToDelete(null)}
                className="w-8 h-8 rounded-full bg-white/5 text-white/60 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/30 text-xs text-red-200 space-y-2">
              <p className="font-bold text-sm text-white flex items-center gap-2">
                <UserX className="w-4 h-4 text-red-400" />
                <span>{userToDelete.username}</span>
                <span className="font-mono text-[10px] text-white/50">(ID: {userToDelete.id})</span>
              </p>
              <p>
                Cari Balans: <strong className="text-amber-300 font-mono">{((userToDelete && userToDelete.balance) || 0).toFixed(2)} ₼</strong>
              </p>
              <p className="text-[11px] text-red-300/80">
                ⚠️ Bu əməliyyat istifadəçinin bütün qeydiyyatını, balansını, qeydlərini bazadan birdəfəlik silir və sistemə girişini ləğv edir.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition"
              >
                Ləğv Et
              </button>
              <button
                onClick={handleConfirmDeleteUser}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Bəli, Hesabı Sil</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
