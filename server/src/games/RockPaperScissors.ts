import { GameBase } from './GameBase.js';

interface RockPaperScissorsState {
  moves: Record<string, string | null>;
  result: {
    move1: string;
    move2: string;
    outcome: 'win' | 'lose' | 'draw';
    winner: string | null;
  } | null;
}

export class RockPaperScissorsGame extends GameBase {
  public readonly type = 'rockPaperScissors';

  protected initialize(): RockPaperScissorsState {
    return {
      moves: {
        [this.players[0]]: null,
        [this.players[1]]: null,
      },
      result: null,
    };
  }

  public isValidMove(playerId: string, move: unknown): { isValid: boolean; message: string } {
    if (!this.players.includes(playerId)) {
      return { isValid: false, message: 'You are not a player in this game.' };
    }

    if (typeof move !== 'string') {
      return { isValid: false, message: 'Invalid move type.' };
    }

    const validMoves = ['rock', 'paper', 'scissors'];
    if (!validMoves.includes(move)) {
      return { isValid: false, message: 'Invalid move.' };
    }

    const state = this.state as RockPaperScissorsState;

    return {
      isValid: state.moves[playerId] === null,
      message: 'You have already made a move.',
    };
  }

  protected executeMove(playerId: string, move: unknown): void {
    const state = this.state as RockPaperScissorsState;
    state.moves[playerId] = move as string;
  }

  protected checkGameEnd(): void {
    const state = this.state as RockPaperScissorsState;

    // Check if both players have moved
    if (state.moves[this.players[0]] === null || state.moves[this.players[1]] === null) {
      return;
    }

    const move1 = state.moves[this.players[0]]!;
    const move2 = state.moves[this.players[1]]!;

    if (move1 === move2) {
      // Draw
      this.winner = null;
      state.result = {
        move1,
        move2,
        outcome: 'draw',
        winner: null,
      };
    } else if (this.beats(move1, move2)) {
      // Player 1 wins
      this.winner = this.players[0];
      state.result = {
        move1,
        move2,
        outcome: 'win',
        winner: this.players[0],
      };
    } else {
      // Player 2 wins
      this.winner = this.players[1];
      state.result = {
        move1,
        move2,
        outcome: 'lose',
        winner: this.players[1],
      };
    }

    this.isFinished = true;
  }

  private beats(move1: string, move2: string): boolean {
    if (move1 === 'rock') return move2 === 'scissors';
    if (move1 === 'paper') return move2 === 'rock';
    if (move1 === 'scissors') return move2 === 'paper';
    return false;
  }

  public getGameState() {
    const state = this.state as RockPaperScissorsState;
    return {
      hasPlayer1Moved: state.moves[this.players[0]] !== null,
      hasPlayer2Moved: state.moves[this.players[1]] !== null,
      result: state.result,
      isFinished: this.isFinished,
      winner: this.winner,
      players: this.players,
    };
  }

  public getCurrentPlayerTurn(): string | null {
    // Simultaneous play, so no turn-based system
    return null;
  }
}
