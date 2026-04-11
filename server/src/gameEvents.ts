import { Server, Socket } from 'socket.io';
import { GameFactory } from './games/GameFactory.js';
import {
  socketPayloads,
  socketToChat,
  activeChats,
  activeGames,
  createGameInstance,
  removeGame,
  getGameByChat,
} from './state.js';
import { GAME_WIN_REWARD, GAME_PROPOSAL_TIMEOUT } from './constants.js';
import { clamp, generateChatId } from './utils.js';
import { signToken } from './tokens.js';
import type { GameType, GameInstance } from './types.js';

// Track active game proposals: Map<chatId, { gameType, proposedBy, timeout }>
const activeProposals = new Map<
  string,
  { gameType: GameType; proposedBy: string; timeout: NodeJS.Timeout }
>();

export function registerGameEventHandlers(io: Server, socket: Socket): void {
  // ── proposeGame ────────────────────────────────────────────────────────
  socket.on('proposeGame', ({ gameType }: { gameType: GameType }) => {
    const chatId = socketToChat.get(socket.id);
    if (!chatId) return socket.emit('error', { msg: 'Not in a chat.' });

    const chat = activeChats.get(chatId);
    if (!chat) return;

    // Check if game already exists for this chat
    if (activeProposals.has(chatId) || getGameByChat(chatId)) {
      let game = getGameByChat(chatId);
      if (game && !game?.players.includes(socket.id)) {
        removeGame(game?.gameId);
      } else {
        return socket.emit('error', { msg: 'Game already in progress or proposed.' });
      }
    }

    // Validate game type
    if (!GameFactory.getAvailableGames().includes(gameType)) {
      return socket.emit('error', { msg: 'Invalid game type.' });
    }

    const partnerId = chat.users.find((id) => id !== socket.id);
    if (!partnerId) return socket.emit('error', { msg: 'Partner not found.' });

    const partnerSocket = io.sockets.sockets.get(partnerId);
    if (!partnerSocket) return socket.emit('error', { msg: 'Partner is offline.' });

    const gameId = generateChatId(); // Reuse ID generator for game IDs
    const proposal = {
      gameType,
      proposedBy: socket.id,
      timeout: setTimeout(() => {
        activeProposals.delete(chatId);
        socket.emit('info', { msg: 'Game proposal expired.' });
        partnerSocket?.emit('info', { msg: 'Game proposal expired.' });
      }, GAME_PROPOSAL_TIMEOUT),
    };

    activeProposals.set(chatId, proposal);

    socket.emit('info', { msg: `Proposing ${gameType}...` });
    partnerSocket.emit('gameProposal', {
      gameId,
      chatId,
      proposedBy: socket.id,
      gameType,
    });

    console.log(`🎮 Game proposal: ${chatId} - ${gameType}`);
  });

  // ── declineGame ────────────────────────────────────────────────────────
  socket.on('declineGame', ({ chatId }: { chatId: string }) => {
    const proposal = activeProposals.get(chatId);
    if (!proposal) return socket.emit('error', { msg: 'No game proposal to decline.' });

    const chat = activeChats.get(chatId);
    if (!chat || !chat.users.includes(socket.id)) return;

    const proposerId = proposal.proposedBy;
    clearTimeout(proposal.timeout);
    activeProposals.delete(chatId);

    const proposerSocket = io.sockets.sockets.get(proposerId);
    if (proposerSocket) {
      proposerSocket.emit('info', { msg: 'Your partner declined the game.' });
    }
    socket.emit('info', { msg: 'You declined the game.' });

    console.log(`❌ Game declined: ${chatId}`);
  });

  // ── acceptGame ────────────────────────────────────────────────────────
  socket.on('acceptGame', ({ gameId, chatId }: { gameId: string; chatId: string }) => {
    const proposal = activeProposals.get(chatId);
    if (!proposal) return socket.emit('error', { msg: 'No active game proposal.' });

    const chat = activeChats.get(chatId);
    if (!chat || !chat.users.includes(socket.id)) return;

    const proposerId = proposal.proposedBy;
    const gameType = proposal.gameType;

    // Clear timeout
    clearTimeout(proposal.timeout);
    activeProposals.delete(chatId);

    // Create new game instance
    const game = createGameInstance(gameId, chatId, gameType, proposerId, socket.id);
    game.status = 'playing';
    game.startedAt = Date.now();

    const proposerSocket = io.sockets.sockets.get(proposerId);

    // Send game start event to both players
    const gameState = {
      gameId,
      chatId,
      gameType,
      initialState: game.state,
      players: game.players,
      message: `🎮 Game started: ${gameType}`,
    };

    socket.emit('gameStarted', gameState);
    if (proposerSocket) {
      proposerSocket.emit('gameStarted', gameState);
    }

    console.log(`🎮 Game started: ${chatId} - ${gameType}`);
  });

  // ── makeGameMove ───────────────────────────────────────────────────────
  socket.on(
    'makeGameMove',
    ({ gameId, move }: { gameId: string; move: unknown }, callback: (response: any) => void) => {
      if (!callback || typeof callback !== 'function') return;

      const game = activeGames.get(gameId);
      if (!game) return callback({ status: 'error', msg: 'Game not found.' });

      if (game.status === 'finished') {
        return callback({ status: 'error', msg: 'Game is already finished.' });
      }

      if (!game.players.includes(socket.id)) {
        return callback({ status: 'error', msg: 'You are not a player in this game.' });
      }

      // Import game class dynamically to apply move
      try {
        const gameObj = GameFactory.createGame(
          game.gameType,
          gameId,
          game.players[0],
          game.players[1]
        );
        // Restore game state with deep copy to preserve structure
        gameObj.state = game.state;
        gameObj.moveHistory = game.moveHistory || [];
        (gameObj as any).isFinished = (game.status as any) === 'finished';
        (gameObj as any).winner = game.winner;

        // Validate and apply move
        if (!gameObj.isValidMove(socket.id, move).isValid) {
          return callback({
            status: 'error',
            msg: gameObj.isValidMove(socket.id, move).message || 'Invalid move.',
          });
        }

        gameObj.applyMove(socket.id, move);

        // Update game state
        game.state = gameObj.state;
        game.moveHistory = gameObj.moveHistory;

        // Check if game ended
        if ((gameObj as any).isFinished) {
          game.status = 'finished';
          game.endedAt = Date.now();
          game.winner = (gameObj as any).winner;

          // Award berries if there's a winner
          if (game.winner) {
            const winnerPayload = socketPayloads.get(game.winner);
            if (winnerPayload) {
              winnerPayload.berries = clamp(winnerPayload.berries + GAME_WIN_REWARD);
              const winnerSocket = io.sockets.sockets.get(game.winner);
              if (winnerSocket) {
                winnerSocket.emit('berriesUpdate', {
                  token: signToken(winnerPayload),
                  berries: winnerPayload.berries,
                });
              }
            }
          }

          // Notify both players
          const gameState = {
            gameId,
            gameType: game.gameType,
            state: gameObj.getGameState(),
            isFinished: true,
            winner: game.winner,
            reward: game.winner ? GAME_WIN_REWARD : 0,
            message: game.winner ? '🎉 Game over!' : '🤝 Game ended in a draw!',
          };

          callback({ status: 'success', gameState });

          const partnerId = game.players.find((id) => id !== socket.id);
          const partnerSocket = partnerId ? io.sockets.sockets.get(partnerId) : null;

          socket.emit('gameEnded', gameState);
          if (partnerSocket) {
            partnerSocket.emit('gameEnded', gameState);
          }

          removeGame(gameId);

          console.log(`✅ Game ended: ${gameId} - Winner: ${game.winner || 'draw'}`);
        } else {
          // Game still in progress, send state update
          const gameState = {
            gameId,
            gameType: game.gameType,
            state: gameObj.getGameState(),
            currentPlayer: gameObj.getCurrentPlayerTurn(),
          };

          callback({ status: 'success', gameState });

          // Broadcast to both players
          const partnerId = game.players.find((id) => id !== socket.id);
          const partnerSocket = partnerId ? io.sockets.sockets.get(partnerId) : null;

          if (partnerSocket) {
            partnerSocket.emit('gameStateUpdate', gameState);
          }
          socket.emit('gameStateUpdate', gameState);
        }
      } catch (error) {
        console.error(`Game error in ${gameId}:`, error);
        callback({ status: 'error', msg: 'Game error occurred.' });
      }
    }
  );

  // ── quitGame ───────────────────────────────────────────────────────────
  socket.on('quitGame', ({ gameId }: { gameId: string }) => {
    const game = activeGames.get(gameId);
    if (!game) return socket.emit('error', { msg: 'Game not found.' });

    if (!game.players.includes(socket.id)) {
      return socket.emit('error', { msg: 'You are not a player in this game.' });
    }

    // Determine winner (the other player)
    const winnerId = game.players.find((id) => id !== socket.id);
    game.winner = winnerId || null;
    game.status = 'finished';
    game.endedAt = Date.now();

    const gameState = {
      gameId,
      gameType: game.gameType,
      state: game.state,
      isFinished: true,
      winner: winnerId,
      reward: winnerId ? GAME_WIN_REWARD : 0,
      message: 'Game ended due to player quitting.',
    };

    // Award berries to winner
    if (winnerId) {
      const winnerPayload = socketPayloads.get(winnerId);
      if (winnerPayload) {
        winnerPayload.berries = clamp(winnerPayload.berries + GAME_WIN_REWARD);
        const winnerSocket = io.sockets.sockets.get(winnerId);
        if (winnerSocket) {
          winnerSocket.emit('berriesUpdate', {
            token: signToken(winnerPayload),
            berries: winnerPayload.berries,
          });
          winnerSocket.emit('info', { msg: '🎉 Opponent quit! You win +10 berries!' });
          winnerSocket.emit('gameEnded', gameState);
        }
      }
    }

    socket.emit('info', { msg: 'You quit the game.' });
    socket.emit('gameEnded', gameState);

    removeGame(gameId);
    console.log(`⛔ Game quit: ${gameId}`);
  });
}
