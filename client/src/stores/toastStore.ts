// stores/toastStore.ts
import { writable } from 'svelte/store';

interface Toast {
  id: number;
  msg: string;
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);
  let nextId = 0;

  return {
    subscribe,
    add(msg: string, duration = 3000): void {
      const id = ++nextId;
      update((toasts) => [...toasts, { id, msg }]);
      setTimeout(() => {
        update((toasts) => toasts.filter((t) => t.id !== id));
      }, duration);
    },
  };
}

export const toastStore = createToastStore();
