import {
  db,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  getDocs,
  where,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  increment,
} from '../firebase';
import { UserProfile, WalletTransaction, TableRake, PlayerMessage, ActivityLog } from '../types';

export interface DepositReceipt {
  id?: string;
  userId: string;
  username: string;
  amount: number;
  paymentMethod: string;
  receiptName?: string;
  receiptDataUrl?: string; // base64 or storage url
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  approvedAt?: any;
  notes?: string;
  isEmergencyDeposit?: boolean;
}

// 1. Sync / Save User Profile in Firestore
export const syncUserProfileToFirestore = async (user: UserProfile) => {
  try {
    const userRef = doc(db, 'users', user.id);
    await setDoc(userRef, {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      balance: user.balance,
      bonusBalance: user.bonusBalance !== undefined ? user.bonusBalance : 0,
      gamesPlayed: user.gamesPlayed,
      gamesWon: user.gamesWon,
      biggestPotWon: user.biggestPotWon,
      sekaCount: user.sekaCount,
      bonusClaimed: user.bonusClaimed,
      lastActive: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('Error syncing user profile to Firestore:', error);
  }
};

// 2. Fetch User Profile from Firestore
export const getUserProfileFromFirestore = async (userId: string): Promise<UserProfile | null> => {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile from Firestore:', error);
    return null;
  }
};

// 3. Listen to Realtime User Balance and Profile Updates
export const subscribeToUserProfile = (userId: string, onUpdate: (user: UserProfile) => void) => {
  const userRef = doc(db, 'users', userId);
  return onSnapshot(userRef, (docSnap) => {
    if (docSnap.exists()) {
      onUpdate(docSnap.data() as UserProfile);
    }
  }, (err) => {
    console.error('User subscription error:', err);
  });
};

// 4. Update User Balance in Firestore
export const updateUserBalanceInFirestore = async (userId: string, deltaBalance: number, isAbsolute = false, absoluteBalance?: number) => {
  try {
    const userRef = doc(db, 'users', userId);
    if (isAbsolute && absoluteBalance !== undefined) {
      await setDoc(userRef, {
        id: userId,
        balance: absoluteBalance,
        lastActive: serverTimestamp(),
      }, { merge: true });
    } else {
      await setDoc(userRef, {
        id: userId,
        balance: increment(deltaBalance),
        lastActive: serverTimestamp(),
      }, { merge: true });
    }
  } catch (error) {
    console.error('Error updating balance in Firestore:', error);
  }
};

// 5. Submit Deposit Request with Receipt (Çek) to Firestore
export const submitDepositToFirestore = async (deposit: {
  userId: string;
  username: string;
  amount: number;
  paymentMethod: string;
  receiptName?: string;
  receiptDataUrl?: string;
  isEmergencyDeposit?: boolean;
}) => {
  try {
    const depositsCol = collection(db, 'deposits');
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const docRef = await addDoc(depositsCol, {
      userId: deposit.userId,
      username: deposit.username,
      amount: deposit.amount,
      paymentMethod: deposit.paymentMethod,
      method: deposit.paymentMethod,
      type: 'deposit',
      receiptName: deposit.receiptName || 'Bilinməyən çek',
      receiptDataUrl: deposit.receiptDataUrl || null,
      receiptImage: deposit.receiptDataUrl || null,
      status: 'pending',
      date: nowIso,
      isEmergencyDeposit: !!deposit.isEmergencyDeposit,
      createdAt: serverTimestamp(),
    });

    // Also record initial transaction in transactions subcollection
    const txCol = collection(db, 'users', deposit.userId, 'transactions');
    await addDoc(txCol, {
      type: 'deposit',
      amount: deposit.amount,
      method: deposit.paymentMethod,
      status: 'pending',
      receiptId: docRef.id,
      date: nowIso,
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error('Error submitting deposit to Firestore:', error);
    return null;
  }
};

// 5b. Submit Withdrawal Request (Çıxarış Sorğusu) to Firestore
export const submitWithdrawalToFirestore = async (withdrawal: {
  userId: string;
  username: string;
  amount: number;
  cardNumber: string;
}) => {
  try {
    const depositsCol = collection(db, 'deposits');
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 16);
    
    // 1. Deduct / Hold from balance immediately
    await updateUserBalanceInFirestore(withdrawal.userId, -withdrawal.amount);

    // 2. Add withdrawal record to deposits (admin waiting list)
    const docRef = await addDoc(depositsCol, {
      userId: withdrawal.userId,
      username: withdrawal.username,
      amount: withdrawal.amount,
      type: 'withdrawal',
      method: `Bank Kartı: ${withdrawal.cardNumber}`,
      cardNumber: withdrawal.cardNumber,
      paymentMethod: `Kart: ${withdrawal.cardNumber}`,
      status: 'pending',
      date: nowIso,
      createdAt: serverTimestamp(),
    });

    // 3. Record pending transaction in user transactions
    const txCol = collection(db, 'users', withdrawal.userId, 'transactions');
    await addDoc(txCol, {
      type: 'withdraw',
      amount: withdrawal.amount,
      method: `Kart: ${withdrawal.cardNumber}`,
      status: 'pending',
      receiptId: docRef.id,
      date: nowIso,
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error('Error submitting withdrawal to Firestore:', error);
    return null;
  }
};

// 5c. Admin Approve Withdrawal
export const approveWithdrawalInFirestore = async (withdrawalId: string, userId: string, amount: number) => {
  try {
    const withdrawalRef = doc(db, 'deposits', withdrawalId);
    await updateDoc(withdrawalRef, {
      status: 'approved',
      approvedAt: serverTimestamp(),
    });

    // Record completed transaction update
    await recordTransactionInFirestore(userId, {
      type: 'withdraw',
      amount,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'completed',
      method: 'Admin Tərəfindən Kartınıza Ödənildi',
    });

    return true;
  } catch (error) {
    console.error('Error approving withdrawal:', error);
    return false;
  }
};

// 5d. Admin Reject Withdrawal (Refund balance back to player)
export const rejectWithdrawalInFirestore = async (withdrawalId: string, userId: string, amount: number, reason?: string) => {
  try {
    const withdrawalRef = doc(db, 'deposits', withdrawalId);
    await updateDoc(withdrawalRef, {
      status: 'rejected',
      rejectedReason: reason || 'Admin tərəfindən imtina edildi',
      rejectedAt: serverTimestamp(),
    });

    // Refund player balance
    await updateUserBalanceInFirestore(userId, amount);

    await recordTransactionInFirestore(userId, {
      type: 'bonus',
      amount,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'completed',
      method: `Çıxarış İmtinası - Balans Qaytarıldı (${reason || 'Məlumat xətası'})`,
    });

    return true;
  } catch (error) {
    console.error('Error rejecting withdrawal:', error);
    return false;
  }
};

// 6. Record Wallet Transaction (Deposit, Withdraw, Bet, Win, Bonus)
export const recordTransactionInFirestore = async (userId: string, tx: Omit<WalletTransaction, 'id'>) => {
  try {
    const txCol = collection(db, 'users', userId, 'transactions');
    const docRef = await addDoc(txCol, {
      ...tx,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error recording transaction:', error);
    return null;
  }
};

// 7. Subscribe to User Wallet Transactions Realtime
export const subscribeToUserTransactions = (userId: string, onUpdate: (txs: WalletTransaction[]) => void) => {
  const txCol = collection(db, 'users', userId, 'transactions');
  const q = query(txCol, orderBy('createdAt', 'desc'), limit(25));
  return onSnapshot(q, (snapshot) => {
    const list: WalletTransaction[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        type: data.type,
        amount: data.amount,
        date: data.date || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: data.status || 'completed',
        method: data.method,
      };
    });
    onUpdate(list);
  }, (err) => {
    console.error('Transactions subscription error:', err);
  });
};

// 8. Subscribe to All Pending Deposits (for Admin Control and Verification)
export const subscribeToPendingDeposits = (onUpdate: (deposits: DepositReceipt[]) => void) => {
  const depositsCol = collection(db, 'deposits');
  const q = query(depositsCol, orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snapshot) => {
    const list: DepositReceipt[] = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<DepositReceipt, 'id'>),
    }));
    onUpdate(list);
  }, (err) => {
    console.error('Pending deposits subscription error:', err);
  });
};

