import { GameMove } from '../types';

export abstract class GameBase {
  public gameId: string;
  public players: [string, string];
  public state: unknown;
  public moveHistory: GameMove[] = [];
  public winner: string | null = null;
  public isFinished: boolean = false;
  public abstract readonly type: string;

  constructor(gameId: string, player1Id: string, player2Id: string) {
    this.gameId = gameId;
    this.players = [player1Id, player2Id];
    this.state = this.initialize();
  }

  /**
   * Initialize game state - must be implemented by subclasses
   */
  protected abstract initialize(): unknown;

  /**
   * Check if a move is valid for the given player
   */
  public abstract isValidMove(
    playerId: string,
    move: unknown
  ): { isValid: boolean; message: string };

  /**
   * Apply a move to the game state and record it
   */
  public applyMove(playerId: string, move: unknown): void {
    if (this.isFinished) {
      throw new Error('Game is already finished');
    }

    const moveResult = this.isValidMove(playerId, move);
    if (!moveResult.isValid) {
      throw new Error(moveResult.message);
    }

    this.moveHistory.push({
      playerId,
      move,
      timestamp: Date.now(),
    });

    this.executeMove(playerId, move);
    this.checkGameEnd();
  }

  /**
   * Execute the move on the game state - must be implemented by subclasses
   */
  protected abstract executeMove(playerId: string, move: unknown): void;

  /**
   * Check if the game has ended and determine winner if so
   */
  protected abstract checkGameEnd(): void;

  /**
   * Get the current game state to send to clients
   */
  public abstract getGameState(): unknown;

  /**
   * Get whose turn it is (null if simultaneous play)
   */
  public abstract getCurrentPlayerTurn(): string | null;

  /**
   * Get the other player
   */
  protected getOpponentId(playerId: string): string {
    return this.players[0] === playerId ? this.players[1] : this.players[0];
  }
}
