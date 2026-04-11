<script lang="ts">
  import { socket } from '$lib/socket';
  import { activeGame, gameNames } from '$stores/gameStore';

  let gameState: any = null;
  let boardSpan = 0;

  $: if ($activeGame && $activeGame.gameType === 'dotsAndBoxes') {
    gameState = $activeGame.state;
  }

  $: {
    const rawGridSize = Number(gameState?.gridSize);
    const safeGridSize =
      Number.isFinite(rawGridSize) && rawGridSize >= 2 ? Math.floor(rawGridSize) : 0;
    boardSpan = safeGridSize > 0 ? safeGridSize * 2 - 1 : 0;
  }

  $: isPlayer1 = $activeGame?.players[0] === socket.id;

  function handleLineClick(type: 'horizontal' | 'vertical', row: number, col: number) {
    if (!$activeGame || $activeGame.gameType !== 'dotsAndBoxes') return;
    if ($activeGame.isFinished) return;

    socket.emit(
      'makeGameMove',
      { gameId: $activeGame.gameId, move: { type, row, col } },
      (response: any) => {
        if (response?.status === 'error') {
          console.error('Move error:', response.msg);
        }
      }
    );
  }

  function getBoxOwner(row: number, col: number): string {
    const box = gameState?.boxes?.[row]?.[col];
    if (box === $activeGame?.players[0]) return '🔴';
    if (box === $activeGame?.players[1]) return '🟡';
    return '';
  }

  function canClickHorizontal(row: number, col: number): boolean {
    if (!gameState) return false;
    return !gameState.horizontalLines?.[row]?.[col];
  }

  function canClickVertical(row: number, col: number): boolean {
    if (!gameState) return false;
    return !gameState.verticalLines?.[row]?.[col];
  }

  function isCurrentPlayer(): boolean {
    if (!$activeGame || !gameState) return false;
    return gameState.currentPlayer === $activeGame.players[0];
  }
</script>