// 9. Admin Approve / Reject Deposit
export const approveDepositInFirestore = async (depositId: string, userId: string, amount: number) => {
  try {
    const depositRef = doc(db, 'deposits', depositId);
    await updateDoc(depositRef, {
      status: 'approved',
      approvedAt: serverTimestamp(),
    });

    // Automatically increase user balance
    await updateUserBalanceInFirestore(userId, amount);

    // Record approved transaction
    await recordTransactionInFirestore(userId, {
      type: 'deposit',
      amount,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'completed',
      method: 'Admin Təsdiqli Depozit',
    });

    return true;
  } catch (error) {
    console.error('Error approving deposit:', error);
    return false;
  }
};

// 10. Send Message to Admin (Dəstək və Adminlə Əlaqə)
export interface AdminMessage {
  id?: string;
  userId: string;
  username: string;
  text: string;
  sender: 'user' | 'admin' | 'bot';
  createdAt?: any;
  date?: string;
  status?: 'unread' | 'read' | 'replied';
  subject?: string;
}

export const sendAdminMessageToFirestore = async (msg: {
  userId: string;
  username: string;
  text: string;
  subject?: string;
}) => {
  try {
    const msgCol = collection(db, 'admin_messages');
    const docRef = await addDoc(msgCol, {
      userId: msg.userId,
      username: msg.username,
      text: msg.text,
      sender: 'user',
      subject: msg.subject || 'Ümumi Müraciət',
      status: 'unread',
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error sending message to admin:', error);
    return null;
  }
};

// 11. Subscribe to User Messages with Admin
export const subscribeToAdminMessages = (userId: string, onUpdate: (messages: AdminMessage[]) => void) => {
  const msgCol = collection(db, 'admin_messages');
  const q = query(msgCol, orderBy('createdAt', 'asc'), limit(50));
  return onSnapshot(q, (snapshot) => {
    const list: AdminMessage[] = snapshot.docs
      .map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AdminMessage, 'id'>),
      }))
      .filter((m) => m.userId === userId || m.userId === 'all');
    onUpdate(list);
  }, (err) => {
    console.error('Admin messages subscription error:', err);
  });
};

