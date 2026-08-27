import React, { useState, useEffect } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { GameTable } from './components/GameTable';
import { WalletModal } from './components/WalletModal';
import { BonusModal } from './components/BonusModal';
import { RulesModal } from './components/RulesModal';
import { SupportModal } from './components/SupportModal';
import { ReportModal } from './components/ReportModal';
import { CreateRoomModal } from './components/CreateRoomModal';
import { SettingsModal } from './components/SettingsModal';
import { AdminDashboard } from './components/AdminDashboard';
import { Room, UserProfile, WalletTransaction, BalanceMode, PlayerMessage } from './types';
import { 
  auth, 
  onAuthStateChanged, 
  signOut 
} from './firebase';
import { 
  syncUserProfileToFirestore, 
  getUserProfileFromFirestore, 
  subscribeToUserProfile,
  subscribeToUserTransactions,
  recordTransactionInFirestore,
  updateUserBalanceInFirestore,
  subscribeToRoomsList,
  createRoomInFirestore,
  subscribeToAllUsers,
  subscribeToPlayerMessages,
  sendPlayerMessageToFirestore,
  deletePlayerMessageInFirestore,
  markPlayerMessageAsRead,
  cleanUpEmptyAndStaleRoomsInFirestore,
} from './services/firebaseService';

