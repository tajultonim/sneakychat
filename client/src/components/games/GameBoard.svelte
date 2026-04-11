<script lang="ts">
  import { onDestroy } from 'svelte';
  import { activeGame, gameNames, gameSize } from '$stores/gameStore';
  import { socket } from '$lib/socket';
  import { toastStore } from '$stores/toastStore';
  import TicTacToeBoard from './TicTacToeBoard.svelte';
  import Connect4Board from './Connect4Board.svelte';
  import DotsAndBoxesBoard from './DotsAndBoxesBoard.svelte';
  import RockPaperScissorsGame from './RockPaperScissorsGame.svelte';
  import Icon from '@iconify/svelte';

  let gameType: string | null = null;
  let gameId: string | null = null;

  const gameEmojis: Record<string, string> = {
    tictactoe: '❎',
    connect4: '🟡',
    dotsAndBoxes: '🧩',
    rockPaperScissors: '✌️',
  };

  const unsubscribe = activeGame.subscribe((game) => {
    gameType = game?.gameType || null;
    gameId = game?.gameId || null;
  });

  function handleQuitGame(): void {
    if (!gameId) return;
    socket.emit('quitGame', { gameId });
    activeGame.set(null);
    gameSize.set('normal');
    toastStore.add('You left the game.');
  }

  function handleCloseGame(): void {
    activeGame.set(null);
    gameSize.set('normal');
    toastStore.add('Game closed.');
  }

  function handleRestartGame(): void {
    if (!gameType) return;
    toastStore.add('Proposing a new game...');
    socket.emit('proposeGame', { gameType });
  }

  onDestroy(() => {
    unsubscribe();
  });
</script>

{#if gameType}
  {#if $gameSize === 'minimized'}
    <!-- Minimized View -->
    <div
      class="fixed bottom-[70px] right-4 z-30 bg-gradient-to-br from-purple-900/80 to-purple-950/80 border border-purple-400/30 rounded-lg px-3 py-2 cursor-pointer hover:border-purple-400/60 transition shadow-lg"
      on:click={() => gameSize.set('normal')}
      role="button"
      tabindex="0"
      on:keydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          gameSize.set('normal');
        }
      }}
    >
      <div class="flex items-center gap-2">
        <span class="text-lg">{gameEmojis[$activeGame.gameType] || '🎮'}</span>
        <div class="flex flex-col">
          <span class="text-xs font-bold text-purple-100">{gameNames[$activeGame.gameType]}</span>
          <span class="text-[0.65rem] text-purple-200/60">Click to expand</span>
        </div>
      </div>
    </div>
  {:else if $gameSize == 'normal' || $gameSize == 'maximized'}
    <section
      class="rounded-2xl border border-white/[0.12] bg-[radial-gradient(circle_at_top_left,rgba(255,180,120,0.18),transparent_45%),linear-gradient(145deg,rgba(22,30,22,0.95),rgba(12,16,12,0.95))] shadow-[0_12px_30px_rgba(0,0,0,0.35)] px-3 py-3 sm:px-4 sm:py-4"
    >
      <div class="flex items-center justify-between gap-3 mb-3">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-xl leading-none">{gameEmojis[gameType] || '🎮'}</span>
          <div class="min-w-0">
            <p class="text-[0.7rem] uppercase tracking-[0.12em] text-white/45">Now Playing</p>
            <h3 class="text-[0.95rem] sm:text-[1rem] font-bold text-cream truncate">
              {gameNames[gameType]}
            </h3>
          </div>
        </div>

        {#if !$activeGame.isFinished}
          <div class="flex gap-2">
            {#if $gameSize !== 'maximized'}
              <button
                class="p-2 text-white/70 hover:text-white hover:bg-purple-500/20 rounded-lg transition"
                on:click={() => gameSize.set('maximized')}
                aria-label="Maximize game"
                title="Maximize game"
              >
                <Icon icon="mdi:window-maximize" width="20" height="20" />
              </button>
            {/if}
            <button
              class="p-2 text-white/70 hover:text-white hover:bg-purple-500/20 rounded-lg transition"
              on:click={() => {
                gameSize.set(($gameSize as any) === 'maximized' ? 'normal' : 'minimized');
              }}
              aria-label="Minimize game"
              title="Minimize game"
            >
              <Icon icon="mdi:window-minimize" width="20" height="20" />
            </button>
            <button
              class="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-full border border-red-300/35 text-red-200 bg-red-500/10 hover:bg-red-500/20 transition whitespace-nowrap"
              on:click={handleQuitGame}
              aria-label="Exit current game"
            >
              Exit Game
            </button>
          </div>
        {:else}
          <div class="flex gap-2">
            {#if $gameSize !== 'maximized'}
              <button
                class="p-2 text-white/70 hover:text-white hover:bg-purple-500/20 rounded-lg transition"
                on:click={() => gameSize.set('maximized')}
                aria-label="Maximize game"
                title="Maximize game"
              >
                <Icon icon="mdi:window-maximize" width="20" height="20" />
              </button>
            {/if}
            <button
              class="p-2 text-white/70 hover:text-white hover:bg-purple-500/20 rounded-lg transition"
              on:click={() =>
                gameSize.set(($gameSize as any) === 'minimized' ? 'normal' : 'minimized')}
              aria-label="Minimize game"
              title="Minimize game"
            >
              <Icon icon="mdi:window-minimize" width="20" height="20" />
            </button>
            <button
              class="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-full border border-emerald-300/35 text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 transition"
              on:click={handleRestartGame}
              aria-label="Restart game"
            >
              Restart
            </button>
            <button
              class="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-full border border-red-300/35 text-red-200 bg-red-500/10 hover:bg-red-500/20 transition"
              on:click={handleCloseGame}
              aria-label="Close game"
            >
              Close
            </button>
          </div>
        {/if}
      </div>

      <div
        class={`rounded-xl border border-white/[0.08] bg-black/25 p-2 sm:p-3 ${$activeGame?.isFinished ? 'pointer-events-none' : ''}`}
      >
        {#if gameType === 'tictactoe'}
          <TicTacToeBoard />
        {:else if gameType === 'connect4'}
          <Connect4Board />
        {:else if gameType === 'dotsAndBoxes'}
          <DotsAndBoxesBoard />
        {:else if gameType === 'rockPaperScissors'}
          <RockPaperScissorsGame />
        {/if}
      </div>
    </section>
  {/if}{/if}

<style>
</style>