// 12. Admin Reject Deposit
export const rejectDepositInFirestore = async (depositId: string, reason?: string) => {
  try {
    const depositRef = doc(db, 'deposits', depositId);
    await updateDoc(depositRef, {
      status: 'rejected',
      rejectedReason: reason || 'Admin tərəfindən imtina edildi',
      rejectedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Error rejecting deposit:', error);
    return false;
  }
};

// 13. Subscribe to All Users (Admin Dashboard)
export const subscribeToAllUsers = (onUpdate: (users: UserProfile[]) => void) => {
  const usersCol = collection(db, 'users');
  const q = query(usersCol, limit(100));
  return onSnapshot(q, (snapshot) => {
    const list: UserProfile[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        username: data.username || 'Oyunçu',
        avatar: data.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${docSnap.id}`,
        balance: typeof data.balance === 'number' ? data.balance : 0,
        bonusBalance: typeof data.bonusBalance === 'number' ? data.bonusBalance : 0,
        gamesPlayed: data.gamesPlayed || 0,
        gamesWon: data.gamesWon || 0,
        biggestPotWon: data.biggestPotWon || 0,
        sekaCount: data.sekaCount || data.sekasWon || 0,
        bonusClaimed: Boolean(data.bonusClaimed),
      };
    });
    onUpdate(list);
  }, (err) => {
    console.error('Users subscription error:', err);
  });
};

// 14. Subscribe to All Admin Messages (for Admin view)
export const subscribeToAllAdminMessages = (onUpdate: (messages: AdminMessage[]) => void) => {
  const msgCol = collection(db, 'admin_messages');
  const q = query(msgCol, orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, (snapshot) => {
    const list: AdminMessage[] = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AdminMessage, 'id'>),
    }));
    onUpdate(list);
  }, (err) => {
    console.error('All admin messages subscription error:', err);
  });
};

// 15. Admin Send Reply to User
export const adminSendReplyToUser = async (targetUserId: string, replyText: string) => {
  try {
    const msgCol = collection(db, 'admin_messages');
    await addDoc(msgCol, {
      userId: targetUserId,
      username: 'ADMIN ♠',
      text: replyText,
      sender: 'admin',
      subject: 'Admin Cavabı',
      status: 'replied',
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Error sending admin reply:', error);
    return false;
  }
};

// 16. Admin Update / Gift User Balance directly (Set exact amount)
export const adminUpdateUserBalance = async (userId: string, newBalance: number, reason = 'Admin Düzəlişi') => {
  try {
    const userRef = doc(db, 'users', userId);
    const targetBalance = Math.max(0, Number(newBalance) || 0);

    await setDoc(userRef, {
      id: userId,
      balance: targetBalance,
      updatedAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    }, { merge: true });

    await recordTransactionInFirestore(userId, {
      type: targetBalance === 0 ? 'withdraw' : 'bonus',
      amount: targetBalance,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'completed',
      method: reason,
    });

    return true;
  } catch (error) {
    console.error('Error updating user balance by admin:', error);
    return false;
  }
};

// 17. Admin Adjust User Balance (Artır / Azalt) with Transaction Logging
export const adminAdjustUserBalance = async (
  userId: string,
  delta: number,
  reason = 'Admin Balans Düzəlişi'
) => {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    const currentBalance = snap.exists() ? ((snap.data().balance as number) || 0) : 0;
    const finalBalance = Math.max(0, currentBalance + delta);

    await setDoc(userRef, {
      id: userId,
      balance: finalBalance,
      updatedAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    }, { merge: true });

    await recordTransactionInFirestore(userId, {
      type: delta >= 0 ? 'bonus' : 'withdraw',
      amount: Math.abs(delta),
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'completed',
      method: `${reason}: ${delta >= 0 ? '+' : '-'}${Math.abs(delta || 0).toFixed(2)} ₼ (Yeni Balans: ${(finalBalance || 0).toFixed(2)} ₼)`,
    });

    return true;
  } catch (error) {
    console.error('Error adjusting user balance:', error);
    return false;
  }
};

// 18. Admin Reset User Balance to Zero (0.00 ₼)
export const adminResetUserBalance = async (userId: string, reason = 'Admin Tərəfindən Balans Sıfırlandı (0.00 ₼)') => {
  return adminUpdateUserBalance(userId, 0, reason);
};

// 19. Record 10% Table Rake / Commission in Firestore
export const recordTableRakeInFirestore = async (rake: Omit<TableRake, 'id'>) => {
  try {
    const rakesCol = collection(db, 'table_rakes');
    const docRef = await addDoc(rakesCol, {
      ...rake,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error recording table rake in Firestore:', error);
    return null;
  }
};

// 20. Subscribe to All Table Rakes (for Admin Dashboard)
export const subscribeToTableRakes = (onUpdate: (rakes: TableRake[]) => void) => {
  const rakesCol = collection(db, 'table_rakes');
  const q = query(rakesCol, orderBy('createdAt', 'desc'), limit(200));
  return onSnapshot(q, (snapshot) => {
    const list: TableRake[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        roomId: data.roomId || '',
        roomName: data.roomName || 'Otaq',
        totalPot: typeof data.totalPot === 'number' ? data.totalPot : 0,
        rakeAmount: typeof data.rakeAmount === 'number' ? data.rakeAmount : 0,
        netPayout: typeof data.netPayout === 'number' ? data.netPayout : 0,
        winnerId: data.winnerId || '',
        winnerName: data.winnerName || 'Qalib',
        roundNumber: data.roundNumber || 1,
        stake: typeof data.stake === 'number' ? data.stake : 0.20,
        date: data.date || new Date().toISOString().replace('T', ' ').substring(0, 16),
        createdAt: data.createdAt,
      };
    });
    onUpdate(list);
  }, (err) => {
    console.error('Table rakes subscription error:', err);
  });
};

// 21. Check if Device Fingerprint or IMEI is already registered
export const checkDeviceRegistration = async (
  deviceId: string,
  imei: string
): Promise<{ isBlocked: boolean; reason?: string; registeredUser?: string }> => {
  try {
    // 1. Check direct doc in registered_devices by deviceId
    const safeDocId = deviceId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const deviceRef = doc(db, 'registered_devices', safeDocId);
    const snap = await getDoc(deviceRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        isBlocked: true,
        reason: 'Bu cihazdan artıq qeydiyyatdan keçilib və 5.00 ₼ bonus istifadə edilib.',
        registeredUser: data.username || 'Qeydiyyatlı İstifadəçi',
      };
    }

    // 2. Also check if IMEI was registered
    if (imei) {
      const imeiDocId = `IMEI_${imei}`;
      const imeiRef = doc(db, 'registered_devices', imeiDocId);
      const imeiSnap = await getDoc(imeiRef);
      if (imeiSnap.exists()) {
        const data = imeiSnap.data();
        return {
          isBlocked: true,
          reason: 'Bu IMEI/Cihaz nömrəsi ilə artıq qeydiyyat mövcuddur.',
          registeredUser: data.username || 'Qeydiyyatlı İstifadəçi',
        };
      }
    }

    return { isBlocked: false };
  } catch (error) {
    console.warn('Device check error, continuing:', error);
    return { isBlocked: false };
  }
};

// 22. Record Device and IMEI in Firestore after Registration
export const registerDeviceInFirestore = async (params: {
  deviceId: string;
  imei: string;
  userId: string;
  username: string;
  email: string;
  fingerprint: string;
}) => {
  try {
    const safeDocId = params.deviceId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const deviceRef = doc(db, 'registered_devices', safeDocId);
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const deviceData = {
      deviceFingerprint: params.deviceId,
      imei: params.imei,
      userId: params.userId,
      username: params.username,
      email: params.email,
      fingerprint: params.fingerprint,
      registeredAt: nowIso,
      createdAt: serverTimestamp(),
    };

    await setDoc(deviceRef, deviceData, { merge: true });

    // Also index IMEI doc
    if (params.imei) {
      const imeiDocId = `IMEI_${params.imei}`;
      const imeiRef = doc(db, 'registered_devices', imeiDocId);
      await setDoc(imeiRef, deviceData, { merge: true });
    }

    return true;
  } catch (error) {
    console.error('Error saving device registration to Firestore:', error);
    return false;
  }
};

// 23. Real-time Rooms List Subscription
export const subscribeToRoomsList = (onUpdate: (rooms: any[]) => void) => {
  const roomsCol = collection(db, 'rooms');
  return onSnapshot(roomsCol, (snapshot) => {
    if (!snapshot.empty) {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      onUpdate(list);
    } else {
      onUpdate([]);
    }
  }, (err) => {
    console.error('Rooms subscription error:', err);
  });
};

export const subscribeToRoomsInFirestore = subscribeToRoomsList;

// 24. Create Room in Firestore
export const createRoomInFirestore = async (roomData: {
  id: string;
  name: string;
  stake: number;
  maxPlayers: number;
  isSekaOnly?: boolean;
  isPrivate?: boolean;
  creatorId?: string;
  creatorName?: string;
}) => {
  try {
    const roomRef = doc(db, 'rooms', roomData.id);
    const initialData = {
      ...roomData,
      currentPlayers: 1,
      status: 'waiting',
      players: [],
      pot: 0,
      currentBet: roomData.stake,
      roundNumber: 1,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    };
    await setDoc(roomRef, initialData, { merge: true });
    return true;
  } catch (error) {
    console.error('Error creating room in Firestore:', error);
    return false;
  }
};

// 25. Subscribe to a Single Room Table State Real-time
export const subscribeToRoomDoc = (roomId: string, onUpdate: (roomData: any) => void) => {
  const roomRef = doc(db, 'rooms', roomId);
  return onSnapshot(roomRef, (snap) => {
    if (snap.exists()) {
      onUpdate(snap.data());
    }
  }, (err) => {
    console.error(`Room ${roomId} subscription error:`, err);
  });
};

// 26. Join Real Player to Room in Firestore
export const joinRoomInFirestore = async (roomId: string, player: {
  id: string;
  username: string;
  avatar: string;
  balance: number;
}) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    const snap = await getDoc(roomRef);
    let existingPlayers: any[] = [];
    let roomInfo: any = {};

    if (snap.exists()) {
      roomInfo = snap.data();
      existingPlayers = Array.isArray(roomInfo.players) ? roomInfo.players : [];
    }

    // Check if player was kicked by admin
    if (Array.isArray(roomInfo.kickedPlayerIds) && roomInfo.kickedPlayerIds.includes(player.id)) {
      // Remove from kicked list if rejoining allowed or keep restricted
    }

    // Check if player already in room
    const playerIndex = existingPlayers.findIndex((p: any) => p.id === player.id);
    
    // Find next free seat 0..3
    const occupiedSeats = existingPlayers.map((p: any) => p.seatIndex);
    let freeSeat = 0;
    for (let s = 0; s < 4; s++) {
      if (!occupiedSeats.includes(s)) {
        freeSeat = s;
        break;
      }
    }

    const updatedPlayerData = {
      id: player.id,
      username: player.username,
      avatar: player.avatar,
      balance: player.balance,
      seatIndex: playerIndex >= 0 ? existingPlayers[playerIndex].seatIndex : freeSeat,
      isFolded: false,
      isSeka: false,
      cardsRevealed: false,
      currentBet: playerIndex >= 0 && existingPlayers[playerIndex].currentBet !== undefined ? existingPlayers[playerIndex].currentBet : 0,
      cards: playerIndex >= 0 && Array.isArray(existingPlayers[playerIndex].cards) ? existingPlayers[playerIndex].cards : [],
      isBot: false,
      lastActive: Date.now(),
    };

    if (playerIndex >= 0) {
      existingPlayers[playerIndex] = {
        ...existingPlayers[playerIndex],
        ...updatedPlayerData,
      };
    } else {
      existingPlayers.push(updatedPlayerData);
    }

    await setDoc(roomRef, {
      ...roomInfo,
      players: existingPlayers,
      currentPlayers: existingPlayers.length,
      status: existingPlayers.length >= 2 ? (roomInfo.status === 'betting' ? 'betting' : 'waiting') : 'waiting',
      lastActive: serverTimestamp(),
    }, { merge: true });

    return true;
  } catch (error) {
    console.error('Error joining room in Firestore:', error);
    return false;
  }
};

// 27. Leave Room in Firestore
export const leaveRoomInFirestore = async (roomId: string, playerId: string) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const existingPlayers = (data.players || []).filter((p: any) => p.id !== playerId);

    let newActivePlayerId = data.activePlayerId;
    if (data.activePlayerId === playerId && existingPlayers.length > 0) {
      newActivePlayerId = existingPlayers[0].id;
    }

    await setDoc(roomRef, {
      players: existingPlayers,
      currentPlayers: existingPlayers.length,
      activePlayerId: newActivePlayerId,
      status: existingPlayers.length >= 2 ? (data.status || 'waiting') : 'waiting',
      lastActive: serverTimestamp(),
    }, { merge: true });

    return true;
  } catch (error) {
    console.error('Error leaving room in Firestore:', error);
    return false;
  }
};

// 27.1 Kick Player from Room in Firestore (Admin Action)
export const kickPlayerFromRoomInFirestore = async (roomId: string, playerId: string) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return false;

    const data = snap.data();
    const existingPlayers = (data.players || []).filter((p: any) => p.id !== playerId);

    let newActivePlayerId = data.activePlayerId;
    if (data.activePlayerId === playerId && existingPlayers.length > 0) {
      newActivePlayerId = existingPlayers[0].id;
    }

    const kickedList = Array.isArray(data.kickedPlayerIds) ? [...data.kickedPlayerIds] : [];
    if (!kickedList.includes(playerId)) {
      kickedList.push(playerId);
    }

    await setDoc(roomRef, {
      players: existingPlayers,
      currentPlayers: existingPlayers.length,
      activePlayerId: newActivePlayerId,
      kickedPlayerIds: kickedList,
      status: existingPlayers.length >= 2 ? (data.status || 'waiting') : 'waiting',
      lastActive: serverTimestamp(),
      lastAction: {
        type: 'kick',
        playerId,
        text: 'Oyunçu admin tərəfindən otaqdan çıxarıldı',
        timestamp: Date.now(),
      }
    }, { merge: true });

    return true;
  } catch (error) {
    console.error('Error kicking player from room in Firestore:', error);
    return false;
  }
};

// 27.2 Delete Room completely from Firestore (Admin Action)
export const deleteRoomFromFirestore = async (roomId: string) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    await deleteDoc(roomRef);
    return true;
  } catch (error) {
    console.error('Error deleting room from Firestore:', error);
    return false;
  }
};

// 28. Update Room State in Firestore
export const updateRoomStateInFirestore = async (roomId: string, updateData: any) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    await setDoc(roomRef, {
      ...updateData,
      lastActive: serverTimestamp(),
    }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error updating room state in Firestore:', error);
    return false;
  }
};

// ==========================================
// 29. ACTIVITY LOGGING & SYSTEM-WIDE AUDIT
// ==========================================

export const logActivityToFirestore = async (log: Omit<ActivityLog, 'id' | 'createdAt'>) => {
  try {
    const logsCol = collection(db, 'activity_logs');
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const docRef = await addDoc(logsCol, {
      ...log,
      date: log.date || nowIso,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error logging activity to Firestore:', error);
    return null;
  }
};

export const subscribeToActivityLogs = (onUpdate: (logs: ActivityLog[]) => void) => {
  const logsCol = collection(db, 'activity_logs');
  const q = query(logsCol, orderBy('createdAt', 'desc'), limit(150));
  return onSnapshot(q, (snapshot) => {
    const list: ActivityLog[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId: data.userId || 'system',
        username: data.username || 'Sistem',
        actionType: data.actionType || 'admin_action',
        details: data.details || '',
        amount: data.amount,
        roomId: data.roomId,
        roomName: data.roomName,
        date: data.date || new Date().toISOString().replace('T', ' ').substring(0, 16),
        createdAt: data.createdAt,
      };
    });
    onUpdate(list);
  }, (err) => {
    console.error('Activity logs subscription error:', err);
  });
};

export const deleteActivityLogInFirestore = async (logId: string) => {
  try {
    const logRef = doc(db, 'activity_logs', logId);
    await deleteDoc(logRef);
    return true;
  } catch (error) {
    console.error('Error deleting activity log:', error);
    return false;
  }
};

export const clearAllActivityLogsInFirestore = async () => {
  try {
    const logsCol = collection(db, 'activity_logs');
    const snap = await getDocs(logsCol);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error clearing activity logs:', error);
    return false;
  }
};

// ==========================================
// 30. PLAYER-TO-PLAYER DIRECT MESSAGING (TƏKLİFLƏR VƏ İRADLAR)
// ==========================================

export const sendPlayerMessageToFirestore = async (msg: {
  fromUserId: string;
  fromUsername: string;
  fromAvatar?: string;
  toUserId: string;
  toUsername: string;
  text: string;
  category?: 'proposal' | 'critique' | 'general';
}) => {
  try {
    const msgsCol = collection(db, 'player_messages');
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const docRef = await addDoc(msgsCol, {
      fromUserId: msg.fromUserId,
      fromUsername: msg.fromUsername,
      fromAvatar: msg.fromAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.fromUserId}`,
      toUserId: msg.toUserId,
      toUsername: msg.toUsername,
      text: msg.text,
      category: msg.category || 'proposal',
      read: false,
      date: nowIso,
      createdAt: serverTimestamp(),
    });

    // Also record activity log for admin
    await logActivityToFirestore({
      userId: msg.fromUserId,
      username: msg.fromUsername,
      actionType: 'direct_message',
      details: `${msg.fromUsername} ➔ ${msg.toUsername} oyunçusuna mesaj/təklif göndərdi: "${msg.text.substring(0, 60)}${msg.text.length > 60 ? '...' : ''}"`,
      date: nowIso,
    });

    return docRef.id;
  } catch (error) {
    console.error('Error sending player direct message:', error);
    return null;
  }
};

export const subscribeToPlayerMessages = (userId: string, onUpdate: (messages: PlayerMessage[]) => void) => {
  const msgsCol = collection(db, 'player_messages');
  const q = query(msgsCol, orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, (snapshot) => {
    const list: PlayerMessage[] = snapshot.docs
      .map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PlayerMessage, 'id'>),
      }))
      .filter((m) => m.toUserId === userId || m.fromUserId === userId);
    onUpdate(list);
  }, (err) => {
    console.error('Player messages subscription error:', err);
  });
};

