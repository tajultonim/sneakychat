<script lang="ts">
  import { socket } from '$lib/socket';
  import { activeGame, gameNames } from '$stores/gameStore';

  $: myChoice = null;
  let lastGameId: string | null = null;

  $: gameState = $activeGame.state as any;

  $: if ($activeGame && $activeGame.gameType === 'rockPaperScissors') {
    // Only reset when a NEW game starts (gameId changed)
    if (lastGameId !== $activeGame.gameId) {
      lastGameId = $activeGame.gameId;
    }
    // Always update gameState even if we're not resetting
    gameState = $activeGame.state;
    if (gameState.isFinished) {
      myChoice = null; // Reset choice when game starts or changes
    }
  }

  $: {
    if ($activeGame?.isFinished) {
      myChoice = null;
    }
  }

  $: isPlayer1 = $activeGame?.players[0] === socket.id;

  function handleChoice(choice: 'rock' | 'paper' | 'scissors') {
    if (!$activeGame || $activeGame.gameType !== 'rockPaperScissors') return;
    if (gameState.isFinished) return;

    socket.emit('makeGameMove', { gameId: $activeGame.gameId, move: choice }, (response: any) => {
      if (response?.status === 'success') {
        myChoice = choice;
      } else if (response?.status === 'error') {
        console.error('Move error:', response.msg);
      }
    });
  }

  function getEmoji(choice: string): string {
    switch (choice) {
      case 'rock':
        return '✊';
      case 'paper':
        return '✋';
      case 'scissors':
        return '✌️';
      default:
        return '❓';
    }
  }

  function getResultMessage(gameState: any): string {
    if (!gameState?.result) return '';
    if (gameState.result.outcome === 'draw') return "🤝 It's a draw!";
    if (gameState.result.winner === $activeGame?.players[0] && isPlayer1) return '🎉 You won!';

    return '😢 You lost!';
  }
</script>

<div class="flex flex-col items-center gap-6">
  {#if gameState}
    {#if !myChoice && !gameState.isFinished}
      <div
        class="w-full max-w-[420px] rounded-2xl border border-white/[0.12] bg-[linear-gradient(165deg,rgba(35,50,35,0.85),rgba(16,22,16,0.9))] p-4 sm:p-5"
      >
        <div class="text-center mb-4">
          <p class="text-[0.72rem] uppercase tracking-[0.14em] text-white/55 font-bold">
            Battle Phase
          </p>
          <p class="mt-1 text-[#D7E2D4]">Choose your move</p>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <button on:click={() => handleChoice('rock')} class="rps-choice">
            <span class="text-4xl leading-none">✊</span>
            <span class="text-[0.72rem] mt-1 font-semibold text-[#F2F5F1]">Rock</span>
          </button>
          <button on:click={() => handleChoice('paper')} class="rps-choice">
            <span class="text-4xl leading-none">✋</span>
            <span class="text-[0.72rem] mt-1 font-semibold text-[#F2F5F1]">Paper</span>
          </button>
          <button on:click={() => handleChoice('scissors')} class="rps-choice">
            <span class="text-4xl leading-none">✌️</span>
            <span class="text-[0.72rem] mt-1 font-semibold text-[#F2F5F1]">Scissors</span>
          </button>
        </div>
      </div>
    {:else}
      <!-- if gameState.isFinished} -->
      <div
        class="w-full max-w-[430px] rounded-2xl border border-white/[0.12] bg-[linear-gradient(165deg,rgba(22,34,22,0.95),rgba(10,16,10,0.98))] p-5 text-center"
      >
        <p class="text-xl font-extrabold mb-5 text-[#F8F3E6]">
          {$activeGame.winner || ($activeGame as any)?.state?.result?.outcome
            ? getResultMessage($activeGame.state)
            : 'Waiting for opponent...'}
        </p>
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-4">
            <p class="text-xs uppercase tracking-[0.08em] text-cyan-100/80 mb-1">Your choice</p>
            <p class="text-4xl">
              {myChoice
                ? getEmoji(myChoice)
                : isPlayer1
                  ? getEmoji(gameState?.result?.move1 || '')
                  : getEmoji(gameState?.result?.move2 || '')}
            </p>
          </div>
          <div class="rounded-xl border border-pink-300/25 bg-pink-500/10 p-4">
            <p class="text-xs uppercase tracking-[0.08em] text-pink-100/80 mb-1">Their choice</p>
            <p class="text-4xl">
              {isPlayer1
                ? getEmoji(gameState?.result?.move2 || '')
                : getEmoji(gameState?.result?.move1 || '')}
            </p>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .rps-choice {
    height: 110px;
    border-radius: 0.85rem;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: linear-gradient(155deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.04));
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transition:
      transform 120ms ease,
      filter 120ms ease,
      border-color 120ms ease;
  }

  .rps-choice:hover {
    transform: translateY(-2px) scale(1.03);
    filter: brightness(1.1);
    border-color: rgba(255, 202, 163, 0.55);
  }

  .rps-choice:active {
    transform: translateY(0) scale(0.98);
  }
</style>