<div class="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto">
  <div class="w-full">
    {#if gameState}
      <div
        class="rounded-2xl border border-white/[0.14] bg-[linear-gradient(165deg,rgba(35,50,35,0.9),rgba(16,22,16,0.95))] shadow-[0_20px_50px_rgba(0,0,0,0.45)] p-4"
      >
        <!-- Scores section -->
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div
            class="rounded-xl border transition-all duration-200 p-5 text-center {$activeGame?.currentPlayer ===
              $activeGame.players[0] && isPlayer1
              ? 'border-[#FFB366] bg-gradient-to-br from-[#FFB366]/20 to-[#FF8C42]/10 ring-2 ring-[#FFB366]/50'
              : $activeGame?.currentPlayer === $activeGame.players[1] && !isPlayer1
                ? 'border-[#FFB366] bg-gradient-to-br from-[#FFB366]/20 to-[#FF8C42]/10 ring-2 ring-[#FFB366]/50'
                : 'border-white/[0.12] bg-white/[0.05]'}"
          >
            <p class="text-xs uppercase tracking-widest text-white/60 mb-2">You</p>
            <p class="text-3xl font-bold text-[#FFE1C7]">
              {$activeGame.players[0] == socket.id ? '🔴' : '🟡'}
              {gameState.scores?.[
                $activeGame?.players[0] == socket.id
                  ? $activeGame?.players[0]
                  : $activeGame?.players[1] == socket.id
                    ? $activeGame?.players[1]
                    : null
              ] || 0}
            </p>
          </div>
          <div
            class="rounded-xl border transition-all duration-200 p-5 text-center {$activeGame?.currentPlayer ===
              $activeGame.players[0] && !isPlayer1
              ? 'border-[#FFB366] bg-gradient-to-br from-[#FFB366]/20 to-[#FF8C42]/10 ring-2 ring-[#FFB366]/50'
              : $activeGame?.currentPlayer === $activeGame.players[1] && isPlayer1
                ? 'border-[#FFB366] bg-gradient-to-br from-[#FFB366]/20 to-[#FF8C42]/10 ring-2 ring-[#FFB366]/50'
                : 'border-white/[0.12] bg-white/[0.05]'}"
          >
            <p class="text-xs uppercase tracking-widest text-white/60 mb-2">Them</p>
            <p class="text-3xl font-bold text-[#FFE1C7]">
              {$activeGame.players[1] == socket.id ? '🔴' : '🟡'}{gameState.scores?.[
                $activeGame?.players[0] == socket.id
                  ? $activeGame?.players[1]
                  : $activeGame?.players[1] == socket.id
                    ? $activeGame?.players[0]
                    : null
              ] || 0}
            </p>
          </div>
        </div>

        <!-- Status -->{#if $activeGame.isFinished}
          <div class="rounded-lg border border-white/[0.12] bg-white/[0.05] p-4 text-center">
            <div>
              {#if $activeGame.winner}
                <p class="text-lg font-bold text-[#FFE1C7] mb-1 animate-bounce">🎉 Game Over!</p>
                <p class="text-[#D4DCCF]">
                  {$activeGame.winner === $activeGame.players[0] && isPlayer1
                    ? 'You won!'
                    : $activeGame.winner === $activeGame.players[1] && !isPlayer1
                      ? 'You won!'
                      : 'They won!'}
                </p>
              {:else}
                <p class="text-lg font-bold text-[#FFE1C7] mb-1">🤝 It's a Draw!</p>
                <p class="text-[#D4DCCF]">Both players scored equally</p>
              {/if}
            </div>
            <!-- {:else}
            <div>
              <p class="text-xs uppercase tracking-widest text-white/50 mb-2">Current Turn</p>
              <p class="text-sm text-white/80 font-semibold">
                <span
                  class="text-2xl ml-1 transition-transform duration-300"
                  class:animate-pulse={isCurrentPlayer()}
                >
                  {gameState.currentPlayer === $activeGame?.players[0]
                    ? '🔴 Player 1'
                    : '🟡 Player 2'}
                </span>
              </p>
            </div> -->
          </div>{/if}

        <!-- Game board -->
        <div class="flex justify-center">
          <div
            class="inline-block bg-gradient-to-br from-[#0f3a2f]/60 to-[#051f17]/60 rounded-2xl p-5 border border-white/[0.15] shadow-2xl"
          >
            <div class="grid gap-0" style="grid-template-columns: repeat({boardSpan}, auto);">
              {#each Array(boardSpan) as _, row}
                {#each Array(boardSpan) as _, col}
                  {#if row % 2 === 0 && col % 2 === 0}
                    <!-- Dot -->
                    <div
                      class="w-3 h-3 bg-gradient-to-br from-[#FFB366] to-[#FF8C42] rounded-full shadow-lg"
                    ></div>
                  {:else if row % 2 === 0 && col % 2 === 1}
                    <!-- Horizontal line -->
                    <button
                      on:click={() => handleLineClick('horizontal', row / 2, col / 2 - 0.5)}
                      aria-label={`Place horizontal line at row ${row / 2}, col ${col / 2 - 0.5}`}
                      class="w-10 h-1 translate-y-[4px] transition-all duration-200 {!gameState
                        .horizontalLines?.[row / 2]?.[col / 2 - 0.5]
                        ? 'bg-white/[0.3] hover:border-[#FFB366] cursor-pointer hover:shadow-[0_0_10px_rgba(255,179,102,0.6)] hover:scale-110'
                        : 'bg-[#1FA14D] cursor-not-allowed'}"
                      disabled={gameState.horizontalLines?.[row / 2]?.[col / 2 - 0.5]}
                    >
                    </button>
                  {:else if row % 2 === 1 && col % 2 === 0}
                    <!-- Vertical line -->
                    <button
                      on:click={() => handleLineClick('vertical', row / 2 - 0.5, col / 2)}
                      aria-label={`Place vertical line at row ${row / 2 - 0.5}, col ${col / 2}`}
                      class="w-1 h-10 translate-x-[4px] transition-all duration-200 {!gameState
                        .verticalLines?.[row / 2 - 0.5]?.[col / 2]
                        ? 'bg-white/[0.3] hover:border-[#FFB366] cursor-pointer hover:shadow-[0_0_10px_rgba(255,179,102,0.6)] hover:scale-110'
                        : 'bg-[#1FA14D] cursor-not-allowed'}"
                      disabled={gameState.verticalLines?.[row / 2 - 0.5]?.[col / 2]}
                    >
                    </button>
                  {:else}
                    <!-- Box center -->
                    <div
                      class="w-10 h-10 flex items-center justify-center text-2xl font-bold {getBoxOwner(
                        row / 2 - 0.5,
                        col / 2 - 0.5
                      )
                        ? 'bg-white/[0.08] rounded-lg'
                        : ''}"
                    >
                      {gameState?.boxes?.[row / 2 - 0.5]?.[col / 2 - 0.5] == $activeGame?.players[0]
                        ? '🔴'
                        : gameState?.boxes?.[row / 2 - 0.5]?.[col / 2 - 0.5] ==
                            $activeGame?.players[1]
                          ? '🟡'
                          : ''}
                    </div>
                  {/if}
                {/each}
              {/each}
            </div>
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
