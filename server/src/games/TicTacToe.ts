import { GameBase } from './GameBase.js';

interface TictactoeState {
  board: (string | null)[];
  currentPlayer: string;
}

export class TictactoeGame extends GameBase {
  public readonly type = 'tictactoe';

  protected initialize(): TictactoeState {
    return {
      board: Array(9).fill(null),
      currentPlayer: this.players[0],
    };
  }

  public isValidMove(playerId: string, move: unknown): { isValid: boolean; message: string } {
    if (playerId !== this.getCurrentPlayerTurn()) {
      return { isValid: false, message: 'Not your turn.' };
    }

    if (typeof move !== 'number' || move < 0 || move > 8) {
      return { isValid: false, message: 'Invalid move.' };
    }

    const state = this.state as TictactoeState;
    return { isValid: state.board[move] === null, message: '' };
  }

  protected executeMove(playerId: string, move: unknown): void {
    const state = this.state as TictactoeState;
    const position = move as number;
    const playerSymbol = playerId === this.players[0] ? 'X' : 'O';

    state.board[position] = playerSymbol;

    // Switch to other player
    state.currentPlayer =
      state.currentPlayer === this.players[0] ? this.players[1] : this.players[0];
  }

  protected checkGameEnd(): void {
    const state = this.state as TictactoeState;
    const winning_positions = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];

    for (const [a, b, c] of winning_positions) {
      if (
        state.board[a] &&
        state.board[a] === state.board[b] &&
        state.board[a] === state.board[c]
      ) {
        // Find which player has this symbol
        const symbol = state.board[a];
        this.winner = symbol === 'X' ? this.players[0] : this.players[1];
        this.isFinished = true;
        return;
      }
    }

    // Check for draw
    if (state.board.every((cell) => cell !== null)) {
      this.isFinished = true;
      this.winner = null; // Draw
    }
  }

  public getGameState() {
    const state = this.state as TictactoeState;
    return {
      board: state.board,
      currentPlayer: state.currentPlayer,
      isFinished: this.isFinished,
      winner: this.winner,
    };
  }

  public getCurrentPlayerTurn(): string | null {
    return (this.state as TictactoeState).currentPlayer;
  }
}