export default function App() {
  // Check saved session in localStorage
  const getSavedUser = (): UserProfile | null => {
    try {
      const saved = localStorage.getItem('seka_logged_in_user');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return null;
  };

  const initialSavedUser = getSavedUser();

  // Screen routing: 'auth' | 'lobby' | 'table' | 'admin'
  // If no saved user, directly open 'auth' screen so visitor registers or logs in with their own name
  const [currentScreen, setCurrentScreen] = useState<'auth' | 'lobby' | 'table' | 'admin'>(
    initialSavedUser ? 'lobby' : 'auth'
  );

  // Active User Profile
  const [user, setUser] = useState<UserProfile>(
    initialSavedUser || {
      id: '',
      username: '',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      balance: 0.00, // Cüzdan / Depozit Balansı (yalnız depozit ilə artır)
      bonusBalance: 0.00, // Bonus Balansı (0.00 ₼)
      gamesPlayed: 0,
      gamesWon: 0,
      biggestPotWon: 0,
      sekaCount: 0,
      bonusClaimed: false,
    }
  );

  // Wallet Transactions Log (Synced with Firestore)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  // Registered Users & Player Messages (Synced with Firestore)
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [playerMessages, setPlayerMessages] = useState<PlayerMessage[]>([]);

  // Listen to Firebase Auth state
  useEffect(() => {
    if (user.id) {
      getUserProfileFromFirestore(user.id).then((profile) => {
        if (profile) {
          setUser((prev) => {
            const updated = { ...prev, ...profile };
            localStorage.setItem('seka_logged_in_user', JSON.stringify(updated));
            return updated;
          });
        }
      }).catch(() => {});
    }

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Fetch or create user in Firestore
        const profile = await getUserProfileFromFirestore(fbUser.uid);
        if (profile) {
          setUser(profile);
          localStorage.setItem('seka_logged_in_user', JSON.stringify(profile));
          if (currentScreen === 'auth') {
            setCurrentScreen('lobby');
          }
        }
      }
    });

    return () => unsubAuth();
  }, []);

  // Listen to Realtime Firestore Profile, Transactions, All Users, and Player Messages
  useEffect(() => {
    if (!user.id) return;

    // Realtime User Updates
    const unsubUser = subscribeToUserProfile(user.id, (updatedProfile) => {
      setUser((prev) => ({
        ...prev,
        balance: updatedProfile.balance !== undefined ? updatedProfile.balance : prev.balance,
        bonusBalance: updatedProfile.bonusBalance !== undefined ? updatedProfile.bonusBalance : prev.bonusBalance,
        gamesPlayed: updatedProfile.gamesPlayed !== undefined ? updatedProfile.gamesPlayed : prev.gamesPlayed,
        gamesWon: updatedProfile.gamesWon !== undefined ? updatedProfile.gamesWon : prev.gamesWon,
        bonusClaimed: updatedProfile.bonusClaimed !== undefined ? updatedProfile.bonusClaimed : prev.bonusClaimed,
      }));
    });

    // Realtime Transactions Updates
    const unsubTx = subscribeToUserTransactions(user.id, (txList) => {
      if (txList && txList.length > 0) {
        setTransactions(txList);
      }
    });

    // Realtime All Registered Users
    const unsubAllUsers = subscribeToAllUsers((usersList) => {
      if (usersList) {
        setAllUsers(usersList);
      }
    });

    // Realtime Player Messages for this user
    const unsubMsgs = subscribeToPlayerMessages(user.id, (msgList) => {
      if (msgList) {
        setPlayerMessages(msgList);
      }
    });

    return () => {
      unsubUser();
      unsubTx();
      unsubAllUsers();
      unsubMsgs();
    };
  }, [user.id]);

  // Unread messages count for footstep indicator (👣)
  const unreadMessagesCount = playerMessages.filter(
    (m) => m.toUserId === user.id && !m.read
  ).length;

  const handleSendPlayerMessage = async (
    toUserId: string,
    toUsername: string,
    text: string,
    category: 'proposal' | 'critique' | 'general' = 'proposal'
  ) => {
    const res = await sendPlayerMessageToFirestore({
      fromUserId: user.id,
      fromUsername: user.username,
      fromAvatar: user.avatar,
      toUserId,
      toUsername,
      text,
      category,
    });
    return !!res;
  };

  const handleDeletePlayerMessage = async (messageId: string) => {
    await deletePlayerMessageInFirestore(messageId);
  };

  const handleMarkMessageAsRead = async (messageId: string) => {
    await markPlayerMessageAsRead(messageId);
  };

  // Rooms List - Starts empty; only real active games loaded from Firestore
  const [rooms, setRooms] = useState<Room[]>([]);

  // Selected Room for Table
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [activeBalanceMode, setActiveBalanceMode] = useState<BalanceMode>('wallet');

  // Subscribe to real rooms in Firestore & auto-cleanup empty/stale tables
  useEffect(() => {
    // Purge any stale or empty test rooms in the database on load
    cleanUpEmptyAndStaleRoomsInFirestore().catch(() => {});

    const unsubRooms = subscribeToRoomsList((firestoreRooms) => {
      if (firestoreRooms && firestoreRooms.length > 0) {
        setRooms(firestoreRooms.map((r: any) => ({
          id: r.id,
          name: r.name || `Oyun otağı #${r.id}`,
          stake: typeof r.stake === 'number' ? r.stake : 0.20,
          maxPlayers: r.maxPlayers || 4,
          currentPlayers: Array.isArray(r.players) ? r.players.length : (r.currentPlayers || 1),
          status: (Array.isArray(r.players) && r.players.length >= 2) ? 'in_game' : 'waiting',
          isSekaOnly: !!r.isSekaOnly,
          isPrivate: !!r.isPrivate,
        })));
      } else {
        setRooms([]);
      }
    });
    return () => unsubRooms();
  }, []);

  // Modals state
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [walletTab, setWalletTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [isBonusOpen, setIsBonusOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Handlers
  const handleLogin = (userProfile: UserProfile) => {
    setUser(userProfile);
    try {
      localStorage.setItem('seka_logged_in_user', JSON.stringify(userProfile));
    } catch {}
    syncUserProfileToFirestore(userProfile).catch(() => {});
    setCurrentScreen('lobby');
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('seka_logged_in_user');
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
    setIsSettingsOpen(false);
    setUser({
      id: '',
      username: '',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      balance: 0.00,
      bonusBalance: 0.00,
      gamesPlayed: 0,
      gamesWon: 0,
      biggestPotWon: 0,
      sekaCount: 0,
      bonusClaimed: false,
    });
    setCurrentScreen('auth');
  };

  const handleUpdateUser = (updated: Partial<UserProfile>) => {
    setUser((prev) => {
      const updatedUser = { ...prev, ...updated };
      syncUserProfileToFirestore(updatedUser).catch(() => {});
      return updatedUser;
    });
  };

  const handleJoinRoom = (room: Room, isSpectator = false, balanceMode: BalanceMode = 'wallet') => {
    setActiveRoom(room);
    setActiveBalanceMode(balanceMode);
    setCurrentScreen('table');
  };

  const handleLeaveTable = () => {
    setCurrentScreen('lobby');
  };

  const handleWithdraw = (amount: number): boolean => {
    if (user.balance < amount) return false;
    const newBal = user.balance - amount;
    setUser((prev) => ({
      ...prev,
      balance: newBal,
    }));

    // Sync to Firestore
    updateUserBalanceInFirestore(user.id, -amount).catch(() => {});
    recordTransactionInFirestore(user.id, {
      type: 'withdraw',
      amount,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'completed',
      method: 'Bank Kartı',
    }).catch(() => {});

    return true;
  };

  const handleClaimBonus = async (amount: number = 5.0) => {
    // Real deposit balance (user.balance) stays at its real amount (0.00 until deposited)
    // Bonus balance becomes 5.00 for betting in tables
    const newBonusBal = (user.bonusBalance || 0) + amount;
    const updatedUser = {
      ...user,
      bonusBalance: newBonusBal,
      bonusClaimed: true,
    };
    setUser(updatedUser);

    // Sync to Firestore
    await syncUserProfileToFirestore(updatedUser);
    await recordTransactionInFirestore(user.id, {
      type: 'bonus',
      amount,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'completed',
      method: '5.00 ₼ Xoş Gəldin Bonusu (Masalarda Mərc Üçün)',
    });
  };

  const handleUpdateBalance = (newBalance: number, mode: BalanceMode = activeBalanceMode) => {
    if (mode === 'bonus') {
      setUser((prev) => {
        const updated = { ...prev, bonusBalance: newBalance };
        syncUserProfileToFirestore(updated).catch(() => {});
        return updated;
      });
    } else {
      setUser((prev) => {
        const updated = { ...prev, balance: newBalance };
        updateUserBalanceInFirestore(user.id, 0, true, newBalance).catch(() => {});
        return updated;
      });
    }
  };

  const handleCreateRoom = (roomData: {
    name: string;
    stake: number;
    maxPlayers: number;
    isSekaOnly: boolean;
    isPrivate: boolean;
    balanceMode?: BalanceMode;
  }) => {
    const newRoom: Room = {
      id: Math.floor(100000 + Math.random() * 900000).toString(),
      name: roomData.name,
      stake: roomData.stake,
      maxPlayers: roomData.maxPlayers,
      currentPlayers: 1,
      status: 'waiting',
      isSekaOnly: roomData.isSekaOnly,
      isPrivate: roomData.isPrivate,
      creatorId: user.id,
    };

    const effectiveCreatorBalance = (roomData.balanceMode === 'bonus') ? (user.bonusBalance || 0) : (user.balance || 0);

    // Save to Firestore with immediate seated player data
    createRoomInFirestore({
      id: newRoom.id,
      name: newRoom.name,
      stake: newRoom.stake,
      maxPlayers: newRoom.maxPlayers,
      isSekaOnly: newRoom.isSekaOnly,
      isPrivate: newRoom.isPrivate,
      creatorId: user.id,
      creatorName: user.username,
      creatorAvatar: user.avatar,
      creatorBalance: effectiveCreatorBalance,
    }).catch(() => {});

    setRooms((prev) => [newRoom, ...prev]);
    setActiveRoom(newRoom);
    setActiveBalanceMode(roomData.balanceMode || 'wallet');
    setCurrentScreen('table');
  };

  const handleRefreshRooms = () => {
    // Manually trigger cleanup of any abandoned or empty tables
    cleanUpEmptyAndStaleRoomsInFirestore().catch(() => {});
  };

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Screen Router */}
      {currentScreen === 'auth' && (
        <AuthScreen
          onLogin={handleLogin}
          onOpenSupport={() => setIsSupportOpen(true)}
          onOpenAdmin={() => setCurrentScreen('admin')}
        />
      )}

      {currentScreen === 'admin' && (
        <AdminDashboard
          onBackToLogin={() => setCurrentScreen('auth')}
          rooms={rooms}
          onJoinRoom={handleJoinRoom}
        />
      )}

      {currentScreen === 'lobby' && (
        <LobbyScreen
          user={user}
          rooms={rooms}
          unreadMessagesCount={unreadMessagesCount}
          onJoinRoom={handleJoinRoom}
          onOpenCreateRoom={() => setIsCreateRoomOpen(true)}
          onOpenWallet={() => {
            setWalletTab('deposit');
            setIsWalletOpen(true);
          }}
          onOpenDeposit={() => {
            setWalletTab('deposit');
            setIsWalletOpen(true);
          }}
          onOpenWithdraw={() => {
            setWalletTab('withdraw');
            setIsWalletOpen(true);
          }}
          onOpenBonus={() => {
            if (!user.bonusClaimed) {
              handleClaimBonus(5.0);
            }
            setIsBonusOpen(true);
          }}
          onClaimBonus={handleClaimBonus}
          onOpenRules={() => setIsRulesOpen(true)}
          onOpenSupport={() => setIsSupportOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLogout={handleLogout}
          onRefreshRooms={handleRefreshRooms}
        />
      )}

      {currentScreen === 'table' && activeRoom && (
        <GameTable
          room={activeRoom}
          user={user}
          balanceMode={activeBalanceMode}
          unreadMessagesCount={unreadMessagesCount}
          onLeaveTable={handleLeaveTable}
          onOpenWallet={() => {
            setWalletTab('deposit');
            setIsWalletOpen(true);
          }}
          onOpenBonus={() => {
            if (!user.bonusClaimed) {
              handleClaimBonus(5.0);
            }
            setIsBonusOpen(true);
          }}
          onClaimBonus={handleClaimBonus}
          onOpenSupport={() => setIsSupportOpen(true)}
          onOpenReport={() => setIsReportOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onUpdateBalance={handleUpdateBalance}
        />
      )}

      {/* Global Modals */}
      <WalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        user={user}
        onWithdraw={handleWithdraw}
        transactions={transactions}
        initialTab={walletTab}
      />

      <BonusModal
        isOpen={isBonusOpen}
        onClose={() => setIsBonusOpen(false)}
        onClaimBonus={handleClaimBonus}
        hasClaimedWelcomeBonus={user.bonusClaimed}
      />

      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />

      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        user={user}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
        allUsers={allUsers}
        playerMessages={playerMessages}
        onOpenSupport={() => setIsSupportOpen(true)}
        onOpenWallet={() => setIsWalletOpen(true)}
        onLogout={handleLogout}
        onUpdateUser={handleUpdateUser}
        onSendPlayerMessage={handleSendPlayerMessage}
        onDeletePlayerMessage={handleDeletePlayerMessage}
        onMarkMessageAsRead={handleMarkMessageAsRead}
      />

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        roomId={activeRoom?.id}
      />

      <CreateRoomModal
        isOpen={isCreateRoomOpen}
        onClose={() => setIsCreateRoomOpen(false)}
        onCreateRoom={handleCreateRoom}
        userBalance={user.balance}
        bonusBalance={user.bonusBalance}
      />
    </div>
  );
}
