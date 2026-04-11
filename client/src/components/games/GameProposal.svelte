<script lang="ts">
  import { onMount } from 'svelte';
  import { socket } from '$lib/socket';
  import { gameProposal, gameNames } from '$stores/gameStore';

  const gameIcons: Record<string, string> = {
    tictactoe: '❎',
    connect4: '🟡',
    dotsAndBoxes: '🧩',
    rockPaperScissors: '✌️',
  };

  let timeRemaining = 10;
  let timerInterval: NodeJS.Timeout | null = null;

  gameProposal.subscribe((proposal) => {
    if (proposal) {
      timeRemaining = 10;
      startTimer();
    } else {
      if (timerInterval) clearInterval(timerInterval);
    }
  });

  function startTimer() {
    timerInterval = setInterval(() => {
      timeRemaining--;
      if (timeRemaining <= 0) {
        if (timerInterval) clearInterval(timerInterval);
        declineGame();
      }
    }, 1000);
  }

  $: if ($gameProposal && !timerInterval) {
    timeRemaining = 10;
    startTimer();
  }

  function acceptGame() {
    if (timerInterval) clearInterval(timerInterval);
    if ($gameProposal) {
      socket.emit('acceptGame', {
        gameId: $gameProposal.gameId,
        chatId: $gameProposal.chatId,
      });
      gameProposal.set(null);
    }
  }

  function declineGame() {
    if (timerInterval) clearInterval(timerInterval);
    if ($gameProposal) {
      socket.emit('declineGame', { chatId: $gameProposal.chatId });
      gameProposal.set(null);
    }
  }
</script>

{#if $gameProposal}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(9,14,9,0.72)] backdrop-blur-sm px-4"
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Game proposal"
      class="w-full max-w-sm rounded-2xl border border-white/[0.14] bg-[radial-gradient(circle_at_top_right,rgba(255,160,90,0.2),transparent_45%),linear-gradient(165deg,rgba(33,48,33,0.96),rgba(16,25,16,0.96))] shadow-[0_20px_50px_rgba(0,0,0,0.45)] p-5"
    >
      <div class="flex items-start gap-3 mb-4">
        <div
          class="w-11 h-11 shrink-0 rounded-xl bg-[rgba(255,107,53,0.18)] border border-[rgba(255,155,110,0.28)] flex items-center justify-center text-[1.35rem]"
        >
          {gameIcons[$gameProposal.gameType] || '🎮'}
        </div>
        <div class="min-w-0">
          <p class="text-[0.7rem] uppercase tracking-[0.12em] text-white/55 mb-1">
            Incoming Challenge
          </p>
          <h2 class="text-[1.18rem] leading-tight font-extrabold text-[#F8F3E6]">Game Proposal</h2>
        </div>
      </div>

      <p class="text-[0.92rem] text-[#D4DCCF] leading-relaxed mb-5">
        Your partner wants to play
        <span class="font-semibold text-[#FFE1C7]">{gameNames[$gameProposal.gameType]}</span>.
      </p>

      <div
        class="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 mb-5"
      >
        <span class="text-xs text-white/70">Auto decline in</span>
        <span
          class="text-xs font-bold transition-colors"
          class:text-[#FFE1C7]={timeRemaining > 3}
          class:text-[#FF8C42]={timeRemaining <= 3}
          class:text-[#FF4444]={timeRemaining <= 1}
        >
          {timeRemaining}s
        </span>
      </div>

      <div class="flex gap-3">
        <button
          onclick={declineGame}
          class="flex-1 h-11 rounded-xl border border-white/[0.16] bg-white/[0.05] text-[#D9E2D4] font-semibold tracking-wide hover:bg-white/[0.1] transition"
        >
          Decline
        </button>
        <button
          onclick={acceptGame}
          class="flex-1 h-11 rounded-xl border-0 bg-gradient-to-br from-[#1FA14D] to-[#157D3A] text-white font-semibold tracking-wide shadow-[0_8px_18px_rgba(22,163,74,0.35)] hover:brightness-110 transition"
        >
          Accept Game
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Modal styling */
</style>
