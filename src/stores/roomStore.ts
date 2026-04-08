import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const savedRoomId = browser ? localStorage.getItem('roomId') || null : null;

export const roomId = writable<string | null>(savedRoomId);

// Persist changes
roomId.subscribe(value => {
    if (!browser) return;
    if (value) localStorage.setItem('roomId', value);
    else localStorage.removeItem('roomId');
});