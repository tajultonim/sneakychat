import { GameBase } from './GameBase.js';

interface Connect4State {
  board: (string | null)[][];
  currentPlayer: string;
}

export class Connect4Game extends GameBase {
  public readonly type = 'connect4';
  private readonly ROWS = 6;
  private readonly COLS = 7;

  protected initialize(): Connect4State {
    let b = Array.from({ length: 6 }, () => Array(7).fill(null));
    return {
      board: b,
      currentPlayer: this.players[0],
    };
  }

  public isValidMove(playerId: string, move: unknown): { isValid: boolean; message: string } {
    if (playerId !== this.getCurrentPlayerTurn()) {
      return { isValid: false, message: 'Not your turn.' };
    }

    if (typeof move !== 'number' || move < 0 || move >= this.COLS) {
      return { isValid: false, message: 'Invalid move.' };
    }

    const state = this.state as Connect4State;
    // Check if column is not full
    console.log(state.board, state);
    return { isValid: state.board[0][move] === null, message: 'Column is full.' };
  }

  protected executeMove(playerId: string, move: unknown): void {
    const state = this.state as Connect4State;
    const column = move as number;
    const playerSymbol = playerId === this.players[0] ? 'X' : 'O';

    // Find the lowest empty row in the column
    for (let row = this.ROWS - 1; row >= 0; row--) {
      if (state.board[row][column] === null) {
        state.board[row][column] = playerSymbol;
        break;
      }
    }

    // Switch to other player
    state.currentPlayer =
      state.currentPlayer === this.players[0] ? this.players[1] : this.players[0];
  }

  protected checkGameEnd(): void {
    const state = this.state as Connect4State;
    const board = state.board;

    // Check for winner
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS; col++) {
        if (board[row][col] === null) continue;

        const symbol = board[row][col];

        // Check horizontal
        if (col + 3 < this.COLS) {
          if (
            board[row][col + 1] === symbol &&
            board[row][col + 2] === symbol &&
            board[row][col + 3] === symbol
          ) {
            this.winner = symbol === 'X' ? this.players[0] : this.players[1];
            this.isFinished = true;
            return;
          }
        }

        // Check vertical
        if (row + 3 < this.ROWS) {
          if (
            board[row + 1][col] === symbol &&
            board[row + 2][col] === symbol &&
            board[row + 3][col] === symbol
          ) {
            this.winner = symbol === 'X' ? this.players[0] : this.players[1];
            this.isFinished = true;
            return;
          }
        }

        // Check diagonal (top-left to bottom-right)
        if (row + 3 < this.ROWS && col + 3 < this.COLS) {
          if (
            board[row + 1][col + 1] === symbol &&
            board[row + 2][col + 2] === symbol &&
            board[row + 3][col + 3] === symbol
          ) {
            this.winner = symbol === 'X' ? this.players[0] : this.players[1];
            this.isFinished = true;
            return;
          }
        }

        // Check diagonal (top-right to bottom-left)
        if (row + 3 < this.ROWS && col - 3 >= 0) {
          if (
            board[row + 1][col - 1] === symbol &&
            board[row + 2][col - 2] === symbol &&
            board[row + 3][col - 3] === symbol
          ) {
            this.winner = symbol === 'X' ? this.players[0] : this.players[1];
            this.isFinished = true;
            return;
          }
        }
      }
    }

    // Check for draw
    if (board[0].every((cell) => cell !== null)) {
      this.isFinished = true;
      this.winner = null; // Draw
    }
  }

  public getGameState() {
    const state = this.state as Connect4State;
    return {
      board: state.board,
      currentPlayer: state.currentPlayer,
      isFinished: this.isFinished,
      winner: this.winner,
    };
  }

  public getCurrentPlayerTurn(): string | null {
    return (this.state as Connect4State).currentPlayer;
  }
}
