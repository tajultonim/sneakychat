<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { toastStore } from '../stores/toastStore.ts';
</script>

<div class="fixed bottom-20 left-1/2 -translate-x-1/2 z-[999] flex flex-col gap-[7px] items-center pointer-events-none">
  {#each $toastStore as t (t.id)}
    <div
      class="bg-[rgba(15,26,15,.94)] border border-white/[.1] rounded-full px-5 py-[9px] text-cream text-[.83rem] font-semibold backdrop-blur-xl max-w-[310px] text-center shadow-[0_4px_20px_rgba(0,0,0,.4)]"
      in:fly={{ y: 20, duration: 300 }}
      out:fade={{ duration: 300 }}
    >
      {t.msg}
    </div>
  {/each}
</div>
