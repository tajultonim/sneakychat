// stores/gameStore.ts
import { writable, derived } from 'svelte/store';

export const MAX_BERRIES = 100;

export const berries     = writable<number>(55);
export const onlineCount = writable<number>(1);

export function updateBerryUI(b: number): void {
  berries.set(b);
}

/** 0–100 fill % for the berry progress bar */
export const berryFillPct = derived(berries, ($b) =>
  Math.min(100, Math.round(($b / MAX_BERRIES) * 100))
);
