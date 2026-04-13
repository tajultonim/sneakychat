<script lang="ts">
  import { recentStickers, stickerStore } from '../stores/stickerStore';
  import { berries } from '../stores/gameStore';

  interface StickerPickerProps {
    onSelect?: (stickerId: string) => void;
    disabled?: boolean;
  }

  const { onSelect, disabled = false }: StickerPickerProps = $props();

  const stickers = stickerStore.getStickers();
  const packTabs = ['recent', ...Array.from(new Set(stickers.map((sticker) => sticker.pack)))];
  let activePack = $state('recent');

  function getPackLabel(pack: string): string {
    if (pack === 'recent') return 'Recent';
    return pack
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function getActiveStickers() {
    if (activePack === 'recent') return $recentStickers;
    return stickerStore.getStickersByPack(activePack);
  }

  function getTabStickerCount(pack: string): number {
    return pack === 'recent' ? $recentStickers.length : stickerStore.getStickersByPack(pack).length;
  }

  function getMinCost(stickerList: typeof stickers): number {
    if (!stickerList.length) return 0;
    const cheapestStickerCost = stickerList.reduce((minCost, sticker) => {
      return Math.min(minCost, sticker.cost);
    }, Number.POSITIVE_INFINITY);
    return Number.isFinite(cheapestStickerCost) ? cheapestStickerCost : 0;
  }

  function handleStickerClick(stickerId: string) {
    const sticker = stickerStore.getStickerById(stickerId);
    if (sticker && canAfford(sticker.cost)) {
      onSelect?.(stickerId);
    }
  }

  function getPreviewUrl(url: string): string {
    // Handle both static imports and path references
    if (url.startsWith('/')) {
      return url;
    }
    return url;
  }

  function canAfford(cost: number): boolean {
    return $berries >= cost && !disabled;
  }
</script>

<div
  aria-label="sticker picker"
  class="flex flex-col bg-[rgba(21,40,21,0.95)] border border-white/[.1] rounded-xl px-3 py-2 w-full max-w-[min(92vw,360px)] animate-popin"
>
  <!-- Header -->
  <div class="flex flex-col gap-2 px-1 py-1">
    <div class="flex items-center justify-between gap-2">
      <div class="text-xs text-muted font-bold uppercase tracking-widest">🎨 Stickers</div>
      <div class="text-[0.7rem] text-muted/70 font-semibold">
        {getActiveStickers().length} in {getPackLabel(activePack)}
      </div>
    </div>

    <div class="flex gap-2 overflow-x-auto pb-1 pr-1 whitespace-nowrap scrollbar-thin">
      {#each packTabs as pack}
        <button
          type="button"
          onclick={() => (activePack = pack)}
          class={`shrink-0 rounded-full px-3 py-1 text-[0.72rem] font-bold uppercase tracking-widest transition-all border ${
            activePack === pack
              ? 'bg-berry text-white border-berry shadow-[0_0_0_1px_rgba(255,255,255,.08)]'
              : 'bg-white/[.06] text-cream/70 border-white/[.08] hover:bg-white/[.1] hover:text-cream'
          }`}
        >
          {getPackLabel(pack)}
          <span class="ml-1 opacity-70">{getTabStickerCount(pack)}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Stickers Grid -->
  <div class="h-[256px] overflow-y-auto px-1 pt-1">
    <div class="grid grid-cols-3 gap-2 h-min">
      {#if getActiveStickers().length > 0}
        {#each getActiveStickers() as sticker (sticker.id)}
          <button
            disabled={!canAfford(sticker.cost)}
            onclick={() => handleStickerClick(sticker.id)}
            class={`s-${sticker.id} relative group w-20 h-20 rounded-lg border border-white/[.08] flex items-center justify-center transition-all duration-200 overflow-hidden
            ${
              canAfford(sticker.cost)
                ? 'bg-[rgba(124,58,237,.1)] disabled:cursor-not-allowed disabled:pointer-events-none hover:bg-[rgba(124,58,237,.2)] hover:scale-105 cursor-pointer hover:border-berry-lt/40'
                : 'bg-[rgba(0,0,0,.2)] cursor-not-allowed opacity-50'
            }`}
            title={sticker.name}
          >
            <!-- Sticker Image -->
            <img
              src={getPreviewUrl(sticker.url)}
              alt={sticker.name}
              class="w-full h-full object-contain p-1 group-hover:scale-110 transition-transform"
              onerror={(e) => {
                // Fallback for missing stickers
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = document.querySelector(`.f-${sticker.id}`) as HTMLDivElement;
                const stkr = document.querySelector(`.s-${sticker.id}`) as HTMLButtonElement;
                if (fallback) {
                  fallback.style.display = 'flex';
                }
                if (stkr) {
                  stkr.classList.add('bg-red-500/20', 'border-red-400/40');
                  stkr.disabled = true;
                }
              }}
            />

            <!-- Fallback Emoji if image missing -->
            <div
              class={`f-${sticker.id} hidden absolute text-2xl ${sticker.type === 'animated' ? 'animate-bobble' : ''}`}
            >
              {sticker.premium ? '🔒' : '✨'}
            </div>

            <!-- Cost Badge -->
            <div
              class="absolute bottom-0 right-0 bg-berry text-white text-[0.65rem] font-bold px-1 py-0.5 rounded-tl-md"
            >
              {sticker.cost}🍇
            </div>

            <!-- Disabled Lock Overlay -->
            {#if !canAfford(sticker.cost)}
              <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span class="text-red-400 text-lg">🔒</span>
              </div>
            {/if}
          </button>
        {/each}
      {:else}
        <div class="col-span-3 py-8 text-center text-sm text-muted/70">
          No stickers in this pack yet.
        </div>
      {/if}
    </div>
  </div>

  <!-- Insufficient Berries Message -->
  {#if $berries < getMinCost(getActiveStickers())}
    <div class="mt-2 px-1 py-1 text-[0.7rem] text-red-400/80 text-center font-bold">
      Need {getMinCost(getActiveStickers()) - $berries} more 🍇 for {getPackLabel(activePack)} stickers!
    </div>
  {/if}
</div>

<style>
  :global(.animate-bobble) {
    animation: bobble 3s ease-in-out infinite;
  }

  @keyframes bobble {
    0%,
    100% {
      transform: translateY(0) rotate(-2deg);
    }
    50% {
      transform: translateY(-4px) rotate(2deg);
    }
  }
</style>
