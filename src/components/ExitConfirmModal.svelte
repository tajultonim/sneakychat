<script lang="ts">
    import { createEventDispatcher } from "svelte";

    export let visible: boolean = false;

    const dispatch = createEventDispatcher();
</script>

{#if visible}
    <!-- Backdrop -->
    <div
        class="fixed inset-0 bg-[rgba(5,10,5,.75)] backdrop-blur-lg z-[200] flex items-center justify-center"
        on:click|self={() => dispatch("cancel")}
        on:keydown={(e) => {
            if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                dispatch("cancel");
            }
        }}
        role="button"
        aria-label="Close exit confirmation"
        tabindex="0"
    >
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Exit chat confirmation"
            class="bg-[rgba(20,34,20,.97)] border border-white/[.1] rounded-2xl p-6 max-w-[300px] w-[90%] text-center flex flex-col gap-3.5 animate-modalin shadow-[0_8px_40px_rgba(0,0,0,.5)]"
        >
            <h3 class="font-fredoka text-[1.2rem] text-cream">
                Exit this chat?
            </h3>

            <p class="text-[.82rem] text-muted leading-relaxed">
                <strong class="text-cream/80"
                    >You will be sent to home screen.</strong
                >. You won't be matched with a new fox until you click "Find
                Fox" again.
            </p>

            <div class="flex gap-2">
                <button
                    class="flex-1 py-2.5 bg-white/[.05] border border-white/[.1] rounded-xl text-cream font-fredoka text-[.9rem] cursor-pointer hover:bg-white/[.1] transition-colors"
                    on:click={() => dispatch("cancel")}>Stay</button
                >

                <button
                    class="flex-1 py-2.5 bg-[rgba(201,75,18,.2)] border border-[rgba(201,75,18,.3)] rounded-xl text-[#FF9A6C] font-fredoka text-[.9rem] cursor-pointer hover:bg-[rgba(201,75,18,.35)] transition-colors"
                    on:click={() => dispatch("confirm")}>Exit</button
                >
            </div>
        </div>
    </div>
{/if}
