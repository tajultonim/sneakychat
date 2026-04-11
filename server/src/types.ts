export interface FoxPayload {
  berries: number;
  lastMatch: number | null;
  activeChatId: string | null;
  iat?: number;
  ua?: string;
}

export interface QueueEntry {
  socketId: string;
  payload: FoxPayload;
}

export interface Chat {
  users: string[];
  extendVotes: Set<string>;
  timer: Timer | null;
  phase: 'initial' | 'extended';
  timerEndedAt: number | null;
  startedAt: number;
}

export class Timer {
  private timer: NodeJS.Timeout;
  public endAt: number;

  constructor(
    private callback: () => void,
    public duration: number
  ) {
    this.timer = setTimeout(callback, duration);
    this.endAt = Date.now() + duration;
  }

  getRemaining(): number {
    return Math.max(this.endAt - Date.now(), 0);
  }

  clear(): void {
    clearTimeout(this.timer);
  }
}

export type GameType = 'dotsAndBoxes' | 'tictactoe' | 'connect4' | 'rockPaperScissors';

export interface GameMove {
  playerId: string;
  move: unknown;
  timestamp: number;
}

export interface GameInstance {
  gameId: string;
  chatId: string;
  gameType: GameType;
  players: string[];
  state: unknown;
  status: 'pending' | 'playing' | 'finished';
  winner: string | null;
  moveHistory: GameMove[];
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
}
