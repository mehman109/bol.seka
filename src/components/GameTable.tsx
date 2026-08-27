import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Sparkles,
  Flame,
  Scale,
  Eye,
  EyeOff,
  Trophy,
  Hourglass,
  Plus,
  Minus,
  Zap,
  UserPlus,
  LogOut,
  Copy,
  Check,
  CheckCircle2,
  MessageSquare,
  ArrowRight,
  X,
  ShieldAlert,
  Settings,
  Wallet,
  Gift,
  ChevronLeft,
  ChevronRight,
  Share2,
  RefreshCw,
  Activity,
  History,
} from 'lucide-react';
import { CardView } from './CardView';
import { GameEventsSidebar } from './GameEventsSidebar';
import { Card, Player, Room, UserProfile, ChatMessage, HandEvaluation, BalanceMode, GameEventLog } from '../types';
import { createDeck, shuffleDeck, evaluateHand, dealSekaHands } from '../utils/sekaLogic';
import { soundManager } from '../utils/audio';
import { 
  recordTableRakeInFirestore, 
  joinRoomInFirestore, 
  leaveRoomInFirestore, 
  subscribeToRoomDoc, 
  updateRoomStateInFirestore 
} from '../services/firebaseService';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';

interface GameTableProps {
  room: Room;
  user: UserProfile;
  balanceMode?: BalanceMode;
  unreadMessagesCount?: number;
  onLeaveTable: () => void;
  onOpenWallet: () => void;
  onOpenBonus?: () => void;
  onClaimBonus?: (amount: number) => void;
  onOpenSupport: () => void;
  onOpenReport: () => void;
  onOpenSettings?: () => void;
  onUpdateBalance: (newBalance: number, mode?: BalanceMode) => void;
}

const TURN_TIME_LIMIT = 15; // seconds per turn

let globalMsgCounter = 0;
const generateUniqueId = (prefix = 'msg') =>
  `${prefix}-${Date.now()}-${++globalMsgCounter}-${Math.random().toString(36).slice(2, 8)}`;

interface FlyingChip {
  id: string;
  fromSeat: number;
  amount: number;
}

interface DealingAnimationCard {
  id: string;
  targetSeat: number;
  cardIndex: number;
}

