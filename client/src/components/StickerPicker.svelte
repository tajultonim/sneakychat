<script lang="ts">
  import { stickerStore } from '../stores/stickerStore';
  import { berries } from '../stores/gameStore';

  interface StickerPickerProps {
    onSelect?: (stickerId: string) => void;
    disabled?: boolean;
  }

  const { onSelect, disabled = false }: StickerPickerProps = $props();

  const stickers = stickerStore.getStickers();
  const STICKER_COST = 2;

  function handleStickerClick(stickerId: string) {
    if ($berries >= STICKER_COST && !disabled) {
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
  <div class="text-xs text-muted font-bold uppercase tracking-widest px-1 py-1 mb-2">
    🎨 Stickers (2🍇 each)
  </div>

  <!-- Stickers Grid -->
  <div class="grid grid-cols-3 gap-2 overflow-y-auto max-h-[280px] px-1">
    {#each stickers as sticker (sticker.id)}
      <button
        disabled={!canAfford(sticker.cost)}
        onclick={() => handleStickerClick(sticker.id)}
        class={`relative group w-20 h-20 rounded-lg border border-white/[.08] flex items-center justify-center transition-all duration-200 overflow-hidden
          ${
            canAfford(sticker.cost)
              ? 'bg-[rgba(124,58,237,.1)] hover:bg-[rgba(124,58,237,.2)] hover:scale-105 cursor-pointer hover:border-berry-lt/40'
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
          }}
        />

        <!-- Fallback Emoji if image missing -->
        <div class={`absolute text-2xl ${sticker.type === 'animated' ? 'animate-bobble' : ''}`}>
          {sticker.premium ? '🔒' : '✨'}
        </div>

        <!-- Cost Badge -->
        <div
          class="absolute bottom-0 right-0 bg-berry text-white text-[0.65rem] font-bold px-1 py-0.5 rounded-tl-md opacity-0 group-hover:opacity-100 transition-opacity"
        >
          2🍇
        </div>

        <!-- Disabled Lock Overlay -->
        {#if !canAfford(sticker.cost)}
          <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span class="text-red-400 text-lg">🔒</span>
          </div>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Insufficient Berries Message -->
  {#if $berries < STICKER_COST}
    <div class="mt-2 px-1 py-1 text-[0.7rem] text-red-400/80 text-center font-bold">
      Need 2 more 🍇 to send stickers!
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
