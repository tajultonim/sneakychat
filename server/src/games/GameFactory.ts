import { GameType } from '../types.js';
import { GameBase } from './GameBase.js';
import { TictactoeGame } from './TicTacToe.js';
import { Connect4Game } from './Connect4.js';
import { RockPaperScissorsGame } from './RockPaperScissors.js';
import { DotsAndBoxesGame } from './DotsAndBoxes.js';

export class GameFactory {
  private static readonly gameRegistry: {
    [key in GameType]: new (gameId: string, p1: string, p2: string) => GameBase;
  } = {
    tictactoe: TictactoeGame,
    connect4: Connect4Game,
    rockPaperScissors: RockPaperScissorsGame,
    dotsAndBoxes: DotsAndBoxesGame,
  };

  /**
   * Create a new game instance
   */
  static createGame(
    gameType: GameType,
    gameId: string,
    player1Id: string,
    player2Id: string
  ): GameBase {
    const GameClass = this.gameRegistry[gameType];
    if (!GameClass) {
      throw new Error(`Unknown game type: ${gameType}`);
    }
    return new GameClass(gameId, player1Id, player2Id);
  }

  /**
   * Get list of available game types
   */
  static getAvailableGames(): GameType[] {
    return Object.keys(this.gameRegistry) as GameType[];
  }

  /**
   * Register a new game type (for extensibility)
   */
  static registerGame(
    gameType: GameType,
    GameClass: new (gameId: string, p1: string, p2: string) => GameBase
  ): void {
    this.gameRegistry[gameType] = GameClass;
  }
}
