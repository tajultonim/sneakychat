// stores/gameStore.ts
import { writable, derived } from 'svelte/store';

export const MAX_BERRIES = 100;

export const berries = writable<number>(55);
export const onlineCount = writable<number>(1);

export function updateBerryUI(b: number): void {
  berries.set(b);
}

/** 0–100 fill % for the berry progress bar */
export const berryFillPct = derived(berries, ($b) =>
  Math.min(100, Math.round(($b / MAX_BERRIES) * 100))
);

// ── Game feature stores ──────────────────────────────────────────

export interface GameProposal {
  gameId: string;
  chatId: string;
  proposedBy: string;
  gameType: string;
}

export interface GameInstance {
  gameId: string;
  chatId: string;
  gameType: string;
  players: string[];
  state: unknown;
  isFinished: boolean;
  winner: string | null;
  currentPlayer: string | null;
}

// Current game proposal (if any)
export const gameProposal = writable<GameProposal | null>(null);

// Current active game (if any)
export const activeGame = writable<GameInstance | null>(null);

// Available game types
export const availableGames = writable<string[]>([
  'tictactoe',
  'connect4',
  'dotsAndBoxes',
  'rockPaperScissors',
]);

// Game display names
export const gameNames: { [key: string]: string } = {
  tictactoe: 'Tic-Tac-Toe',
  connect4: 'Connect 4',
  dotsAndBoxes: 'Dots and Boxes',
  rockPaperScissors: 'Rock Paper Scissors',
};

// Game descriptions
export const gameDescriptions: { [key: string]: string } = {
  tictactoe: 'Classic 3x3 grid game',
  connect4: 'Get 4 in a row',
  dotsAndBoxes: 'Claim more boxes',
  rockPaperScissors: 'Quick hand game',
};

// Derived store: check if there's an active game
export const hasActiveGame = derived(activeGame, ($activeGame) => $activeGame !== null);

// Derived store: check if there's a pending proposal
export const hasGameProposal = derived(gameProposal, ($proposal) => $proposal !== null);

// Game size state
export const gameSize = writable<'normal' | 'minimized' | 'maximized'>('normal');
