import { GameBase } from './GameBase.js';

interface DotsAndBoxesState {
  gridSize: number;
  horizontalLines: boolean[][];
  verticalLines: boolean[][];
  boxes: (string | null)[][];
  currentPlayer: string;
  scores: { [playerId: string]: number };
}

interface DotsAndBoxesMove {
  type: 'horizontal' | 'vertical';
  row: number;
  col: number;
}

export class DotsAndBoxesGame extends GameBase {
  public readonly type = 'dotsAndBoxes';
  private readonly gridSize = 6; // 4x4 grid of dots = 3x3 grid of boxes

  protected initialize(): DotsAndBoxesState {
    let gridSize = 6;
    return {
      gridSize,
      horizontalLines: Array.from({ length: gridSize }, () => Array(gridSize - 1).fill(false)),
      verticalLines: Array.from({ length: gridSize - 1 }, () => Array(gridSize).fill(false)),
      boxes: Array.from({ length: gridSize - 1 }, () => Array(gridSize - 1).fill(null)),
      currentPlayer: this.players[0],
      scores: { [this.players[0]]: 0, [this.players[1]]: 0 },
    };
  }

  public isValidMove(playerId: string, move: unknown): { isValid: boolean; message: string } {
    if (playerId !== this.getCurrentPlayerTurn()) {
      return { isValid: false, message: 'Not your turn.' };
    }

    if (!move || typeof move !== 'object') {
      return { isValid: false, message: 'Invalid move.' };
    }

    const m = move as DotsAndBoxesMove;

    if (m.type === 'horizontal') {
      if (m.row < 0 || m.row >= this.gridSize || m.col < 0 || m.col >= this.gridSize - 1) {
        return { isValid: false, message: 'Invalid move.' };
      }
      const state = this.state as DotsAndBoxesState;
      return { isValid: !state.horizontalLines[m.row][m.col], message: 'Line already drawn.' };
    } else if (m.type === 'vertical') {
      if (m.row < 0 || m.row >= this.gridSize - 1 || m.col < 0 || m.col >= this.gridSize) {
        return { isValid: false, message: 'Invalid move.' };
      }
      const state = this.state as DotsAndBoxesState;
      return { isValid: !state.verticalLines[m.row][m.col], message: 'Line already drawn.' };
    }

    return { isValid: false, message: 'Invalid move.' };
  }

  protected executeMove(playerId: string, move: unknown): void {
    const state = this.state as DotsAndBoxesState;
    const m = move as DotsAndBoxesMove;

    let completedBoxes = 0;

    if (m.type === 'horizontal') {
      state.horizontalLines[m.row][m.col] = true;

      // Check boxes above and below this line
      if (m.row > 0) {
        completedBoxes += this.checkAndCompleteBox(state, m.row - 1, m.col, playerId);
      }
      if (m.row < state.gridSize - 1) {
        completedBoxes += this.checkAndCompleteBox(state, m.row, m.col, playerId);
      }
    } else {
      state.verticalLines[m.row][m.col] = true;

      // Check boxes to the left and right of this line
      if (m.col > 0) {
        completedBoxes += this.checkAndCompleteBox(state, m.row, m.col - 1, playerId);
      }
      if (m.col < state.gridSize - 1) {
        completedBoxes += this.checkAndCompleteBox(state, m.row, m.col, playerId);
      }
    }

    // If no boxes were completed, switch player
    if (completedBoxes === 0) {
      state.currentPlayer =
        state.currentPlayer === this.players[0] ? this.players[1] : this.players[0];
    }
    // If boxes were completed, player gets another turn
  }

  private checkAndCompleteBox(
    state: DotsAndBoxesState,
    boxRow: number,
    boxCol: number,
    playerId: string
  ): number {
    if (state.boxes[boxRow][boxCol] !== null) {
      return 0; // Box already claimed
    }

    const top = state.horizontalLines[boxRow][boxCol];
    const bottom = state.horizontalLines[boxRow + 1][boxCol];
    const left = state.verticalLines[boxRow][boxCol];
    const right = state.verticalLines[boxRow][boxCol + 1];

    if (top && bottom && left && right) {
      state.boxes[boxRow][boxCol] = playerId;
      state.scores[playerId]++;
      return 1;
    }

    return 0;
  }

  protected checkGameEnd(): void {
    const state = this.state as DotsAndBoxesState;
    const totalBoxes = (this.gridSize - 1) * (this.gridSize - 1);
    const completedBoxes = Object.values(state.boxes)
      .flat()
      .filter((b) => b !== null).length;

    if (completedBoxes === totalBoxes) {
      this.isFinished = true;
      const player1Score = state.scores[this.players[0]];
      const player2Score = state.scores[this.players[1]];

      if (player1Score > player2Score) {
        this.winner = this.players[0];
      } else if (player2Score > player1Score) {
        this.winner = this.players[1];
      } else {
        this.winner = null; // Draw
      }
    }
  }

  public getGameState() {
    const state = this.state as DotsAndBoxesState;
    return {
      gridSize: state.gridSize,
      horizontalLines: state.horizontalLines,
      verticalLines: state.verticalLines,
      boxes: state.boxes,
      currentPlayer: state.currentPlayer,
      scores: state.scores,
      isFinished: this.isFinished,
      winner: this.winner,
    };
  }

  public getCurrentPlayerTurn(): string | null {
    return (this.state as DotsAndBoxesState).currentPlayer;
  }
}
