import { writable } from 'svelte/store';

// Define the type of the partner status


// Create a writable store
export const partnerStatus = writable<string>('');
export const chatRunning = writable<boolean>(false);

