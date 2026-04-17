<script lang="ts">
  import emojisData from '$lib/emoji-set.json';
  interface EmojiCategory {
    icon: string;
    name: string;
    emojis: string[];
  }

  interface EmojiPickerProps {
    isOpen?: boolean;
    onEmojiSelect?: (emoji: string) => void;
    onClose?: () => void;
  }

  const { isOpen = false, onEmojiSelect, onClose }: EmojiPickerProps = $props();

  let activeCategory = $state('recent');
  let recentEmojis = $state<string[]>([]);

  const emojiCategories: Record<string, EmojiCategory> = emojisData;

  function handleEmojiClick(emoji: string) {
    onEmojiSelect?.(emoji);
    // Add to recent emojis
    recentEmojis = [emoji, ...recentEmojis.filter((e) => e !== emoji)].slice(0, 24);
    onClose?.();
  }
</script>

{#if isOpen}
  <div
    aria-label="emoji picker"
    class="absolute bottom-[58px] left-3 z-40 bg-gradient-to-br from-[#2C352B] to-[#1a1f1a] border border-white/[.1] rounded-xl shadow-lg p-3 w-96 flex flex-col animate-popin"
  >
    <div class="text-xs text-muted font-bold uppercase tracking-widest px-1 py-1 mb-2">
      😁 Pick an emoji
    </div>

    <!-- Category Tabs -->
    <div class="flex gap-1 mb-3 pb-2 border-b border-white/[.1] overflow-x-auto">
      {#each Object.entries(emojiCategories) as [key, category]}
        <button
          onclick={() => {
            activeCategory = key;
          }}
          class="flex-shrink-0 text-xl px-2 py-1 rounded-lg transition-all {activeCategory === key
            ? 'bg-[rgba(124,58,237,.3)] border border-berry-lt/40'
            : 'hover:bg-[rgba(124,58,237,.1)]'}"
          title={category.name}
        >
          {category.icon}
        </button>
      {/each}
    </div>

    <!-- Emoji Grid -->
    <div class="h-56 overflow-y-auto">
      <div class="grid grid-cols-6 gap-2">
        {#each activeCategory === 'recent' ? recentEmojis : emojiCategories[activeCategory].emojis as emoji}
          <button
            onclick={() => handleEmojiClick(emoji)}
            class="w-10 h-10 flex items-center justify-center text-xl rounded-lg border border-white/[.08] bg-[rgba(124,58,237,.08)] hover:bg-[rgba(124,58,237,.15)] hover:border-berry-lt/40 transition-all duration-200 hover:scale-110"
            title={emoji}
          >
            {emoji}
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  :global(.text-muted) {
    color: rgba(255, 255, 255, 0.5);
  }
</style>