export const GameTable: React.FC<GameTableProps> = ({
  room,
  user,
  balanceMode = 'wallet',
  unreadMessagesCount = 0,
  onLeaveTable,
  onOpenWallet,
  onOpenBonus,
  onClaimBonus,
  onOpenSupport,
  onOpenReport,
  onOpenSettings,
  onUpdateBalance,
}) => {
  // Sound mute state
  const [isMuted, setIsMuted] = useState(soundManager.getMuted());

  // Real players state (strictly real registered players, no bots)
  const [players, setPlayers] = useState<Player[]>([]);
  const playersRef = useRef<Player[]>(players);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  const [rawRoomPlayers, setRawRoomPlayers] = useState<any[]>([]);
  const rawRoomPlayersRef = useRef<any[]>([]);
  useEffect(() => {
    rawRoomPlayersRef.current = rawRoomPlayers;
  }, [rawRoomPlayers]);

  const [pot, setPot] = useState<number>(0);
  const potRef = useRef<number>(pot);
  useEffect(() => {
    potRef.current = pot;
  }, [pot]);

  const [currentBet, setCurrentBet] = useState<number>(room.stake);
  const [activePlayerId, setActivePlayerId] = useState<string>('');
  const [activeTurnIndex, setActiveTurnIndex] = useState<number>(0);
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(TURN_TIME_LIMIT);
  const [gameStatus, setGameStatus] = useState<'waiting' | 'dealing' | 'betting' | 'showdown' | 'round_end'>('waiting');
  const [statusMessage, setStatusMessage] = useState<string>('Masaya qoşulur...');
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [winnerInfo, setWinnerInfo] = useState<{ winner: Player; evaluation: HandEvaluation; potWon: number } | null>(null);
  const [splitProposal, setSplitProposal] = useState<{ proposer: Player } | null>(null);

  const lastProcessedActionTimestampRef = useRef<number>(0);
  const isStartingRoundRef = useRef<boolean>(false);
  const startNewMultiplayerRoundRef = useRef<((currentFirestorePlayers?: any[]) => Promise<void>) | null>(null);

  // Seka (Svar / Qaynama) Tie Standoff State
  interface SekaStandoffState {
    tiedPlayers: Player[];
    tiedScore: number;
    pot: number;
    joinFee: number;
    participants: string[]; // player ids
    countdown: number;
    userJoined: boolean;
    userDeclined: boolean;
  }
  const [sekaStandoff, setSekaStandoff] = useState<SekaStandoffState | null>(null);
  const sekaTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sekaStandoffRef = useRef<SekaStandoffState | null>(sekaStandoff);
  useEffect(() => {
    sekaStandoffRef.current = sekaStandoff;
  }, [sekaStandoff]);

  // Raise slider control
  const [showRaiseControl, setShowRaiseControl] = useState<boolean>(false);
  const [raiseAmount, setRaiseAmount] = useState<number>(room.stake * 2);

  // Card visibility toggle for current user
  const [userRevealedCards, setUserRevealedCards] = useState<boolean>(true);

  // Visual effects
  const [animatingCards, setAnimatingCards] = useState<DealingAnimationCard[]>([]);
  const [flyingChips, setFlyingChips] = useState<FlyingChip[]>([]);
  const [flyingEmojis, setFlyingEmojis] = useState<{ id: string; emoji: string; x: number; y: number }[]>([]);
  const [copiedRoomId, setCopiedRoomId] = useState(false);

  // 5-Minute Grace Period when User Turn is active with insufficient balance
  const [isDepositGraceActive, setIsDepositGraceActive] = useState<boolean>(false);
  const [depositGraceSecondsLeft, setDepositGraceSecondsLeft] = useState<number>(300);
  const [isGraceAlertDismissed, setIsGraceAlertDismissed] = useState<boolean>(false);

  // 4-Second Auto-Restart Next Round Countdown
  const [nextRoundCountdown, setNextRoundCountdown] = useState<number>(4);

  // Speech bubbles
  const [playerBubbles, setPlayerBubbles] = useState<{ [playerId: string]: { text: string; id: string } }>({});
  const bubbleTimersRef = useRef<{ [playerId: string]: NodeJS.Timeout }>({});

  // Chat panel
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: generateUniqueId('sys'),
      senderId: 'system',
      senderName: 'Sistem',
      text: `♠ ${room.name} masasına xoş gəlmisiniz! Yalnız qeydiyyatdan keçmiş real oyunçularla oynanılır.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem: true,
    },
  ]);

  // Game Events & Audit Log state
  const [isEventsSidebarOpen, setIsEventsSidebarOpen] = useState<boolean>(false);
  const [gameEvents, setGameEvents] = useState<GameEventLog[]>([
    {
      id: generateUniqueId('ev-init'),
      timestamp: Date.now(),
      timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      playerName: 'Sistem',
      actionType: 'system',
      description: `♠ ${room.name} masasına qoşuldunuz. Masa mərci: ${(room.stake || 0).toFixed(2)} ₼`,
      roundNumber: 1,
    },
  ]);

  // Append new Game Event to audit log (max 120 items)
  const addGameEvent = useCallback(
    (event: Omit<GameEventLog, 'id' | 'timestamp' | 'timeStr'>) => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const newEv: GameEventLog = {
        id: generateUniqueId('ev'),
        timestamp: Date.now(),
        timeStr,
        ...event,
      };
      setGameEvents((prev) => [...prev.slice(-119), newEv]);
    },
    []
  );

  const navScrollRef = useRef<HTMLDivElement | null>(null);

  // Trigger speech bubble
  const triggerSpeechBubble = useCallback((playerId: string, text: string) => {
    const bubbleId = generateUniqueId('bubble');
    if (bubbleTimersRef.current[playerId]) {
      clearTimeout(bubbleTimersRef.current[playerId]);
    }
    setPlayerBubbles((prev) => ({ ...prev, [playerId]: { text, id: bubbleId } }));
    bubbleTimersRef.current[playerId] = setTimeout(() => {
      setPlayerBubbles((prev) => {
        const next = { ...prev };
        if (next[playerId]?.id === bubbleId) {
          delete next[playerId];
        }
        return next;
      });
    }, 5000);
  }, []);

  // Chip animation
  const triggerChipAnimation = (seatIdx: number, amount: number) => {
    const chipId = generateUniqueId('chip');
    setFlyingChips((prev) => [...prev, { id: chipId, fromSeat: seatIdx, amount }]);
    soundManager.playChip();
    setTimeout(() => {
      setFlyingChips((prev) => prev.filter((c) => c.id !== chipId));
    }, 900);
  };

  // 1. Join room in Firestore & Subscribe to real-time room updates
  useEffect(() => {
    const initialPlayableBalance = balanceMode === 'bonus' ? (user.bonusBalance || 0) : (user.balance || 0);

    // Initial local player state
    const userPlayer: Player = {
      id: user.id,
      username: user.username,
      avatar: user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      balance: initialPlayableBalance,
      currentBet: 0,
      cards: [],
      isFolded: false,
      isSeka: false,
      cardsRevealed: false,
      isBot: false,
      seatIndex: 0,
    };

    setPlayers([userPlayer]);
    playersRef.current = [userPlayer];

    // Join room in Firestore
    joinRoomInFirestore(room.id, {
      id: user.id,
      username: user.username,
      avatar: user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      balance: initialPlayableBalance,
    }).catch(console.error);

    // Realtime listener to room document
    const unsubRoom = subscribeToRoomDoc(room.id, (roomData) => {
      // If room was deleted by admin
      if (!roomData) {
        alert('Masa admin tərəfindən ləğv edildi və ya bağlandı.');
        onLeaveTable();
        return;
      }

      // Check if user was kicked by admin
      if (Array.isArray(roomData.kickedPlayerIds) && roomData.kickedPlayerIds.includes(user.id)) {
        alert('Siz admin tərəfindən bu masadan çıxarıldınız.');
        onLeaveTable();
        return;
      }

      const firestorePlayers: any[] = Array.isArray(roomData.players) ? roomData.players : [];
      setRawRoomPlayers(firestorePlayers);
      rawRoomPlayersRef.current = firestorePlayers;

      // Ensure current user is always placed at seat 0 visually, others mapped to seats 1, 2, 3
      const me = firestorePlayers.find((p: any) => p.id === user.id);
      const others = firestorePlayers.filter((p: any) => p.id !== user.id);

      const mappedPlayers: Player[] = [];
      if (me) {
        mappedPlayers.push({
          ...me,
          isBot: false,
          seatIndex: 0,
          cards: Array.isArray(me.cards) ? me.cards : [],
        });
      } else {
        mappedPlayers.push(userPlayer);
      }

      others.forEach((p: any, idx: number) => {
        mappedPlayers.push({
          ...p,
          isBot: false,
          seatIndex: idx + 1,
          cards: Array.isArray(p.cards) ? p.cards : [],
        });
      });

      setPlayers(mappedPlayers);
      playersRef.current = mappedPlayers;

      // Update pot & bets from Firestore
      if (typeof roomData.pot === 'number') {
        setPot(roomData.pot);
        potRef.current = roomData.pot;
      }
      if (typeof roomData.currentBet === 'number') {
        setCurrentBet(roomData.currentBet);
      }
      if (roomData.activePlayerId) {
        setActivePlayerId(roomData.activePlayerId);
        const visualTurnIdx = mappedPlayers.findIndex((p) => p.id === roomData.activePlayerId);
        setActiveTurnIndex(visualTurnIdx >= 0 ? visualTurnIdx : 0);
        setTurnTimeLeft(TURN_TIME_LIMIT);
      }
      if (roomData.status) {
        setGameStatus(roomData.status);
      }
      if (roomData.statusMessage) {
        setStatusMessage(roomData.statusMessage);
      }
      if (typeof roomData.roundNumber === 'number') {
        setRoundNumber(roomData.roundNumber);
      }
      if (roomData.winnerInfo) {
        setWinnerInfo(roomData.winnerInfo);
        if (roomData.winnerInfo.winner?.id === user.id) {
          confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.6 },
            colors: ['#F59E0B', '#10B981', '#FFFFFF', '#A855F7'],
          });
          onUpdateBalance(roomData.winnerInfo.winner.balance, balanceMode);
        }
      } else if (roomData.status === 'betting') {
        setWinnerInfo(null);
      }

      // Process real-time action animation and sounds from other players
      if (roomData.lastAction && roomData.lastAction.timestamp) {
        if (roomData.lastAction.timestamp > lastProcessedActionTimestampRef.current) {
          lastProcessedActionTimestampRef.current = roomData.lastAction.timestamp;
          const action = roomData.lastAction;

          // Audit log into Game Events
          const actPlayer = mappedPlayers.find((p) => p.id === action.playerId);
          const actName = action.playerName || actPlayer?.username || 'Oyunçu';
          const actAvatar = actPlayer?.avatar;
          let actDesc = action.text || '';
          if (action.type === 'raise') {
            actDesc = `Mərci ${(action.amount || 0).toFixed(2)} ₼-ə qaldırdı`;
          } else if (action.type === 'check' || action.type === 'call') {
            actDesc = `${(action.amount || 0).toFixed(2)} ₼ mərclə oyunu yoxladı`;
          } else if (action.type === 'fold') {
            actDesc = 'Pas keçdi (əldən çıxdı)';
          } else if (action.type === 'seka') {
            actDesc = `Qaranlıq (Työşka 2X) mərci atdı: +${(action.amount || 0).toFixed(2)} ₼`;
          } else if (action.type === 'showdown') {
            actDesc = 'Kartları açdırdı! Xallar müqayisə edilir...';
          } else if (action.type === 'win') {
            actDesc = `🏆 Əli qazandı! (+${(action.amount || roomData.pot || 0).toFixed(2)} ₼)`;
          } else if (action.type === 'deal') {
            actDesc = 'Yeni əl başladı. Kartlar paylandı';
          } else if (action.type === 'leave') {
            actDesc = `${actName} masanı tərk etdi. Yer boşaldı`;
          } else if (action.type === 'kick') {
            actDesc = `${actName} admin tərəfindən masadan çıxarıldı`;
          }

          addGameEvent({
            playerId: action.playerId,
            playerName: actName,
            playerAvatar: actAvatar,
            actionType: action.type as any,
            amount: action.amount,
            potAfter: roomData.pot,
            description: actDesc,
            roundNumber: typeof roomData.roundNumber === 'number' ? roomData.roundNumber : 1,
          });
          
          if (action.playerId !== user.id) {
            const visualSeat = mappedPlayers.findIndex((p) => p.id === action.playerId);
            const targetSeatIdx = visualSeat >= 0 ? visualSeat : 1;

            if (action.type === 'check' || action.type === 'raise' || action.type === 'call') {
              soundManager.playChip();
              if (action.amount && action.amount > 0) {
                triggerChipAnimation(targetSeatIdx, action.amount);
              }
            } else if (action.type === 'fold') {
              soundManager.playFold();
            } else if (action.type === 'seka') {
              soundManager.playSeka();
              if (action.amount && action.amount > 0) {
                triggerChipAnimation(targetSeatIdx, action.amount);
              }
            } else if (action.type === 'showdown') {
              soundManager.playWin();
            } else if (action.type === 'leave' || action.type === 'kick') {
              soundManager.playPing();
            }

            if (action.text) {
              triggerSpeechBubble(action.playerId, action.text);
            }
          }
        }
      }

      // Automatic Round Initiation:
      // When 2 or more players are seated and status is waiting or cards not dealt:
      const hasEnoughPlayers = firestorePlayers.length >= 2;
      const isMissingCards = !firestorePlayers[0]?.cards || firestorePlayers[0]?.cards.length === 0;
      const isRoundInactive = !roomData.status || roomData.status === 'waiting' || (isMissingCards && roomData.status !== 'dealing');

      if (hasEnoughPlayers && isRoundInactive && !isStartingRoundRef.current) {
        if (firestorePlayers[0]?.id === user.id) {
          startNewMultiplayerRoundRef.current?.(firestorePlayers);
        } else {
          // Backup fallback trigger after 1.5s
          setTimeout(() => {
            if (!isStartingRoundRef.current) {
              startNewMultiplayerRoundRef.current?.(firestorePlayers);
            }
          }, 1500);
        }
      }
    });

    return () => {
      unsubRoom();
      leaveRoomInFirestore(room.id, user.id).catch(console.error);
      if (sekaTimerRef.current) {
        clearInterval(sekaTimerRef.current);
      }
    };
  }, [room.id, user.id]);

  // Synchronize user balance when external wallet balance changes
  useEffect(() => {
    const totalPlayable = (user.balance || 0) + (user.bonusBalance || 0);
    setPlayers((prev) => {
      if (prev.length === 0) return prev;
      if (prev[0] && prev[0].balance !== totalPlayable) {
        const updated = [...prev];
        updated[0] = { ...updated[0], balance: totalPlayable };
        return updated;
      }
      return prev;
    });
  }, [user.balance, user.bonusBalance]);

  // Start new multiplayer round (synchronized across all connected devices via Firestore)
  const startNewMultiplayerRound = useCallback(async (currentFirestorePlayers?: any[]) => {
    const rawList = currentFirestorePlayers || rawRoomPlayersRef.current;
    if (rawList.length < 2) {
      setStatusMessage('Oyun üçün ən azı 2 oyunçu lazımdır...');
      return;
    }
    if (isStartingRoundRef.current) return;
    isStartingRoundRef.current = true;

    setGameStatus('dealing');
    setWinnerInfo(null);
    setSplitProposal(null);
    setUserRevealedCards(true);
    setShowRaiseControl(false);
    setStatusMessage('Kartlar paylanır...');

    const ante = room.stake;
    const dealtHands = dealSekaHands(rawList.length);

    let potTotal = 0;
    const updatedRawPlayers = rawList.map((p: any, idx: number) => {
      const hand = dealtHands[idx];
      const buyIn = Math.min(p.balance, ante);
      potTotal += buyIn;
      const newBal = Math.max(0, p.balance - buyIn);

      return {
        ...p,
        balance: newBal,
        currentBet: ante,
        cards: hand,
        isFolded: false,
        isSeka: room.isSekaOnly || false,
        cardsRevealed: false,
        lastAction: `Masa mərci: ${(buyIn || 0).toFixed(2)} ₼`,
        isWinner: false,
        lastActive: Date.now(),
      };
    });

    // Animate ante chips locally
    updatedRawPlayers.forEach((_, idx) => {
      setTimeout(() => {
        triggerChipAnimation(idx, ante);
      }, idx * 120);
    });

    // Dealing Animation Sequence
    const dealSequence: DealingAnimationCard[] = [];
    for (let cIdx = 0; cIdx < 3; cIdx++) {
      for (let sIdx = 0; sIdx < updatedRawPlayers.length; sIdx++) {
        dealSequence.push({
          id: generateUniqueId(`deal-${cIdx}-${sIdx}`),
          targetSeat: sIdx,
          cardIndex: cIdx,
        });
      }
    }

    dealSequence.forEach((item, index) => {
      setTimeout(() => {
        soundManager.playCardDeal();
        setAnimatingCards((prev) => [...prev, item]);
      }, 200 + index * 80);
    });

    setTimeout(async () => {
      setAnimatingCards([]);
      const firstActivePlayer = updatedRawPlayers[0];

      // Update Firestore document so all clients receive the dealt cards, pot, and active turn
      await updateRoomStateInFirestore(room.id, {
        players: updatedRawPlayers,
        currentPlayers: updatedRawPlayers.length,
        pot: potTotal,
        currentBet: ante,
        activePlayerId: firstActivePlayer?.id || '',
        status: 'betting',
        statusMessage: `Oyun başladı! Masa mərci: ${(ante || 0).toFixed(2)} ₼. Növbə: ${firstActivePlayer?.username || 'Oyunçu'}`,
        winnerInfo: null,
        lastAction: {
          type: 'deal',
          playerId: user.id,
          playerName: user.username,
          text: 'Yeni əl başladı',
          timestamp: Date.now(),
        },
      });

      isStartingRoundRef.current = false;
    }, 200 + dealSequence.length * 80 + 300);
  }, [room.id, room.stake, room.isSekaOnly, user.id, user.username]);

  // Keep ref up to date
  useEffect(() => {
    startNewMultiplayerRoundRef.current = startNewMultiplayerRound;
  }, [startNewMultiplayerRound]);

  // Finish Round and Award Pot with 10% Casino Rake
  const handleFinishRound = useCallback(async (winner: Player, evalResult: HandEvaluation, totalPotAmount: number, rawList: any[]) => {
    soundManager.playWin();

    const rakeRate = 0.10;
    const rakeAmount = Math.round(totalPotAmount * rakeRate * 100) / 100;
    const netPotWon = Math.round((totalPotAmount - rakeAmount) * 100) / 100;

    const updatedRaw = rawList.map((p) => {
      if (p.id === winner.id) {
        return {
          ...p,
          balance: p.balance + netPotWon,
          cardsRevealed: true,
          isWinner: true,
        };
      }
      return {
        ...p,
        cardsRevealed: true,
        isWinner: false,
      };
    });

    const wName = winner?.username || 'Oyunçu';
    const wId = winner?.id || '';

    if (totalPotAmount > 0) {
      recordTableRakeInFirestore({
        roomId: room.id,
        roomName: room.name,
        totalPot: totalPotAmount,
        rakeAmount,
        netPayout: netPotWon,
        winnerId: wId,
        winnerName: wName,
        roundNumber,
        stake: room.stake,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      }).catch((e) => console.error('Table rake record error:', e));
    }

    const winnerData = {
      winner: {
        ...winner,
        balance: (winner?.balance || 0) + netPotWon,
      },
      evaluation: evalResult,
      potWon: netPotWon,
    };

    // Update Firestore to notify all players of the winner
    await updateRoomStateInFirestore(room.id, {
      players: updatedRaw,
      pot: totalPotAmount,
      status: 'round_end',
      winnerInfo: winnerData,
      statusMessage: `🏆 ${wName} qazandı! (+${(netPotWon || 0).toFixed(2)} ₼ - %10 Komissiya: ${(rakeAmount || 0).toFixed(2)} ₼)`,
      lastAction: {
        type: 'win',
        playerId: wId,
        playerName: wName,
        text: `Qazandı (+${(netPotWon || 0).toFixed(2)} ₼)`,
        timestamp: Date.now(),
      },
    });

    // Auto-restart next round after 4.5 seconds
    setTimeout(() => {
      if (rawRoomPlayersRef.current.length >= 2 && rawRoomPlayersRef.current[0]?.id === user.id) {
        startNewMultiplayerRound();
      }
    }, 4500);
  }, [room.id, room.name, room.stake, roundNumber, user.id, startNewMultiplayerRound]);

  // Showdown Action (Synchronized across all clients)
  const handleShowdown = useCallback(async (currentRawList: any[], currentPotAmount: number) => {
    const activePlayers = currentRawList.filter((p: any) => !p.isFolded);
    if (activePlayers.length !== 2) {
      setStatusMessage('Açdır yalnız masada 2 aktiv oyunçu qaldıqda mümkündür!');
      return;
    }

    soundManager.playWin();
    const requiredBet = currentBet > 0 ? currentBet : room.stake;

    // Deduct caller cost
    const userInRaw = currentRawList.find((p: any) => p.id === user.id);
    let updatedPot = currentPotAmount;
    if (userInRaw) {
      const showdownCost = Math.min(userInRaw.balance, requiredBet);
      userInRaw.balance -= showdownCost;
      userInRaw.currentBet = (userInRaw.currentBet || 0) + showdownCost;
      updatedPot += showdownCost;
      triggerChipAnimation(0, showdownCost);
    }

    // Evaluate hands
    const evaluations = activePlayers.map((p: any) => ({
      player: p,
      evaluation: evaluateHand(p.cards || []),
    }));

    evaluations.sort((a, b) => b.evaluation.score - a.evaluation.score);
    const winningPlayer = evaluations[0].player;
    const winningEval = evaluations[0].evaluation;

    // Reveal cards for all active players
    activePlayers.forEach((p: any) => {
      p.cardsRevealed = true;
    });

    await updateRoomStateInFirestore(room.id, {
      players: currentRawList,
      pot: updatedPot,
      status: 'showdown',
      statusMessage: `🔍 ${user.username} kartları açdırdı! Xallar yoxlanılır...`,
      lastAction: {
        type: 'showdown',
        playerId: user.id,
        playerName: user.username,
        text: 'Kartları açdırdı',
        timestamp: Date.now(),
      },
    });

    setTimeout(() => {
      handleFinishRound(winningPlayer, winningEval, updatedPot, currentRawList);
    }, 1800);
  }, [currentBet, room.id, room.stake, user.id, user.username, handleFinishRound]);

  // Real-time Player Action Handler (Broadcasting moves live to all connected players)
  const handlePlayerAction = useCallback(async (
    action: 'fold' | 'check' | 'call' | 'raise' | 'seka' | 'showdown' | 'split',
    _seatIdx: number = 0,
    customAmount?: number
  ) => {
    const rawList = [...rawRoomPlayersRef.current];
    const userIndex = rawList.findIndex((p: any) => p.id === user.id);
    if (userIndex < 0) return;

    const me = rawList[userIndex];
    if (me.isFolded) return;

    let updatedPot = potRef.current;
    let newCurrentBet = currentBet;
    const latestTableBet = currentBet > 0 ? currentBet : room.stake;

    if (action !== 'fold' && action !== 'split') {
      let requiredFunds = 0;
      if (action === 'check' || action === 'call') {
        requiredFunds = latestTableBet;
      } else if (action === 'raise') {
        requiredFunds = customAmount || currentBet + room.stake;
      } else if (action === 'seka') {
        requiredFunds = (currentBet === 0 ? room.stake : currentBet) * 2;
      } else if (action === 'showdown') {
        requiredFunds = latestTableBet;
      }

      if (me.balance < requiredFunds) {
        soundManager.playFold();
        setStatusMessage(`Balansınızda kifayət qədər vəsait yoxdur! (${(requiredFunds || 0).toFixed(2)} ₼ tələb olunur)`);
        return;
      }
    }

    let lastActionPayload: any = null;
    let statusMsg = '';

    switch (action) {
      case 'fold': {
        soundManager.playFold();
        me.isFolded = true;
        me.lastAction = 'Pas atdı';
        statusMsg = `${me.username} pas atdı`;
        lastActionPayload = {
          type: 'fold',
          playerId: user.id,
          playerName: user.username,
          text: 'Pas atdı',
          timestamp: Date.now(),
        };

        // Check if only 1 active player remains
        const activeRemaining = rawList.filter((p: any) => !p.isFolded);
        if (activeRemaining.length === 1) {
          const soleWinner = activeRemaining[0];
          const soleEval = evaluateHand(soleWinner.cards || []);
          handleFinishRound(soleWinner, soleEval, updatedPot, rawList);
          return;
        }
        break;
      }

      case 'check':
      case 'call': {
        soundManager.playChip();
        const amountToPay = Math.min(me.balance, latestTableBet);
        me.balance -= amountToPay;
        me.currentBet = amountToPay;
        updatedPot += amountToPay;
        newCurrentBet = amountToPay;

        triggerChipAnimation(0, amountToPay);
        me.lastAction = `Yoxladı (+${(amountToPay || 0).toFixed(2)} ₼)`;
        statusMsg = `${me.username} ${(amountToPay || 0).toFixed(2)} ₼ mərclə oyunu yoxladı`;
        lastActionPayload = {
          type: 'check',
          playerId: user.id,
          playerName: user.username,
          amount: amountToPay,
          text: `Yoxladı (+${(amountToPay || 0).toFixed(2)} ₼)`,
          timestamp: Date.now(),
        };
        break;
      }

      case 'raise': {
        soundManager.playChip();
        const targetBet = customAmount || currentBet + room.stake;
        const amountToPay = Math.min(me.balance, targetBet);
        me.balance -= amountToPay;
        me.currentBet = targetBet;
        updatedPot += amountToPay;
        newCurrentBet = targetBet;

        triggerChipAnimation(0, amountToPay);
        me.lastAction = `Artırdı: ${(targetBet || 0).toFixed(2)} ₼`;
        statusMsg = `🔥 ${me.username} mərci ${(targetBet || 0).toFixed(2)} ₼-ə qaldırdı!`;
        lastActionPayload = {
          type: 'raise',
          playerId: user.id,
          playerName: user.username,
          amount: targetBet,
          text: `Artırdı: ${(targetBet || 0).toFixed(2)} ₼`,
          timestamp: Date.now(),
        };
        break;
      }

      case 'seka': {
        soundManager.playSeka();
        me.isSeka = true;
        const sekaBet = (currentBet === 0 ? room.stake : currentBet) * 2;
        const amountToPay = Math.min(me.balance, sekaBet);
        me.balance -= amountToPay;
        me.currentBet = sekaBet;
        updatedPot += amountToPay;
        newCurrentBet = sekaBet;

        triggerChipAnimation(0, amountToPay);
        me.lastAction = `🔥 Työşka (Qaranlıq) (+${(amountToPay || 0).toFixed(2)} ₼)`;
        statusMsg = `🔥 ${me.username} QARANLIQ (TYÖŞKA) mərci atdı!`;
        lastActionPayload = {
          type: 'seka',
          playerId: user.id,
          playerName: user.username,
          amount: amountToPay,
          text: 'Qaranlıq (Työşka 2X)',
          timestamp: Date.now(),
        };
        break;
      }

      case 'showdown': {
        handleShowdown(rawList, updatedPot);
        return;
      }

      case 'split': {
        soundManager.playPing();
        setSplitProposal({ proposer: me });
        setStatusMessage(`${me.username} bankı 50/50 bölüşməyi təklif edir`);
        return;
      }
    }

    // Determine Next Active Player
    let nextUserIndex = (userIndex + 1) % rawList.length;
    let attempts = 0;
    while (rawList[nextUserIndex]?.isFolded && attempts < rawList.length) {
      nextUserIndex = (nextUserIndex + 1) % rawList.length;
      attempts++;
    }

    const nextPlayer = rawList[nextUserIndex];

    // Push state update to Firestore immediately
    await updateRoomStateInFirestore(room.id, {
      players: rawList,
      pot: updatedPot,
      currentBet: newCurrentBet,
      activePlayerId: nextPlayer ? nextPlayer.id : user.id,
      status: 'betting',
      statusMessage: statusMsg ? `${statusMsg}. Növbə: ${nextPlayer?.username}` : statusMessage,
      lastAction: lastActionPayload,
    });
  }, [currentBet, room.id, room.stake, user.id, user.username, handleFinishRound, handleShowdown, statusMessage]);

  const isUserTurn = activeTurnIndex === 0 && gameStatus === 'betting' && !players[0]?.isFolded;
  const userPlayer = players[0];
  const userEvaluation = userPlayer && userPlayer.cards.length > 0 ? evaluateHand(userPlayer.cards) : null;
  const activePlayersCount = players.filter((p) => !p.isFolded).length;
  const yoxlaDisplayAmount = currentBet > 0 ? currentBet : room.stake;
  const canShowdown = isUserTurn && activePlayersCount === 2;
  const isUserBalanceInsufficient = isUserTurn && (userPlayer?.balance || 0) < yoxlaDisplayAmount;

  // Turn timer interval (Count down on all screens for the currently active player)
  useEffect(() => {
    if (gameStatus !== 'betting' || isDepositGraceActive) return;

    const timer = setInterval(() => {
      setTurnTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeoutAction();
          return TURN_TIME_LIMIT;
        }
        if (prev <= 4) {
          soundManager.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStatus, activeTurnIndex, isUserTurn, isDepositGraceActive]);

  // Timeout action (always auto-fold when player does not press any action in time)
  const handleTimeoutAction = () => {
    if (!isUserTurn) return;
    const me = players[0];
    if (!me || me.isFolded) return;

    // Direct auto-fold if time runs out without pressing any action button
    handlePlayerAction('fold', 0);
  };

  // Vbank action
  const handleAllIn = () => {
    const p = players[0];
    if (!p || p.isFolded || !isUserTurn) return;
    if (p.balance <= 0) return;

    soundManager.playSeka();
    const allInAmount = p.balance;
    handlePlayerAction('raise', 0, allInAmount);
    triggerSpeechBubble(p.id, 'Hamısını qoyuram! Vbank! 🔥');
  };

  // Format seconds to mm:ss
  const formatGraceTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Horizontal scroll controls for top nav
  const scrollNav = (direction: 'left' | 'right') => {
    if (navScrollRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      navScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // 5-Minute Grace Period when User Turn is active with insufficient balance
  useEffect(() => {
    if (isUserTurn && isUserBalanceInsufficient) {
      setIsDepositGraceActive(true);
    } else if (!isUserBalanceInsufficient || !isUserTurn) {
      setIsDepositGraceActive(false);
      setDepositGraceSecondsLeft(300);
    }
  }, [isUserTurn, isUserBalanceInsufficient]);

  // Grace timer
  useEffect(() => {
    if (!isDepositGraceActive || gameStatus !== 'betting') return;

    const graceTimer = setInterval(() => {
      setDepositGraceSecondsLeft((prev) => {
        if (prev <= 1) {
          soundManager.playFold();
          handlePlayerAction('fold', 0);
          setStatusMessage('5 dəqiqəlik depozit vaxtı bitdiyi üçün əliniz avtomatik pasa atıldı və bank masada qalan oyunçuya keçdi.');
          return 300;
        }
        if (prev % 60 === 0 || (prev <= 10 && prev > 0)) {
          soundManager.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(graceTimer);
  }, [isDepositGraceActive, gameStatus, handlePlayerAction]);

  // 4-Second Automatic Next Hand Trigger after Showdown / Round End
  useEffect(() => {
    if (gameStatus !== 'round_end') {
      setNextRoundCountdown(4);
      return;
    }

    setNextRoundCountdown(4);
    const countdownTimer = setInterval(() => {
      setNextRoundCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Guaranteed 4-second auto-restart for all players
    const autoRestartTimeout = setTimeout(() => {
      if (rawRoomPlayersRef.current.length >= 2) {
        if (rawRoomPlayersRef.current[0]?.id === user.id) {
          startNewMultiplayerRoundRef.current?.();
        } else {
          // Backup fallback trigger after 4.2s for secondary seated player
          setTimeout(() => {
            if (!isStartingRoundRef.current) {
              startNewMultiplayerRoundRef.current?.();
            }
          }, 300);
        }
      }
    }, 4000);

    return () => {
      clearInterval(countdownTimer);
      clearTimeout(autoRestartTimeout);
    };
  }, [gameStatus, user.id]);

  // Target position offsets for 4 seats
  const seatPositions = [
    { x: 0, y: 120 },   // Seat 0: Bottom
    { x: -220, y: 0 },  // Seat 1: Left
    { x: 0, y: -120 },  // Seat 2: Top
    { x: 220, y: 0 },   // Seat 3: Right
  ];

  // Map seated real players to 4 seats
  const seat0 = players[0]; // Current user
  const seat1 = players[1]; // Real player 2
  const seat2 = players[2]; // Real player 3
  const seat3 = players[3]; // Real player 4

  return (
    <div className="relative w-full h-screen bg-[#080808] flex flex-col justify-between overflow-hidden select-none font-sans text-white">
      {/* 5-Minute Grace Alert Modal */}
      <AnimatePresence>
        {isDepositGraceActive && isUserTurn && !isGraceAlertDismissed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          >
            <div className="bg-gradient-to-b from-[#200b0b] via-[#140606] to-black border-2 border-red-500 rounded-3xl p-6 max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.5)] text-center relative">
              <div className="w-14 h-14 rounded-2xl bg-red-600/20 border border-red-500/50 flex items-center justify-center mx-auto mb-3">
                <ShieldAlert className="w-8 h-8 text-red-400 animate-pulse" />
              </div>
              <h3 className="text-xl font-black text-white">⚠️ Balansınız Çatmır!</h3>
              <p className="text-xs text-red-200/90 mt-1">
                Masadakı <strong>{(yoxlaDisplayAmount || 0).toFixed(2)} ₼</strong> mərci ödəmək üçün vəsaitiniz çatmır. Əlinizin yanmaması üçün sizə 5 dəqiqə vaxt ayrıldı!
              </p>

              <div className="my-4 py-2 px-6 bg-black/90 border border-red-500/40 rounded-2xl inline-block shadow-inner">
                <span className="text-xs text-red-400 font-bold block uppercase tracking-wider">Qalan Vaxt:</span>
                <span className="text-3xl font-mono font-black text-red-400 tracking-wider">
                  {formatGraceTime(depositGraceSecondsLeft)}
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    soundManager.playPing();
                    onOpenWallet();
                  }}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-black rounded-xl text-sm shadow-[0_0_20px_rgba(16,185,129,0.4)] transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Wallet className="w-4 h-4 text-black" />
                  <span>Dərhal Depozit Et (Balansı Artır)</span>
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      soundManager.playPing();
                      setIsGraceAlertDismissed(true);
                    }}
                    className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-xs transition active:scale-95"
                  >
                    Masaya Bax
                  </button>
                  <button
                    onClick={() => handlePlayerAction('fold', 0)}
                    className="flex-1 py-2 bg-red-950/60 hover:bg-red-900/80 text-red-300 font-semibold rounded-xl text-xs transition active:scale-95 border border-red-500/30"
                  >
                    Pasa Get
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Navbar / Seka Club Scrollable Menu Bar */}
      <nav className="relative z-30 bg-[#121212] border-b border-[#F59E0B]/30 shadow-xl select-none">
        {/* Scroll Left Button */}
        <button
          onClick={() => scrollNav('left')}
          title="Menyunu Sola Sürüşdür"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-40 bg-black/80 hover:bg-black text-[#F59E0B] p-1.5 rounded-r-lg border border-l-0 border-[#F59E0B]/40 shadow-md transition active:scale-90"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Scroll Right Button */}
        <button
          onClick={() => scrollNav('right')}
          title="Menyunu Sağa Sürüşdür"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-40 bg-black/80 hover:bg-black text-[#F59E0B] p-1.5 rounded-l-lg border border-r-0 border-[#F59E0B]/40 shadow-md transition active:scale-90"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Horizontally Scrollable Bar with All Buttons */}
        <div
          ref={navScrollRef}
          className="overflow-x-auto no-scrollbar py-2 sm:py-2.5 px-7 sm:px-10 flex items-center gap-2.5 sm:gap-3.5 scroll-smooth whitespace-nowrap touch-pan-x"
        >
          {/* Exit Button */}
          <button
            onClick={async () => {
              soundManager.playPing();
              try {
                await leaveRoomInFirestore(room.id, user.id);
              } catch (e) {
                console.error(e);
              }
              onLeaveTable();
            }}
            title="Masadan Çıxış"
            className="flex items-center gap-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 shrink-0 cursor-pointer shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Çıxış</span>
          </button>

          {/* Seka Club Logo Badge */}
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-black via-[#1a140b] to-black px-3 py-1.5 rounded-xl border border-[#F59E0B]/40 shrink-0 shadow-sm">
            <div className="w-5 h-5 rounded-lg bg-gradient-to-tr from-[#F59E0B] to-yellow-300 flex items-center justify-center text-black font-black text-xs shadow">
              ♠
            </div>
            <span className="font-black text-xs sm:text-sm tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-[#F59E0B]">
              SEKA CLUB
            </span>
          </div>

          {/* Room ID & Copy */}
          <button
            onClick={() => {
              soundManager.playPing();
              navigator.clipboard.writeText(room.id);
              setCopiedRoomId(true);
              setTimeout(() => setCopiedRoomId(false), 2000);
            }}
            title="Otaq ID-sini Kopyala və Dostları Dəvət Et"
            className="flex items-center gap-1.5 bg-black/60 hover:bg-white/5 border border-white/15 hover:border-[#F59E0B]/50 px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold text-amber-200 transition active:scale-95 shrink-0 cursor-pointer"
          >
            <span>Otaq: #{room.id}</span>
            {copiedRoomId ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-white/50" />}
          </button>

          {/* Table Stake */}
          <div className="flex items-center gap-1 bg-black/60 border border-amber-500/30 px-2.5 py-1.5 rounded-xl text-xs font-bold text-white shrink-0">
            <span className="text-[10px] text-white/50 uppercase">Mərc:</span>
            <span className="text-amber-400 font-mono font-black">{((room && room.stake) || 0).toFixed(2)} ₼</span>
          </div>

          {/* Real Players Count */}
          <div className="flex items-center gap-1.5 bg-black/60 border border-green-500/30 px-2.5 py-1.5 rounded-xl text-xs font-bold text-white shrink-0">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-300 font-mono font-bold">
              {players.length}/4 Real Oyunçu
            </span>
          </div>

          {/* Real Deposit Wallet Balance (0.00 ₼ by default - only increases with deposit) */}
          <button
            onClick={() => {
              soundManager.playPing();
              onOpenWallet();
            }}
            title="Real Cüzdan Balansı (Yalnız Depozit ilə Artır)"
            className={`flex items-center gap-1.5 bg-gradient-to-r from-emerald-950/80 via-black to-emerald-950/80 hover:brightness-110 border px-3 py-1.5 rounded-xl text-xs font-bold text-white shrink-0 transition active:scale-95 cursor-pointer ${
              balanceMode === 'wallet'
                ? 'border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)] ring-1 ring-emerald-400/50'
                : 'border-emerald-500/30 opacity-80'
            }`}
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[10px] text-white/60 uppercase">Cüzdan:</span>
            <span className="font-mono font-black text-emerald-300 text-xs">
              {((user && user.balance) || 0).toFixed(2)} ₼
            </span>
            {balanceMode === 'wallet' && (
              <span className="text-[9px] bg-emerald-500 text-black px-1.5 py-0.5 rounded font-black tracking-wide">AKTİV</span>
            )}
            <span className="text-[10px] bg-emerald-600/60 text-white px-1.5 py-0.5 rounded font-black">+ Depozit</span>
          </button>

          {/* Bonus Balance */}
          <div
            title="Bonus Balansı (Yalnız Masalarda Oynamaq Üçün)"
            className={`flex items-center gap-1.5 bg-gradient-to-r from-purple-950/80 via-black to-purple-950/80 border px-2.5 py-1.5 rounded-xl text-xs font-bold text-white shrink-0 shadow-inner ${
              balanceMode === 'bonus'
                ? 'border-[#F59E0B] shadow-[0_0_15px_rgba(245,158,11,0.4)] ring-1 ring-[#F59E0B]/50'
                : 'border-purple-500/40 opacity-80'
            }`}
          >
            <Gift className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[10px] text-white/50 uppercase">Bonus:</span>
            <span className="font-mono font-black text-amber-300 text-xs">
              {(user.bonusBalance || 0).toFixed(2)} ₼
            </span>
            {balanceMode === 'bonus' && (
              <span className="text-[9px] bg-[#F59E0B] text-black px-1.5 py-0.5 rounded font-black tracking-wide">AKTİV</span>
            )}
          </div>

          {/* Unclaimed 5.00 AZN Bonus Button */}
          {!user.bonusClaimed && (
            <button
              onClick={() => {
                soundManager.playWin();
                if (onClaimBonus) {
                  onClaimBonus(5.0);
                  confetti({
                    particleCount: 120,
                    spread: 80,
                    origin: { y: 0.2 },
                    colors: ['#F59E0B', '#10B981', '#FFFFFF', '#A855F7'],
                  });
                }
              }}
              title="5.00 AZN Xoş Gəldin Bonusu Götür"
              className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 border border-yellow-300 text-black px-3 py-1.5 rounded-xl text-xs font-black transition active:scale-95 flex items-center gap-1.5 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.5)] cursor-pointer animate-pulse"
            >
              <Sparkles className="w-3.5 h-3.5 text-black" />
              <span>Bonus 5.00 ₼</span>
            </button>
          )}

          {/* Audio toggle */}
          <button
            onClick={() => {
              const muted = soundManager.toggleMute();
              setIsMuted(muted);
            }}
            title={isMuted ? 'Səsi Aç' : 'Səsi Bağla'}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-[#F59E0B] border border-white/10 transition shrink-0 cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-green-400" />}
          </button>

          {/* Settings / Profil with Footstep Indicator */}
          {onOpenSettings && (
            <button
              onClick={() => {
                soundManager.playPing();
                onOpenSettings();
              }}
              title="Ayarlar və Profil"
              className="relative bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 hover:text-white px-2.5 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>Profil</span>
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white font-black text-[10px] px-1.5 py-0.5 rounded-full border border-black animate-bounce shadow-lg">
                  👣
                </span>
              )}
            </button>
          )}

          {/* Game Events Audit Sidebar Toggle */}
          <button
            onClick={() => {
              soundManager.playPing();
              setIsEventsSidebarOpen(true);
            }}
            title="Oyun Hadisələri və Audit Loqları"
            className="flex items-center gap-1.5 bg-gradient-to-r from-[#1c140a] via-black to-[#1c140a] hover:bg-white/10 border border-[#F59E0B]/60 hover:border-[#F59E0B] text-amber-300 hover:text-white px-2.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 shrink-0 cursor-pointer shadow-sm relative"
          >
            <Activity className="w-3.5 h-3.5 text-[#F59E0B] animate-pulse" />
            <span>Hadisələr</span>
            {gameEvents.length > 0 && (
              <span className="bg-[#F59E0B] text-black text-[10px] font-black px-1.5 py-0.2 rounded-full font-mono">
                {gameEvents.length}
              </span>
            )}
          </button>

          {/* Report button */}
          <button
            onClick={() => {
              soundManager.playPing();
              onOpenReport();
            }}
            title="Şikayət et"
            className="bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 border border-[#F59E0B]/40 text-[#F59E0B] px-2.5 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 shrink-0 cursor-pointer"
          >
            Şikayət et
          </button>

          {/* Support button */}
          <button
            onClick={() => {
              soundManager.playPing();
              onOpenSupport();
            }}
            title="Canlı Dəstək"
            className="bg-green-900/30 hover:bg-green-800/50 border border-green-500/40 text-green-300 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 shrink-0 cursor-pointer"
          >
            Dəstək
          </button>
        </div>
      </nav>

      {/* Main Playing Field: Professional Oval Seka Table */}
      <main className="flex-1 relative flex items-center justify-center p-2 sm:p-4 my-auto overflow-hidden">
        {/* Oval Green Felt Table */}
        <div className="relative w-[720px] max-w-[96vw] h-[330px] sm:h-[370px] md:h-[400px] rounded-[160px] sm:rounded-[190px] bg-gradient-to-b from-[#136034] via-[#0d4a27] to-[#062914] border-[10px] sm:border-[12px] border-[#1f160b] shadow-[0_0_90px_rgba(0,0,0,0.9),inset_0_0_60px_rgba(0,0,0,0.75)] flex items-center justify-center relative overflow-visible">
          {/* Golden Boundary Accent */}
          <div className="absolute inset-2 sm:inset-3 rounded-[146px] sm:rounded-[176px] border border-[#F59E0B]/25 pointer-events-none shadow-inner" />
          <div className="absolute inset-0 rounded-[150px] sm:rounded-[180px] opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />

          {/* Table Center: Card Deck, Pot Bank, Notification Bar */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
            {/* Center Card Deck */}
            <div className="relative mb-1.5">
              <div className="w-10 h-14 sm:w-12 sm:h-16 bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-950 rounded-lg border-2 border-[#F59E0B]/60 shadow-[0_4px_15px_rgba(0,0,0,0.8)] flex items-center justify-center transform -rotate-6">
                <div className="w-full h-full border border-amber-300/30 rounded p-1 flex items-center justify-center text-[#F59E0B] font-black text-sm">
                  ♠
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-10 h-14 sm:w-12 sm:h-16 bg-blue-950/80 rounded-lg border border-white/10 -z-10 transform -rotate-3" />
            </div>

            {/* Pot Bank Display */}
            <motion.div
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ repeat: Infinity, duration: 2.2 }}
              className="bg-gradient-to-r from-black/90 via-[#1c1408] to-black/90 border border-[#F59E0B]/60 px-4 sm:px-5 py-1 sm:py-1.5 rounded-full flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
            >
              <span className="text-[9px] sm:text-[10px] text-[#F59E0B] font-black uppercase tracking-widest">
                BANK:
              </span>
              <span className="text-sm sm:text-lg font-mono text-amber-300 font-black tracking-tight drop-shadow">
                {(pot || 0).toFixed(2)} ₼
              </span>
            </motion.div>

            {/* Notification Status Banner */}
            <div className="mt-1.5 bg-black/85 backdrop-blur-md px-3 py-0.5 sm:py-1 rounded-full border border-[#F59E0B]/30 max-w-[280px] sm:max-w-xs text-center shadow-md">
              <p className="text-[10px] sm:text-xs text-amber-200 font-semibold truncate">
                {statusMessage}
              </p>
            </div>
          </div>

          {/* Animated Dealing Cards */}
          <AnimatePresence>
            {animatingCards.map((item) => {
              const target = seatPositions[item.targetSeat] || seatPositions[0];
              return (
                <motion.div
                  key={item.id}
                  initial={{ x: 0, y: 0, scale: 0.3, opacity: 0, rotate: -20 }}
                  animate={{ x: target.x, y: target.y, scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
                >
                  <div className="w-8 h-12 bg-gradient-to-br from-blue-900 to-slate-950 rounded border border-amber-300/80 shadow-lg flex items-center justify-center text-amber-300 text-xs font-black">
                    ♠
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Animated Flying Chips */}
          <AnimatePresence>
            {flyingChips.map((chip) => {
              const start = seatPositions[chip.fromSeat] || seatPositions[0];
              return (
                <motion.div
                  key={chip.id}
                  initial={{ x: start.x, y: start.y, scale: 1.2, opacity: 1 }}
                  animate={{ x: 0, y: 0, scale: 0.8, opacity: 0.9 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.75, ease: 'easeInOut' }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none flex flex-col items-center"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 border-2 border-white shadow-[0_0_12px_#F59E0B] flex items-center justify-center text-[10px] font-black text-black">
                    ₼
                  </div>
                  <span className="text-[10px] font-mono font-extrabold text-[#F59E0B] drop-shadow mt-0.5">
                    +{((chip && chip.amount) || 0).toFixed(2)}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* 4 Player Seats (Real Players or Empty Seat Placements) */}
          {/* Position 0: Bottom (User) */}
          <div className="absolute -bottom-8 sm:-bottom-11 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
            <PlayerSeat
              player={seat0}
              isActive={activeTurnIndex === 0 && gameStatus === 'betting'}
              timeLeft={activeTurnIndex === 0 ? (isDepositGraceActive ? depositGraceSecondsLeft : turnTimeLeft) : 0}
              isUser={true}
              isDepositGrace={isDepositGraceActive}
              userRevealedCards={userRevealedCards}
              onToggleReveal={() => {
                soundManager.playCardFlip();
                setUserRevealedCards(!userRevealedCards);
              }}
              handEvaluation={userEvaluation}
              speechBubble={seat0 ? playerBubbles[seat0.id]?.text : undefined}
              seatPosition="bottom"
            />
          </div>

          {/* Position 1: Left (Seat 1) */}
          <div className="absolute top-1/2 -left-8 sm:-left-12 -translate-y-1/2 z-20 flex flex-col items-center">
            {seat1 ? (
              <PlayerSeat
                player={seat1}
                isActive={activeTurnIndex === 1 && gameStatus === 'betting'}
                timeLeft={activeTurnIndex === 1 ? turnTimeLeft : 0}
                isUser={false}
                speechBubble={playerBubbles[seat1.id]?.text}
                seatPosition="left"
              />
            ) : (
              <EmptySeat
                seatNumber={2}
                onInvite={() => {
                  navigator.clipboard.writeText(room.id);
                  setCopiedRoomId(true);
                  setTimeout(() => setCopiedRoomId(false), 2000);
                }}
              />
            )}
          </div>

          {/* Position 2: Top (Seat 2) */}
          <div className="absolute -top-7 sm:-top-10 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
            {seat2 ? (
              <PlayerSeat
                player={seat2}
                isActive={activeTurnIndex === 2 && gameStatus === 'betting'}
                timeLeft={activeTurnIndex === 2 ? turnTimeLeft : 0}
                isUser={false}
                speechBubble={playerBubbles[seat2.id]?.text}
                seatPosition="top"
              />
            ) : (
              <EmptySeat
                seatNumber={3}
                onInvite={() => {
                  navigator.clipboard.writeText(room.id);
                  setCopiedRoomId(true);
                  setTimeout(() => setCopiedRoomId(false), 2000);
                }}
              />
            )}
          </div>

          {/* Position 3: Right (Seat 3) */}
          <div className="absolute top-1/2 -right-8 sm:-right-12 -translate-y-1/2 z-20 flex flex-col items-center">
            {seat3 ? (
              <PlayerSeat
                player={seat3}
                isActive={activeTurnIndex === 3 && gameStatus === 'betting'}
                timeLeft={activeTurnIndex === 3 ? turnTimeLeft : 0}
                isUser={false}
                speechBubble={playerBubbles[seat3.id]?.text}
                seatPosition="right"
              />
            ) : (
              <EmptySeat
                seatNumber={4}
                onInvite={() => {
                  navigator.clipboard.writeText(room.id);
                  setCopiedRoomId(true);
                  setTimeout(() => setCopiedRoomId(false), 2000);
                }}
              />
            )}
          </div>

          {/* Flying Emojis */}
          {flyingEmojis.map((e) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 1, scale: 0.5, y: 0 }}
              animate={{ opacity: 0, scale: 2.2, y: -120 }}
              transition={{ duration: 1.8, ease: 'easeOut' }}
              className="absolute z-50 pointer-events-none text-3xl sm:text-4xl select-none"
              style={{ left: `${e.x}%`, top: `${e.y}%` }}
            >
              {e.emoji}
            </motion.div>
          ))}
        </div>
      </main>

      {/* Showdown Winner Overlay Modal */}
      <AnimatePresence>
        {winnerInfo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <div className="bg-gradient-to-b from-[#1c1c1c] via-[#141414] to-black border-2 border-[#F59E0B] rounded-3xl p-6 max-w-md w-full shadow-[0_0_40px_rgba(245,158,11,0.4)] text-center relative overflow-hidden">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#F59E0B] via-amber-400 to-yellow-300 text-black flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[#F59E0B]/40 font-bold">
                <Trophy className="w-9 h-9" />
              </div>
              <span className="text-xs font-black text-[#F59E0B] uppercase tracking-widest">
                ƏLİN QALİBİ
              </span>
              <h3 className="text-2xl font-black text-white mt-1">
                {winnerInfo?.winner?.username || 'Qalib'}
              </h3>
              <div className="my-3 py-2 px-5 bg-black/90 border border-[#F59E0B]/50 rounded-xl inline-block shadow-inner">
                <span className="text-xl sm:text-2xl font-black text-[#F59E0B]">
                  +{((winnerInfo && winnerInfo.potWon) || 0).toFixed(2)} ₼ Qazandı!
                </span>
              </div>
              <p className="text-xs sm:text-sm text-amber-200/90 font-bold mb-4">
                {winnerInfo?.evaluation?.description || 'Qalib əl'}
              </p>

              {/* Winner's Cards */}
              <div className="flex justify-center gap-2 mb-4">
                {Array.isArray(winnerInfo?.winner?.cards) &&
                  winnerInfo.winner.cards.map((c, i) => (
                    <CardView key={i} card={c} isFacedown={false} size="sm" />
                  ))}
              </div>

              <div className="text-[11px] text-white/50 flex items-center justify-center gap-1.5">
                <Hourglass className="w-3.5 h-3.5 animate-spin text-[#F59E0B]" />
                <span>Növbəti paylama {nextRoundCountdown > 0 ? `${nextRoundCountdown} saniyəyə` : 'indi'} başlayır...</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Raise Controller Slider */}
      <AnimatePresence>
        {showRaiseControl && isUserTurn && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="absolute bottom-28 sm:bottom-32 left-1/2 -translate-x-1/2 z-40 bg-[#161616] border-2 border-[#F59E0B] p-4 rounded-2xl shadow-2xl w-[90vw] max-w-sm"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-amber-300">Mərci Qaldır:</span>
              <span className="text-base font-mono font-black text-[#F59E0B]">
                {(raiseAmount || 0).toFixed(2)} ₼
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setRaiseAmount((prev) => Math.max(currentBet + room.stake, prev - room.stake))}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center active:scale-95"
              >
                <Minus className="w-4 h-4" />
              </button>

              <input
                type="range"
                min={currentBet + room.stake}
                max={Math.max(currentBet + room.stake, userPlayer?.balance || 10)}
                step={room.stake}
                value={raiseAmount}
                onChange={(e) => setRaiseAmount(parseFloat(e.target.value))}
                className="flex-1 accent-[#F59E0B] cursor-pointer"
              />

              <button
                onClick={() => setRaiseAmount((prev) => Math.min(userPlayer?.balance || 100, prev + room.stake))}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center active:scale-95"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setShowRaiseControl(false)}
                className="px-3 py-1.5 bg-white/10 text-white text-xs font-semibold rounded-lg"
              >
                İmtina
              </button>
              <button
                onClick={() => {
                  handlePlayerAction('raise', 0, raiseAmount);
                  setShowRaiseControl(false);
                }}
                className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-xs rounded-lg shadow-md hover:brightness-110 active:scale-95 cursor-pointer"
              >
                Təsdiqlə ({(raiseAmount || 0).toFixed(2)} ₼)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Action Footer */}
      <footer className="relative z-30 bg-[#121212] border-t border-[#F59E0B]/30 px-3 sm:px-6 py-2.5 sm:py-3 shadow-2xl">
        <div className="max-w-4xl mx-auto">
          {/* Waiting for other real players prompt if only 1 player */}
          {players.length < 2 && (
            <div className="mb-2 p-2 bg-black/60 border border-amber-500/30 rounded-xl text-center flex items-center justify-between gap-2">
              <span className="text-xs text-amber-200 font-semibold truncate">
                ⏳ Digər real oyunçuların masaya qoşulması gözlənilir (Ən azı 2 oyunçu lazımdır)...
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(room.id);
                  setCopiedRoomId(true);
                  setTimeout(() => setCopiedRoomId(false), 2000);
                }}
                className="px-2.5 py-1 bg-[#F59E0B] text-black font-bold text-xs rounded-lg hover:brightness-110 active:scale-95 shrink-0 flex items-center gap-1"
              >
                <Share2 className="w-3 h-3" />
                <span>{copiedRoomId ? 'Kopyalandı!' : 'Otaq ID Kopyala'}</span>
              </button>
            </div>
          )}

          {/* Action Buttons Grid */}
          <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
            {/* 1. Pas Keç */}
            <button
              disabled={!isUserTurn}
              onClick={() => handlePlayerAction('fold')}
              className={`py-2.5 sm:py-3 rounded-xl font-black uppercase tracking-wider text-xs transition border flex flex-col items-center justify-center ${
                isUserTurn
                  ? 'bg-gradient-to-b from-red-950/60 to-red-900/80 border-red-500/60 text-red-300 hover:from-red-900 hover:to-red-800 hover:text-white shadow-md shadow-red-950/40 active:scale-95 cursor-pointer'
                  : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed opacity-40'
              }`}
            >
              <span>Pas Keç</span>
            </button>

            {/* 2. Yoxla */}
            <button
              disabled={!isUserTurn || isUserBalanceInsufficient}
              onClick={() => handlePlayerAction('check')}
              className={`py-2.5 sm:py-3 rounded-xl font-black uppercase tracking-wider text-xs transition border flex flex-col items-center justify-center ${
                isUserTurn && !isUserBalanceInsufficient
                  ? 'bg-gradient-to-b from-blue-600/30 to-blue-900/40 border-blue-500/60 text-blue-300 hover:from-blue-600 hover:to-blue-700 hover:text-white active:scale-95 shadow-md shadow-blue-950/40 cursor-pointer'
                  : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed opacity-40'
              }`}
            >
              <span>Yoxla</span>
              <span className="text-[10px] font-mono text-amber-300 font-black">
                ({(yoxlaDisplayAmount || 0).toFixed(2)} ₼)
              </span>
            </button>

            {/* 3. Artır */}
            <button
              disabled={!isUserTurn || isUserBalanceInsufficient || (userPlayer?.balance || 0) < (currentBet + room.stake)}
              onClick={() => setShowRaiseControl(!showRaiseControl)}
              className={`py-2.5 sm:py-3 rounded-xl font-black uppercase tracking-wider text-xs transition flex flex-col items-center justify-center ${
                isUserTurn && !isUserBalanceInsufficient && (userPlayer?.balance || 0) >= (currentBet + room.stake)
                  ? 'bg-gradient-to-tr from-[#F59E0B] via-amber-400 to-yellow-300 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:brightness-110 active:scale-95 cursor-pointer'
                  : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed opacity-40'
              }`}
            >
              <span>Artır</span>
              <span className="text-[9px] font-bold text-black/80">+/- Sürgü</span>
            </button>

            {/* 4. Açdır */}
            <button
              disabled={!canShowdown || isUserBalanceInsufficient}
              onClick={() => {
                if (activePlayersCount === 2) {
                  handlePlayerAction('showdown');
                }
              }}
              className={`py-2.5 sm:py-3 rounded-xl font-black uppercase tracking-wider text-xs transition border flex flex-col items-center justify-center ${
                canShowdown && !isUserBalanceInsufficient
                  ? 'bg-gradient-to-b from-emerald-800/40 to-teal-950/80 border-emerald-500/70 text-emerald-300 hover:from-emerald-600 hover:to-teal-700 hover:text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] active:scale-95 cursor-pointer'
                  : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed opacity-40'
              }`}
            >
              <div className="flex items-center gap-1">
                <Eye className={`w-3 h-3 ${canShowdown && !isUserBalanceInsufficient ? 'text-emerald-400' : 'text-white/30'}`} />
                <span>Açdır</span>
              </div>
              <span className="text-[9px] font-mono">
                {activePlayersCount === 2 ? `(-${(yoxlaDisplayAmount || 0).toFixed(2)} ₼)` : '(2 nəfər)'}
              </span>
            </button>

            {/* 5. Vbank */}
            <button
              disabled={!isUserTurn || (userPlayer?.balance || 0) <= 0 || isUserBalanceInsufficient}
              onClick={handleAllIn}
              className={`py-2.5 sm:py-3 rounded-xl font-black uppercase tracking-wider text-xs transition border flex flex-col items-center justify-center ${
                isUserTurn && (userPlayer?.balance || 0) > 0 && !isUserBalanceInsufficient
                  ? 'bg-gradient-to-b from-amber-600/40 via-red-900/50 to-black border-amber-400 text-amber-300 hover:from-amber-500 hover:to-red-600 hover:text-white shadow-[0_0_15px_rgba(239,68,68,0.3)] active:scale-95 cursor-pointer'
                  : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed opacity-40'
              }`}
            >
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Vbank</span>
              </div>
              <span className="text-[9px] font-mono text-amber-200">
                {(userPlayer?.balance || 0).toFixed(2)} ₼
              </span>
            </button>

            {/* 6. Qaranlıq (Työşka 2X) */}
            <button
              disabled={!isUserTurn || isUserBalanceInsufficient}
              onClick={() => handlePlayerAction('seka')}
              className={`py-2.5 sm:py-3 rounded-xl font-black uppercase tracking-wider text-xs transition border flex flex-col items-center justify-center ${
                isUserTurn && !isUserBalanceInsufficient
                  ? 'bg-gradient-to-b from-purple-900/50 to-indigo-950/80 border-purple-500/70 text-purple-300 hover:from-purple-700 hover:to-indigo-800 hover:text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] active:scale-95 cursor-pointer'
                  : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed opacity-40'
              }`}
            >
              <div className="flex items-center gap-1">
                <Flame className="w-3 h-3 text-purple-400" />
                <span>Qaranlıq</span>
              </div>
              <span className="text-[9px] text-purple-200 font-semibold">Työşka 2X</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Game Events Audit Log Sidebar */}
      <GameEventsSidebar
        isOpen={isEventsSidebarOpen}
        onClose={() => setIsEventsSidebarOpen(false)}
        events={gameEvents}
        onClearEvents={() => setGameEvents([])}
        currentPot={pot}
        currentStake={room.stake}
        roundNumber={roundNumber}
        currentUserId={user.id}
        roomId={room.id}
      />
    </div>
  );
};

// Sub-Component: Player Seat with Avatar, Timer Circle, Bet, Cards & Speech Bubble
interface PlayerSeatProps {
  player?: Player;
  isActive: boolean;
  timeLeft: number;
  isUser: boolean;
  isDepositGrace?: boolean;
  userRevealedCards?: boolean;
  onToggleReveal?: () => void;
  handEvaluation?: HandEvaluation | null;
  speechBubble?: string | { text: string; id: string };
  seatPosition?: 'bottom' | 'left' | 'top' | 'right';
}

const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player,
  isActive,
  timeLeft,
  isUser,
  isDepositGrace = false,
  userRevealedCards = true,
  onToggleReveal,
  handEvaluation,
  speechBubble,
  seatPosition = 'bottom',
}) => {
  if (!player) return null;

  const timerLimit = isDepositGrace ? 300 : TURN_TIME_LIMIT;
  const timerPercent = (timeLeft / timerLimit) * 100;
  const bubbleText = typeof speechBubble === 'object' && speechBubble ? speechBubble.text : speechBubble;

  return (
    <div
      className={`relative flex flex-col items-center transition-all duration-300 ${
        player.isFolded ? 'opacity-35 grayscale scale-95' : 'opacity-100'
      }`}
    >
      {/* Speech Bubble */}
      <AnimatePresence>
        {bubbleText && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: -5, y: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: -10 }}
            exit={{ opacity: 0, scale: 0.8, x: 5, y: -10 }}
            transition={{ duration: 0.25 }}
            className={`absolute z-40 ${
              seatPosition === 'right' ? 'right-full mr-2' : 'left-full ml-2'
            } top-0 px-3 py-1.5 bg-gradient-to-r from-[#1f190e] to-black border border-[#F59E0B] rounded-2xl shadow-xl text-white text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5 pointer-events-none`}
          >
            <MessageSquare className="w-3 h-3 text-[#F59E0B] shrink-0" />
            <span className="text-amber-200">{bubbleText}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Last Action Bubble */}
      {player.lastAction && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-6 px-2 py-0.5 bg-black/90 border border-[#F59E0B]/60 rounded-full text-[9px] sm:text-[10px] font-bold text-amber-300 shadow-md whitespace-nowrap z-20 pointer-events-none"
        >
          {player.lastAction}
        </motion.div>
      )}

      {/* Cards Display */}
      <div className={`flex items-center -space-x-4 sm:-space-x-5 mb-1 z-10 ${isUser ? 'order-1' : 'order-2'}`}>
        {Array.isArray(player?.cards) &&
          player.cards.map((c, i) => {
            const isFacedown = isUser ? !userRevealedCards : !player.cardsRevealed;
            return (
              <div
                key={i}
                onClick={isUser ? onToggleReveal : undefined}
                className={`transform transition-transform hover:-translate-y-1.5 ${
                  isUser ? 'cursor-pointer' : ''
                }`}
              >
                <CardView card={c} isFacedown={isFacedown} size={isUser ? 'md' : 'xs'} />
              </div>
            );
          })}
      </div>

      {/* Seat Avatar & Timer Circle */}
      <div className={`relative flex items-center gap-1.5 bg-[#0e0e0e]/95 px-2.5 py-1 rounded-2xl border ${
        isActive
          ? isDepositGrace
            ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)]'
            : 'border-[#F59E0B] shadow-[0_0_15px_rgba(245,158,11,0.5)]'
          : 'border-white/10'
      } ${isUser ? 'order-2' : 'order-1'}`}>
        <div className="relative w-8 h-8 sm:w-9 sm:h-9">
          {isActive && (
            <svg className="absolute -inset-1 w-10 h-10 sm:w-11 sm:h-11 -rotate-90 pointer-events-none">
              <circle
                cx="20"
                cy="20"
                r="18"
                className={isDepositGrace ? 'stroke-red-500/20' : 'stroke-amber-500/20'}
                strokeWidth="3"
                fill="transparent"
              />
              <circle
                cx="20"
                cy="20"
                r="18"
                className={isDepositGrace ? 'stroke-red-500' : 'stroke-[#F59E0B]'}
                strokeWidth="3"
                strokeDasharray={113}
                strokeDashoffset={113 - (113 * timerPercent) / 100}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
          )}
          <img
            src={player?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${player?.id || 'player'}`}
            alt={player?.username || 'Oyunçu'}
            className="w-full h-full rounded-full object-cover border border-white/20"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <span className="text-[10px] sm:text-xs font-bold text-white max-w-[70px] sm:max-w-[90px] truncate">
              {player?.username || 'Oyunçu'}
            </span>
            {isUser && (
              <span className="text-[8px] bg-amber-500 text-black px-1 rounded font-black">
                Siz
              </span>
            )}
          </div>
          <span className="text-[9px] sm:text-[10px] font-mono font-bold text-amber-300">
            {((player && player.balance) || 0).toFixed(2)} ₼
          </span>
        </div>
      </div>
    </div>
  );
};

// Sub-Component: Empty Seat Placeholder (+ Boş Yer / Oyunçu Gözlənilir)
interface EmptySeatProps {
  seatNumber: number;
  onInvite: () => void;
}

const EmptySeat: React.FC<EmptySeatProps> = ({ seatNumber, onInvite }) => {
  return (
    <div 
      onClick={onInvite}
      title="Boş Yer - Otaq ID Kopyala və Oyunçu Dəvət Et"
      className="flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-2xl bg-black/45 border-2 border-dashed border-white/20 hover:border-[#F59E0B]/60 transition duration-200 cursor-pointer group min-w-[85px] sm:min-w-[105px]"
    >
      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 group-hover:border-[#F59E0B]/40 flex items-center justify-center text-white/30 group-hover:text-[#F59E0B] transition mb-1">
        <UserPlus className="w-4 h-4" />
      </div>
      <span className="text-[10px] text-white/60 font-bold">Boş Yer #{seatNumber}</span>
      <span className="text-[9px] text-[#F59E0B]/80 font-semibold animate-pulse">Gözlənilir...</span>
    </div>
  );
};
