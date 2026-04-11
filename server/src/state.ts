import type { QueueEntry, Chat, FoxPayload, GameInstance, GameType } from './types.js';
import { GameFactory } from './games/GameFactory.js';

export const matchmakingQueue: QueueEntry[] = [];
export const activeChats = new Map<string, Chat>();
export const socketToChat = new Map<string, string>();
export const socketPayloads = new Map<string, FoxPayload>();
export const activeGames = new Map<string, GameInstance>();
export const chatToGame = new Map<string, string>();

export let lastBroadcastTime = 0;

export function setLastBroadcastTime(time: number): void {
  lastBroadcastTime = time;
}

/**
 * Create a new game instance
 */
export function createGameInstance(
  gameId: string,
  chatId: string,
  gameType: GameType,
  player1Id: string,
  player2Id: string
): GameInstance {
  const gameObj = GameFactory.createGame(gameType, gameId, player1Id, player2Id);

  const gameInstance: GameInstance = {
    gameId,
    chatId,
    gameType,
    players: [player1Id, player2Id],
    state: gameObj.state,
    status: 'pending',
    winner: null,
    moveHistory: [],
    createdAt: Date.now(),
    startedAt: null,
    endedAt: null,
  };

  activeGames.set(gameId, gameInstance);
  chatToGame.set(chatId, gameId);

  return gameInstance;
}

/**
 * Get game by chat ID
 */
export function getGameByChat(chatId: string): GameInstance | undefined {
  const gameId = chatToGame.get(chatId);
  return gameId ? activeGames.get(gameId) : undefined;
}

/**
 * End and remove a game
 */
export function removeGame(gameId: string): void {
  const game = activeGames.get(gameId);
  if (game) {
    chatToGame.delete(game.chatId);
    activeGames.delete(gameId);
  }
}
