<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import animatedFox from "../assets/icon/animated-fox.webp";

  export let title: string = "Sneaking through the forest...";
  export let sub: string = "Looking for another fox to chat with";

  const dispatch = createEventDispatcher();
</script>

<div class="py-9 px-7 flex flex-col items-center text-center gap-3.5">
  <div class="w-20 h-20 drop-shadow-[0_4px_16px_rgba(255,107,53,.3)]">
    <img
      src={animatedFox}
      alt="Fox"
      class="w-full h-full object-contain"
    />
  </div>

  <div class="font-fredoka text-[1.2rem] text-cream">{title}</div>

  <!-- Dots -->
  <div class="flex">
    {#each [0, 200, 400] as delay}
      <span
        class="inline-block w-2 h-2 bg-berry-lt rounded-full mx-[3px] animate-dpulse"
        style="animation-delay:{delay}ms"
      ></span>
    {/each}
  </div>

  <div class="text-leaf text-[.82rem]">{sub}</div>

  <button
    class="mt-1 max-w-[160px] w-full py-2.5 bg-gradient-to-br from-[#16A34A] to-[#15803D] text-white
           rounded-xl font-fredoka text-[.95rem] shadow-[0_3px_14px_rgba(22,163,74,.3)]
           flex items-center justify-center gap-1.5
           transition-all hover:-translate-y-0.5 hover:brightness-110 active:scale-[.97]"
    on:click={() => dispatch("cancel")}
  >
    ✕ Give up
  </button>
</div>
