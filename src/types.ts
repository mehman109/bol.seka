export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number; // Single card numeric value (A=11, K/Q/J/10=10, 9=9, etc.)
}

export interface HandEvaluation {
  score: number;
  type: 'three_aces' | 'three_sixes' | 'triplet' | 'pair_aces' | 'suit_flush' | 'high_card';
  description: string;
  cards: Card[];
  isSeka?: boolean; // Played blind / Seka
}

export interface Player {
  id: string;
  username: string;
  avatar: string;
  balance: number;
  currentBet: number;
  cards: Card[];
  isFolded: boolean;
  isSeka: boolean; // playing blind / dark
  cardsRevealed: boolean;
  isBot: boolean;
  seatIndex: number; // 0 (bottom/user), 1 (left), 2 (top), 3 (right)
  lastAction?: string;
  isWinner?: boolean;
}

export type RoomStatus = 'waiting' | 'in_game' | 'finished';

export interface Room {
  id: string;
  name: string;
  stake: number; // e.g. 0.20, 0.50, 1.00, 5.00
  maxPlayers: number;
  currentPlayers: number;
  status: RoomStatus;
  isPrivate?: boolean;
  isSekaOnly?: boolean;
  creatorId?: string;
}

export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'seka' | 'showdown' | 'split';

export interface TableAction {
  type: ActionType;
  amount?: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isSystem?: boolean;
  avatar?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  avatar: string;
  balance: number; // Cüzdan / Depozit balansı (yalnız depozit və uduşlar)
  bonusBalance?: number; // Xüsusi Bonus Balansı (yeni qeydiyyat 5.00 AZN və hədiyyələr)
  gamesPlayed: number;
  gamesWon: number;
  biggestPotWon: number;
  sekaCount: number;
  bonusClaimed: boolean;
}

export type BalanceMode = 'wallet' | 'bonus';

export interface TableRake {
  id?: string;
  roomId: string;
  roomName: string;
  totalPot: number; // 100% total collected pot in the round
  rakeAmount: number; // 10% commission deducted
  netPayout: number; // 90% paid out to the winner
  winnerId: string;
  winnerName: string;
  roundNumber: number;
  stake: number;
  date: string;
  createdAt?: any;
}

export interface WalletTransaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'win' | 'bet' | 'bonus';
  amount: number;
  date: string;
  status: 'completed' | 'pending' | 'rejected';
  method?: string;
  receiptId?: string;
}

export interface DepositReceipt {
  id?: string;
  userId: string;
  username: string;
  amount: number;
  method: string;
  type?: 'deposit' | 'withdrawal';
  receiptImage?: string;
  receiptDataUrl?: string;
  receiptName?: string;
  cardNumber?: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectedReason?: string;
  isEmergencyDeposit?: boolean;
  createdAt?: any;
}

export interface PlayerMessage {
  id?: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatar?: string;
  toUserId: string;
  toUsername: string;
  text: string;
  category?: 'proposal' | 'critique' | 'general';
  read: boolean;
  date: string;
  createdAt?: any;
}

export interface ActivityLog {
  id?: string;
  userId: string;
  username: string;
  actionType: 
    | 'login' 
    | 'logout' 
    | 'register' 
    | 'join_room' 
    | 'leave_room' 
    | 'bet' 
    | 'win' 
    | 'seka' 
    | 'deposit_request' 
    | 'deposit_approved' 
    | 'deposit_rejected' 
    | 'withdrawal_request' 
    | 'withdrawal_approved' 
    | 'withdrawal_rejected' 
    | 'bonus_claimed' 
    | 'direct_message' 
    | 'profile_update'
    | 'admin_action'
    | 'delete_action';
  details: string;
  amount?: number;
  roomId?: string;
  roomName?: string;
  date: string;
  createdAt?: any;
}

export interface GameEventLog {
  id: string;
  timestamp: number;
  timeStr: string;
  playerId?: string;
  playerName: string;
  playerAvatar?: string;
  actionType: 'deal' | 'bet' | 'check' | 'call' | 'raise' | 'fold' | 'allin' | 'seka' | 'showdown' | 'win' | 'standoff' | 'split' | 'system';
  amount?: number;
  potAfter?: number;
  description: string;
  roundNumber?: number;
}

