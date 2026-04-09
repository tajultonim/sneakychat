// stores/cooldownStore.ts
import { writable, derived } from 'svelte/store';

export const cooldownEnds     = writable<number>(0);
export const cooldownRemaining = writable<number>(0); // seconds

let _interval: ReturnType<typeof setInterval> | null = null;

function getCooldownMs(b: number): number {
  if (b >= 50) return 0;
  if (b >= 40) return 10_000;
  if (b >= 30) return 20_000;
  if (b >= 20) return 30_000;
  if (b >= 10) return 60_000;
  if (b >  0)  return 90_000;
  return 120_000;
}

export function startCooldown(berryCount: number): void {
  const wait = getCooldownMs(berryCount);
  if (wait <= 0) {
    cooldownEnds.set(0);
    cooldownRemaining.set(0);
    return;
  }

  const ends = Date.now() + wait;
  cooldownEnds.set(ends);

  if (_interval) clearInterval(_interval);
  _interval = setInterval(() => {
    const rem = Math.max(0, Math.ceil((ends - Date.now()) / 1000));
    cooldownRemaining.set(rem);
    if (rem <= 0) {
      if (_interval) clearInterval(_interval);
      cooldownEnds.set(0);
    }
  }, 500);
}

/** "2m" or "45s" */
export const cooldownLabel = derived(cooldownRemaining, ($r) =>
  $r >= 60 ? `${Math.ceil($r / 60)}m` : `${$r}s`
);

export const isCoolingDown = derived(cooldownEnds, ($e) => $e > Date.now());
