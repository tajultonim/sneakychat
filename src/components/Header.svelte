<script lang="ts">
  import foxIcon from "../assets/icon/fox.png";

  export let isConnected: boolean = false;
  export let hidden: boolean = false;
</script>

{#if !hidden}
  <div class="text-center mb-3.5">
    <div
      class="font-fredoka text-[2rem] text-fox tracking-wide drop-shadow-[0_2px_12px_rgba(255,107,53,.4)] flex items-center justify-center gap-2"
    >
      <img src={foxIcon} alt="Fox" class="w-8 h-8 object-contain" /> SneakyChat
    </div>
    <div
      class="text-leaf text-[.78rem] font-bold tracking-widest uppercase mt-0.5 flex items-center justify-center gap-2"
    >
      <span
        class="inline-block w-[7px] h-[7px] rounded-full {isConnected
          ? 'bg-[#22C55E] shadow-[0_0_6px_#22C55E]'
          : 'bg-[#EF4444] shadow-[0_0_6px_#EF4444]'}"
      ></span>
      Anonymous Fox Chat
    </div>
  </div>
{/if}
