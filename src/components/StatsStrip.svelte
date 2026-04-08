<script lang="ts">
  import { berries, berryFillPct } from "../stores/gameStore.ts";
  import foxIcon from "../assets/icon/fox.png";

  export let onlineCount: number = 1;
  export let hidden: boolean = false;
</script>

{#if !hidden}
  <div class="flex gap-2 mb-3">
    <!-- Online pill -->
    <div
      class="flex-1 flex items-center gap-2 bg-white/[.04] border border-white/[.08] rounded-full px-3.5 py-[7px] backdrop-blur-sm"
    >
      <img src={foxIcon} alt="Fox" class="w-5 h-5 object-contain" />
      <div>
        <div class="font-fredoka text-[1.3rem] leading-none text-leaf-lt">
          {onlineCount}
        </div>
        <div
          class="text-[.68rem] text-muted font-bold uppercase tracking-[.04em]"
        >
          Online
        </div>
      </div>
    </div>

    <!-- Berry pill -->
    <div
      class="flex-[2] flex items-center gap-2 bg-white/[.04] border border-white/[.08] rounded-full px-3.5 py-[7px] backdrop-blur-sm"
    >
      <span class="text-xl leading-none">🍇</span>
      <div>
        <div class="font-fredoka text-[1.3rem] leading-none text-berry-lt">
          {$berries}
        </div>
        <div
          class="text-[.68rem] text-muted font-bold uppercase tracking-[.04em]"
        >
          Berries
        </div>
      </div>
      <!-- Progress bar -->
      <div
        class="flex-[1.5] h-[7px] bg-white/[.08] rounded self-center overflow-hidden"
      >
        <div
          class="h-full bg-gradient-to-r from-berry to-berry-lt rounded transition-[width] duration-500"
          style="width:{$berryFillPct}%"
        ></div>
      </div>
    </div>
  </div>
{/if}
