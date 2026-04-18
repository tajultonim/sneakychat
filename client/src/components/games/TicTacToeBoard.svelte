<script lang="ts">
  import { socket } from '$lib/socket';
  import { activeGame, gameNames } from '$stores/gameStore';
  import { toastStore } from '$stores/toastStore';
  import { myuserId } from '$stores/userStore';

  let gameState: any = null;

  $: if ($activeGame && $activeGame.gameType === 'tictactoe') {
    gameState = $activeGame.state;
  }

  function handleCellClick(index: number) {
    if (!$activeGame || $activeGame.gameType !== 'tictactoe') return;
    if (gameState.isFinished) return;

    socket.emit('makeGameMove', { gameId: $activeGame.gameId, move: index }, (response: any) => {
      if (response?.status === 'error') {
        console.error('Move error:', response.msg);
        toastStore.add(response.msg);
      }
    });
  }

  function getSymbol(index: number): string {
    const cell = gameState?.board[index];
    if (cell === 'X') return '❌';
    if (cell === 'O') return '⭕';
    return '';
  }

  function getCellClass(index: number, gameState: any): string {
    const cell = gameState?.board[index];
    let baseClass =
      'w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center text-4xl sm:text-5xl font-bold cursor-pointer transition-all duration-200 border border-white/20';

    if (cell) {
      baseClass += ' cursor-not-allowed bg-gradient-to-br from-white/5 to-white/[0.02]';
    } else if (gameState?.isFinished) {
      baseClass += ' cursor-not-allowed';
    } else {
      baseClass +=
        ' cursor-pointer hover:bg-white/10 hover:shadow-lg hover:shadow-cyan-500/20 active:scale-95';
    }

    return baseClass;
  }

  let isMyTurn = false;
  $: if (gameState && $activeGame) {
    // TODO: Compare gameState.currentPlayer with userId from socket
    isMyTurn = gameState.currentPlayer === $myuserId;
  }
</script>

<div class="flex flex-col items-center gap-2 text-white">
  {#if gameState && $activeGame}
    <!-- Status Area -->
    <div class="flex flex-col items-center gap-3 w-full">
      {#if gameState.isFinished}
        <div class="w-full text-center">
          {#if gameState.winner}
            {#if gameState.winner === $myuserId}
              <div class="animate-bounce">
                <p class="text-xl mt-2 sm:text-2xl font-bold text-white mb-1">🎉 You won!</p>
                <p class="text-xs sm:text-sm text-white/60">Victory!</p>
              </div>
            {:else}
              <div class="animate-opacity">
                <p class="text-xl mt-2 sm:text-2xl font-bold text-white mb-1">😢 You lost!</p>
                <p class="text-xs sm:text-sm text-white/60">Better luck next time!</p>
              </div>
            {/if}
          {:else}
            <div class="animate-opacity">
              <p class="text-xl sm:text-2xl font-bold text-amber-300 mb-1">🤝 It's a draw!</p>
              <p class="text-xs sm:text-sm text-white/60">Well played!</p>
            </div>
          {/if}
        </div>
      {:else}
        <div
          class="w-full bg-gradient-to-r from-white/5 to-cyan-500/10 border border-cyan-500/20 rounded-lg px-4 py-3 text-center"
        >
          <p class="text-xs uppercase tracking-wider text-white/50 mb-1">
            You are playing as: <span class="text-white"
              >{$activeGame.players[0] == $myuserId ? '❌' : '⭕'}</span
            >
          </p>
          <p class="text-xs uppercase tracking-wider text-white/50 mb-1">Current Turn</p>
          <p class="text-lg font-bold">
            <span class="text-2xl mr-2"
              >{gameState.currentPlayer === $activeGame.players[0] ? '❌' : '⭕'}</span
            >
          </p>
        </div>
      {/if}
    </div>

    <!-- Game Board -->
    <div
      class="relative w-full p-4 rounded-2xl bg-gradient-to-br from-black/40 via-black/60 to-black/40 border border-cyan-500/30"
    >
      <div class="grid grid-cols-3 gap-2 bg-black/50 p-3 rounded-lg">
        {#each Array(9) as _, i}
          <button
            on:click={() => handleCellClick(i)}
            class={getCellClass(i, gameState)}
            disabled={gameState.isFinished || gameState.board[i] !== null}
          >
            {gameState.board[i]}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
