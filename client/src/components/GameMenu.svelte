<script lang="ts">
  import { availableGames, gameDescriptions, gameNames } from '../stores/gameStore.ts';
  import { onMount } from 'svelte';

  interface GameMenuProps {
    isOpen?: boolean;
    onSelect?: (gameType: string) => void;
    onClose?: () => void;
    triggerSelector?: string;
  }

  const {
    isOpen = false,
    onSelect,
    onClose,
    triggerSelector = '.game-menu-trigger',
  }: GameMenuProps = $props();

  let menuEl = $state<HTMLDivElement | null>(null);

  function handleGameSelect(gameType: string) {
    onSelect?.(gameType);
    onClose?.();
  }

  onMount(() => {
    const handleWindowClick = (event: MouseEvent) => {
      if (!isOpen) return;

      const target = event.target as HTMLElement | null;
      if (menuEl && !menuEl.contains(target) && !target?.closest(triggerSelector)) {
        onClose?.();
      }
    };

    window.addEventListener('click', handleWindowClick);

    return () => {
      window.removeEventListener('click', handleWindowClick);
    };
  });
</script>

{#if isOpen}
  <div
    bind:this={menuEl}
    class="absolute bottom-[58px] left-3 z-40 bg-gradient-to-br from-[#2C352B] to-[#1a1f1a] border border-white/[.1] rounded-xl shadow-lg p-3 min-w-[280px] animate-popin"
  >
    <div class="text-xs text-muted font-bold uppercase tracking-widest px-1 py-1 mb-2">
      🎮 Select a Game
    </div>
    <div class="grid grid-cols-2 gap-2">
      {#each $availableGames as gameType}
        <button
          onclick={() => handleGameSelect(gameType)}
          class="group relative px-3 py-3 rounded-lg border border-white/[.08] bg-[rgba(124,58,237,.08)] hover:bg-[rgba(124,58,237,.15)] hover:border-berry-lt/40 transition-all duration-200 flex flex-col items-center gap-2 text-center hover:scale-105"
        >
          <div class="text-2xl transition-transform group-hover:scale-110">
            {#if gameType === 'tictactoe'}
              ❎
            {:else if gameType === 'connect4'}
              🟡
            {:else if gameType === 'dotsAndBoxes'}
              🧩
            {:else if gameType === 'rockPaperScissors'}
              ✌️
            {/if}
          </div>
          <div class="flex flex-col gap-1 w-full">
            <div class="text-[0.75rem] font-bold text-cream group-hover:text-berry-lt transition">
              {gameNames[gameType]}
            </div>
            <div
              class="text-[0.6rem] text-muted/70 group-hover:text-white/50 transition line-clamp-2"
            >
              {gameDescriptions[gameType]}
            </div>
          </div>
        </button>
      {/each}
    </div>
  </div>
{/if}
