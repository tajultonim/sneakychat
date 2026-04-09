<script lang="ts">
  import { cooldownLabel, cooldownEnds } from '../stores/cooldownStore.ts';

  $: visible = $cooldownEnds > Date.now();
</script>

{#if visible}
  <div class="flex items-center justify-center gap-1.5 bg-[rgba(201,75,18,.15)] border border-[rgba(201,75,18,.3)] rounded-full px-3.5 py-[5px] mb-2.5 text-[#FF9A6C] text-[.8rem] font-bold">
    ⏳ Next fox in
    <span class="font-fredoka text-base">{$cooldownLabel}</span>
  </div>
{/if}