export const subscribeToAllPlayerMessages = (onUpdate: (messages: PlayerMessage[]) => void) => {
  const msgsCol = collection(db, 'player_messages');
  const q = query(msgsCol, orderBy('createdAt', 'desc'), limit(150));
  return onSnapshot(q, (snapshot) => {
    const list: PlayerMessage[] = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<PlayerMessage, 'id'>),
    }));
    onUpdate(list);
  }, (err) => {
    console.error('All player messages subscription error:', err);
  });
};

export const markPlayerMessageAsRead = async (messageId: string) => {
  try {
    const msgRef = doc(db, 'player_messages', messageId);
    await updateDoc(msgRef, {
      read: true,
    });
    return true;
  } catch (error) {
    console.error('Error marking player message as read:', error);
    return false;
  }
};

export const deletePlayerMessageInFirestore = async (messageId: string) => {
  try {
    const msgRef = doc(db, 'player_messages', messageId);
    await deleteDoc(msgRef);
    return true;
  } catch (error) {
    console.error('Error deleting player message:', error);
    return false;
  }
};

// ==========================================
// 31. ADMIN DELETION, BAN & PURGE ENGINE
// ==========================================

export const deleteUserFromFirestore = async (userId: string, username = 'Oyunçu') => {
  try {
    // 1. Delete user profile doc
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);

    // 2. Remove device registration if any
    const safeDocId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const deviceRef = doc(db, 'registered_devices', safeDocId);
    await deleteDoc(deviceRef).catch(() => {});

    // 3. Log deletion in activity logs
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 16);
    await logActivityToFirestore({
      userId,
      username,
      actionType: 'delete_action',
      details: `Admin tərəfindən ${username} (ID: ${userId}) hesabı tamamilə silindi və ləğv edildi.`,
      date: nowIso,
    });

    return true;
  } catch (error) {
    console.error('Error deleting user from Firestore:', error);
    return false;
  }
};

export const deleteDepositInFirestore = async (depositId: string) => {
  try {
    const depRef = doc(db, 'deposits', depositId);
    await deleteDoc(depRef);
    return true;
  } catch (error) {
    console.error('Error deleting deposit:', error);
    return false;
  }
};

export const deleteTableRakeInFirestore = async (rakeId: string) => {
  try {
    const rakeRef = doc(db, 'table_rakes', rakeId);
    await deleteDoc(rakeRef);
    return true;
  } catch (error) {
    console.error('Error deleting table rake:', error);
    return false;
  }
};

export const deleteRoomInFirestore = async (roomId: string) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    await deleteDoc(roomRef);
    return true;
  } catch (error) {
    console.error('Error deleting room:', error);
    return false;
  }
};

export const deleteAdminMessageInFirestore = async (msgId: string) => {
  try {
    const msgRef = doc(db, 'admin_messages', msgId);
    await deleteDoc(msgRef);
    return true;
  } catch (error) {
    console.error('Error deleting admin message:', error);
    return false;
  }
};




