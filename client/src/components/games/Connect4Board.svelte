<script lang="ts">
  import { socket } from '$lib/socket';
  import { activeGame, gameNames } from '$stores/gameStore';
  import { myuserId } from '$stores/userStore';

  let gameState: any = null;

  $: if ($activeGame && $activeGame.gameType === 'connect4') {
    gameState = $activeGame.state;
  }

  $: isPlayer1 = $activeGame?.players[0] === $myuserId;

  function handleColumnClick(col: number) {
    if (!$activeGame || $activeGame.gameType !== 'connect4') return;
    if ($activeGame.isFinished) return;

    socket.emit('makeGameMove', { gameId: $activeGame.gameId, move: col }, (response: any) => {
      if (response?.status === 'error') {
        console.error('Move error:', response.msg);
      }
    });
  }

  function getPiece(cell: any): string {
    if (cell === 'X') return '🔴';
    if (cell === 'O') return '🟡';
    return '';
  }

  function isCurrentPlayer(): boolean {
    if (!$activeGame || !gameState) return false;
    return gameState.currentPlayer === $activeGame.players[0];
  }
</script>

<div class="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
  <div class="w-full">
    {#if gameState && $activeGame}
      <!-- Status section -->
      <div
        class="w-full mb-2 rounded-xl border border-white/[0.12] bg-gradient-to-r from-white/[0.07] to-cyan-500/[0.06] p-4 text-center"
      >
        {#if $activeGame.isFinished}
          <div>
            {#if $activeGame.winner}
              <p class="text-lg font-bold text-[#FFE1C7] mb-2 animate-bounce">🎉 Game Over!</p>
              <p class="text-[#D4DCCF]">
                {$activeGame.winner === $activeGame.players[0] && isPlayer1
                  ? '🔴 You won!'
                  : $activeGame.winner === $activeGame.players[1] && !isPlayer1
                    ? '🟡 You won!'
                    : '🔴 They won!'}
              </p>
            {:else}
              <p class="text-lg font-bold text-[#FFE1C7] mb-2">🤝 It's a Draw!</p>
              <p class="text-[#D4DCCF]">The board is full.</p>
            {/if}
          </div>
        {:else}
          <div>
            <p class="text-xs uppercase tracking-wider text-white/50 mb-2">Current Turn</p>
            <div class="flex items-center justify-center gap-2">
              <span
                class="text-3xl transition-transform duration-300"
                class:animate-pulse={isCurrentPlayer()}
              >
                {gameState.currentPlayer === $activeGame.players[0] ? '🔴' : '🟡'}
              </span>
              <span class="text-sm text-white/80 font-semibold">
                {isPlayer1
                  ? gameState.currentPlayer === $activeGame.players[0]
                    ? 'You'
                    : 'Them'
                  : gameState.currentPlayer === $activeGame.players[1]
                    ? 'You'
                    : 'Them'}
              </span>
            </div>
          </div>
        {/if}
      </div>
      <!-- Game board -->
      <div
        class="rounded-2xl border border-white/[0.14] bg-[linear-gradient(165deg,rgba(35,50,35,0.9),rgba(16,22,16,0.95))] shadow-[0_20px_50px_rgba(0,0,0,0.45)] p-4"
      >
        <!-- Column selector -->
        <div class="flex gap-2 justify-center mb-2">
          {#each Array(7) as _, col}
            <button
              on:click={() => handleColumnClick(col)}
              class="w-12 h-12 rounded-lg font-bold transition-all transform text-xl
                {$activeGame.isFinished
                ? 'bg-white/[0.06] text-white/30 cursor-not-allowed'
                : 'bg-gradient-to-b from-[#FFB366] to-[#FF8C42] text-white hover:from-[#FFC47F] hover:to-[#FFA855] hover:shadow-[0_6px_16px_rgba(255,160,90,0.5)] hover:scale-110 active:scale-95'}"
              disabled={$activeGame.isFinished}
              aria-label={`Drop piece in column ${col + 1}`}
            >
              ↓
            </button>
          {/each}
        </div>

        <!-- Game board grid -->
        <div class="flex justify-center">
          <div
            class="bg-gradient-to-br -mb-2 from-[#0f3a2f] to-[#051f17] rounded-2xl p-4 pb-0 border border-white/[0.15] shadow-2xl"
          >
            {#each gameState.board as row}
              <div class="flex gap-3 mb-3">
                {#each row as cell}
                  <div
                    class="w-8 h-8 bg-gradient-to-br from-[#1a5a4a] to-[#0f3a2a] rounded-full flex items-center justify-center text-3xl border-2 border-white/[0.25] shadow-lg"
                  >
                    {getPiece(cell)}
                  </div>
                {/each}
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.15);
    }
  }

  :global(.animate-pulse) {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
</style>
