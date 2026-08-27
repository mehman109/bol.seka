import { Card, HandEvaluation, Rank, Suit } from '../types';

export const SUITS: { suit: Suit; symbol: string; name: string; color: string }[] = [
  { suit: 'spades', symbol: '♠', name: 'Pik', color: 'text-slate-900' },
  { suit: 'hearts', symbol: '♥', name: 'Kupa', color: 'text-red-600' },
  { suit: 'diamonds', symbol: '♦', name: 'Kərpic', color: 'text-amber-600' },
  { suit: 'clubs', symbol: '♣', name: 'Xaç', color: 'text-emerald-950' },
];

export const RANKS: Rank[] = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const RANK_NAMES: Record<Rank, string> = {
  '6': '6-lıq',
  '7': '7-lik',
  '8': '8-lik',
  '9': '9-luq',
  '10': '10-luq',
  'J': 'Valet',
  'Q': 'Dama',
  'K': 'Karol',
  'A': 'Tuz',
};

// Calculate base point value of a card in Seka
export function getCardBaseValue(rank: Rank): number {
  if (rank === 'A') return 11;
  if (['K', 'Q', 'J', '10'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

// Generate standard 36 card Seka deck
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suitObj of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${suitObj.suit}-${rank}-${Math.random().toString(36).substring(2, 7)}`,
        suit: suitObj.suit,
        rank,
        value: getCardBaseValue(rank),
      });
    }
  }
  return deck;
}

// Fisher-Yates Shuffle
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Evaluate 3-card hand according to strict Seka rules
export function evaluateHand(cards: Card[]): HandEvaluation {
  if (!cards || cards.length === 0) {
    return {
      score: 0,
      type: 'high_card',
      description: 'Kart yoxdur',
      cards: [],
    };
  }

  // Count ranks
  const rankCounts: Record<string, number> = {};
  cards.forEach((c) => {
    rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
  });

  // 1. Check for 3 Aces (3 Tuz) -> 33 xal
  if (rankCounts['A'] === 3) {
    return {
      score: 33,
      type: 'three_aces',
      description: '3 Tuz (33 xal) — Ən güclü Seka kombinasiyası!',
      cards,
    };
  }

  // 2. Check for 3 Sixes (3 Altılıq - Şeşlər) -> 32 xal (Seka xüsusi qaydası)
  if (rankCounts['6'] === 3) {
    return {
      score: 32,
      type: 'three_sixes',
      description: '3 Altılıq (32 xal) — Şeşlər (Xüsusi Seka qaydası)!',
      cards,
    };
  }

  // 3. Check for other Triplets (3 Eyni Dəyərli Kart)
  for (const rank of ['K', 'Q', 'J', '10', '9', '8', '7'] as Rank[]) {
    if (rankCounts[rank] === 3) {
      let score = 30;
      if (rank === '9') score = 27;
      if (rank === '8') score = 24;
      if (rank === '7') score = 21;

      return {
        score,
        type: 'triplet',
        description: `3 ${RANK_NAMES[rank]} (${score} xal)`,
        cards,
      };
    }
  }

  // 4. Check for 2 Aces (2 Tuz) -> 22 xal (Seka xüsusi qaydası)
  let twoAcesScore = 0;
  if (rankCounts['A'] === 2) {
    twoAcesScore = 22;
  }

  // 5. Suit flush calculation (Eyni rəng/simvol kartların cəmi)
  const suitSums: Record<Suit, { sum: number; count: number; cards: Card[] }> = {
    spades: { sum: 0, count: 0, cards: [] },
    hearts: { sum: 0, count: 0, cards: [] },
    diamonds: { sum: 0, count: 0, cards: [] },
    clubs: { sum: 0, count: 0, cards: [] },
  };

  cards.forEach((c) => {
    suitSums[c.suit].sum += c.value;
    suitSums[c.suit].count += 1;
    suitSums[c.suit].cards.push(c);
  });

  let bestSuit: Suit = 'spades';
  let maxSuitSum = 0;
  let maxSuitCount = 0;

  for (const s of Object.keys(suitSums) as Suit[]) {
    if (suitSums[s].sum > maxSuitSum) {
      maxSuitSum = suitSums[s].sum;
      bestSuit = s;
      maxSuitCount = suitSums[s].count;
    }
  }

  // Single highest card fallback
  let highestSingleCard = cards[0];
  cards.forEach((c) => {
    if (c.value > highestSingleCard.value) {
      highestSingleCard = c;
    }
  });

  const suitName = SUITS.find((s) => s.suit === bestSuit)?.name || bestSuit;

  if (twoAcesScore > maxSuitSum) {
    return {
      score: 22,
      type: 'pair_aces',
      description: '2 Tuz (22 xal) — Cüt Tuz qaydası',
      cards,
    };
  }

  if (maxSuitCount >= 2) {
    return {
      score: maxSuitSum,
      type: 'suit_flush',
      description: `${suitName} kombinasiyası (${maxSuitSum} xal)`,
      cards,
    };
  }

  return {
    score: highestSingleCard.value,
    type: 'high_card',
    description: `Böyük kart: ${RANK_NAMES[highestSingleCard.rank]} (${highestSingleCard.value} xal)`,
    cards,
  };
}

/**
 * Super Intelligent Pro Seka Card Distributor:
 * Gives high-tier premium hands preferentially to bots (3 Aces, 3 Sixes, Triplets, 2 Aces, 30+ Pt Flush),
 * while maintaining game realism.
 */
export function dealSekaHands(playersCount: number): Card[][] {
  const fullDeck = shuffleDeck(createDeck());
  const hands: Card[][] = [];

  // Generate candidates for 4 hands
  for (let i = 0; i < playersCount; i++) {
    hands.push(fullDeck.slice(i * 3, i * 3 + 3));
  }

  // Score all generated hands
  const scoredHands = hands.map((hand) => ({
    hand,
    eval: evaluateHand(hand),
  }));

  // Sort best to worst
  scoredHands.sort((a, b) => b.eval.score - a.eval.score);

  // 75% of the time, give the best hand to bot players (Seat 1, 2, 3), keeping bots ultra competitive and strong
  const result: Card[][] = new Array(playersCount);

  if (playersCount >= 4 && Math.random() < 0.80) {
    // Pick random bot seat (1, 2, or 3) to get the #1 absolute top hand
    const topBotSeat = 1 + Math.floor(Math.random() * (playersCount - 1));
    result[topBotSeat] = scoredHands[0].hand;

    // Remaining hands assigned
    const remainingSeats = Array.from({ length: playersCount }, (_, i) => i).filter((s) => s !== topBotSeat);
    for (let i = 0; i < remainingSeats.length; i++) {
      result[remainingSeats[i]] = scoredHands[i + 1].hand;
    }
    return result;
  }

  return hands;
}

/**
 * Super Intelligent Seka Pro Bot AI Decision Engine:
 * Bots analyze pot odds, table stake, bluff probability, high-rank flushes,
 * Seka multiplier advantages, and showdown dynamics.
 */
export function makeBotDecision(
  botHand: Card[],
  isSeka: boolean,
  currentBet: number,
  botBet: number,
  pot: number,
  botBalance: number,
  activePlayersCount: number,
  roundNumber: number,
  tableStake: number = 0.20
): { action: 'fold' | 'check' | 'call' | 'raise' | 'seka' | 'showdown'; raiseAmount?: number } {
  const callAmount = Math.max(0, currentBet - botBet);

  // 1. If bot is playing Seka (Dark / Työşka)
  if (isSeka) {
    const rand = Math.random();
    if (rand < 0.40 && botBalance >= currentBet * 2) {
      return { action: 'seka', raiseAmount: currentBet * 2 };
    }
    if (rand < 0.75 && callAmount <= botBalance) {
      return { action: callAmount === 0 ? 'check' : 'call' };
    }
    if (activePlayersCount === 2 && rand < 0.90) {
      return { action: 'showdown' };
    }
    return { action: callAmount === 0 ? 'check' : 'call' };
  }

  // 2. Evaluate bot's hand
  const evaluation = evaluateHand(botHand);
  const score = evaluation.score;

  // Ultra Monster Hand (3 Aces = 33, 3 Sixes = 32, Triplets 30, Flushes 30+)
  if (score >= 30) {
    // 70% aggressively raise to milk the pot
    if (Math.random() < 0.70 && botBalance >= callAmount + tableStake) {
      const step = Math.max(tableStake, Math.round((currentBet * 0.5) * 100) / 100);
      return { action: 'raise', raiseAmount: currentBet + step };
    }
    // In 1v1 showdown situations, open cards to take down pot
    if (activePlayersCount === 2 && Math.random() < 0.45) {
      return { action: 'showdown' };
    }
    // Otherwise call/check to trap
    return { action: callAmount === 0 ? 'check' : 'call' };
  }

  // High Pro Hand (22 - 29 points: 2 Aces 22, 23-29 point flushes)
  if (score >= 22) {
    if (callAmount === 0) {
      // Free check or value raise
      if (Math.random() < 0.55 && botBalance >= currentBet + tableStake) {
        return { action: 'raise', raiseAmount: currentBet + tableStake };
      }
      return { action: 'check' };
    }

    // Facing a bet: call if affordable
    if (callAmount <= botBalance) {
      if (activePlayersCount === 2 && Math.random() < 0.50) {
        return { action: 'showdown' };
      }
      if (Math.random() < 0.40 && botBalance >= currentBet + tableStake * 2) {
        return { action: 'raise', raiseAmount: currentBet + tableStake };
      }
      return { action: 'call' };
    }
    return { action: 'fold' };
  }

  // Medium Hand (19 - 21 points: 20-21 pt flushes like Tuz+Valet)
  if (score >= 19) {
    if (callAmount === 0) {
      if (Math.random() < 0.25 && botBalance >= currentBet + tableStake) {
        return { action: 'raise', raiseAmount: currentBet + tableStake };
      }
      return { action: 'check' };
    }

    // Call moderate bets
    if (callAmount <= tableStake * 3 && callAmount <= botBalance) {
      if (activePlayersCount === 2 && Math.random() < 0.30) {
        return { action: 'showdown' };
      }
      return Math.random() < 0.85 ? { action: 'call' } : { action: 'fold' };
    }

    return Math.random() < 0.35 ? { action: 'call' } : { action: 'fold' };
  }

  // Weak Hand (under 19 points)
  if (callAmount === 0) {
    // If free, always check
    return { action: 'check' };
  }

  // Pure small call check if minimal ante
  if (callAmount <= tableStake && Math.random() < 0.45 && callAmount <= botBalance) {
    return { action: 'call' };
  }

  // Smart Tactical Bluff (15% chance if table is quiet)
  if (Math.random() < 0.15 && botBalance >= currentBet + tableStake * 2 && activePlayersCount <= 3) {
    return { action: 'raise', raiseAmount: currentBet + tableStake };
  }

  // Fold weak hand
  return { action: 'fold' };
}
