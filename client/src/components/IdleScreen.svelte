<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { cooldownEnds } from "../stores/cooldownStore.ts";
  import animatedFox from "../assets/icon/animated-fox.webp";

  const dispatch = createEventDispatcher();

  $: disabled = $cooldownEnds > Date.now();
</script>

<div class="p-5 flex flex-col gap-4">
  <!-- Hero row -->
  <div class="flex items-center gap-4">
    <div
      class="w-24 h-24 shrink-0 drop-shadow-[0_4px_16px_rgba(255,107,53,.35)]"
    >
      <img
        src={animatedFox}
        alt="Fox"
        class="w-full h-full object-contain animate-bobble"
      />
    </div>
    <div>
      <h2 class="font-fredoka text-[1.45rem] text-cream leading-tight">
        Ready to sneak around?
      </h2>
      <p class="text-leaf-lt text-[.83rem] mt-1 leading-relaxed">
        Find a Sneaky Fox to chat with! Chats auto-end after 2 min — extend
        together to keep going. Finish a chat to earn berries!
      </p>
    </div>
  </div>

  <!-- Find button -->
  <button
    class="w-full py-3 bg-gradient-to-br from-fox to-fox-dark text-white rounded-xl font-fredoka text-lg
           shadow-[0_4px_18px_rgba(255,107,53,.35)] flex items-center justify-center gap-2
           transition-all duration-150
           hover:-translate-y-0.5 hover:brightness-110
           active:scale-[.97]
           disabled:opacity-45 disabled:cursor-not-allowed"
    {disabled}
    on:click={() => dispatch("findFox")}
  >
    🔍 Find a Fox
  </button>

  <!-- Rules -->
  <div class="bg-white/[.03] border border-white/[.06] rounded-xl p-3">
    <div
      class="font-fredoka text-[.9rem] text-berry-lt mb-2 flex items-center gap-1.5"
    >
      📜 Rules
    </div>
    <ul class="flex flex-col gap-1">
      {#each ["Be respectful to other foxes.", "No harassment or offensive behavior.", "Do not share personal information.", "Each successful match costs both foxes 1 🍇 berry.", "Finishing a chat rewards berries — be a good fox!", "You will recieve 5 🍇 berries for completing or extending a chat.", "If your partner leaves, you'll be matched again automatically."] as rule}
        <li
          class="text-[.78rem] text-muted pl-4 relative leading-snug before:content-['🦊'] before:absolute before:left-0 before:text-[.65rem] before:top-0.5"
        >
          {rule}
        </li>
      {/each}
    </ul>
  </div>
</div>
