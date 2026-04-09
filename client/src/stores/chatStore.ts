// stores/chatStore.ts
import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { roomId } from './roomStore';


// ── Types ──────────────────────────────────────────────────────────────────────
export type MessageType = 'self' | 'partner' | 'system' | 'reaction';

export interface ChatMessage {
  id: string;
  text: string;
  type: MessageType;
  replyTo?: string;
  timestamp?: number;
  reaction?: string;
}

interface ChatSession {
  messages: ChatMessage[];
  lastTextAt: number;
  startedAt: number;
  chatId: string;
  userId: string;
  partnerId: string;
}

export interface QueuedMessage {
  text: string;
  id: string;
  type: MessageType;
  replyTo?: string;
  chatId: string;
}

const savedChatsJson = browser ? localStorage.getItem('current-messages') : null;
const savedChats: ChatMessage[] = savedChatsJson ? JSON.parse(savedChatsJson) : [];

const savedQueuedMessages: QueuedMessage[] = loadQueuedMessagesFromLocalStorage();

const savedSessionsTxt = browser ? localStorage.getItem('archive-messages') : null;
const savedSessions: Record<string, ChatSession> = savedSessionsTxt ? JSON.parse(savedSessionsTxt) : {};



// ── Messages ───────────────────────────────────────────────────────────────────
export const messages = writable<ChatMessage[]>(savedChats);
export const session = writable<ChatSession>(savedSessions[get(roomId) || ""] || { messages: [], lastTextAt: 0, startedAt: 0, chatId: '', userId: '', partnerId: '' });
export const queuedMessages = writable<QueuedMessage[]>(savedQueuedMessages);

let _msgId = 0;

// ── Timer ──────────────────────────────────────────────────────────────────────
export const timerEnds = writable<number>(0);
export const timerExpired = writable<boolean>(false);
export const timerRemaining = writable<number>(0); // ms

let _timerInterval: ReturnType<typeof setInterval> | null = null;

export const timerDisplay = derived(timerRemaining, ($r) => {
  const s = Math.max(0, Math.ceil($r / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
});

export const timerUrgent = derived(timerRemaining, ($r) => {
  const s = Math.ceil($r / 1000);
  return s <= 30 && s > 0;
});

// ── Modal / extend ─────────────────────────────────────────────────────────────
export const showTimerModal = writable<boolean>(false);
export const partnerWantsExtend = writable<boolean>(false);
export const myExtendVote = writable<boolean>(false);

// ── Persistence (for development; can be removed) ───────────────────────────────

messages.subscribe(msgs => {
  if (browser) localStorage.setItem('current-messages', JSON.stringify(msgs));
  session.update(sess => ({ ...sess, messages: msgs, lastTextAt: Date.now() }));
});

session.subscribe(sess => {
  saveSessionToLocalStorage(sess);
});

queuedMessages.subscribe(qm => {
  if (browser) localStorage.setItem('queued-message', JSON.stringify(qm));
});


// ── Public API ─────────────────────────────────────────────────────────────────
export const chatStore = {
  start(durationMs: number): void {
    messages.set([{ id: generateChatId(), text: '🦊 You found another Sneaky Fox! Say hi!', type: 'system' }]);
    myExtendVote.set(false);
    partnerWantsExtend.set(false);
    showTimerModal.set(false);
    _startTimer(durationMs);
  },

  addMessage(text: string, id: string = generateChatId(), type: MessageType = 'system', replyTo?: string, timestamp?: number, reaction?: string): void {
    if (!get(messages).find(m => m.id === id)) {
      messages.update((ms) => [...ms, { id: id, text, type, replyTo, timestamp, reaction }].sort((a, b) => a.timestamp! && b.timestamp! ? a.timestamp! - b.timestamp! : 0));
    }
  },

  updateMessage(id: string, updatedFields: Partial<ChatMessage>) {
    messages.update(items => {
      return items.map(item => {
        if (item.id === id) {
          return { ...item, ...updatedFields };
        }
        return item;
      }).sort((a, b) => a.timestamp! && b.timestamp! ? a.timestamp! - b.timestamp! : 0);
    });
  },

  updateSession(updates: Partial<ChatSession>): void {
    session.update(sess => {
      const updated = { ...sess, ...updates };
      return updated;
    });
  },

  loadSession(chatId: string): void {
    const allSessions = loadMessagesFromLocalStorage();
    const ses = allSessions[chatId];
    if (ses) {
      session.set(ses);
    }
  },

  addQueuedMessage(text: string, chatId: string, id: string, type: MessageType, replyTo?: string): void {
    if (!get(queuedMessages).find((m: QueuedMessage) => m.id === id)) {
      queuedMessages.update((ms) => [...ms, { text, chatId, id, type, replyTo }]);
    }
  },

  removeQueuedMessage(id: string): void {
    queuedMessages.update((ms) => ms.filter(m => m.id !== id));
  },

  showModal(): void {
    timerExpired.set(true);
    if (_timerInterval) clearInterval(_timerInterval);
    timerRemaining.set(0);
    myExtendVote.set(false);
    showTimerModal.set(true);
  },

  partnerWantsExtend(): void {
    partnerWantsExtend.set(true);
  },

  markExtendVote(): void {
    myExtendVote.set(true);
  },

  extend(durationMs: number, msg?: string): void {
    myExtendVote.set(false);
    partnerWantsExtend.set(false);
    showTimerModal.set(false);
    if (msg) messages.update((ms) => [...ms, { id: (++_msgId).toString(), text: msg, type: 'system' }]);
    _startTimer(durationMs);
  },

  reset(): void {
    messages.set([]);
    timerExpired.set(false);
    showTimerModal.set(false);
    myExtendVote.set(false);
    partnerWantsExtend.set(false);
    if (_timerInterval) clearInterval(_timerInterval);
    timerRemaining.set(0);
  },

  resetTimer(durationMs: number): void {
    _stopTimer();
    _startTimer(durationMs);
  }

};

function _startTimer(durationMs: number): void {
  if (_timerInterval) clearInterval(_timerInterval);
  timerExpired.set(false);
  const ends = Date.now() + durationMs;
  timerEnds.set(ends);
  timerRemaining.set(durationMs);

  _timerInterval = setInterval(() => {
    const rem = Math.max(0, ends - Date.now());
    timerRemaining.set(rem);
    if (rem <= 0 && _timerInterval) clearInterval(_timerInterval);
  }, 500);
}

function _stopTimer(): void {
  if (_timerInterval) clearInterval(_timerInterval);
  timerRemaining.set(0);
}


function saveSessionToLocalStorage(ses: ChatSession): void {
  if (!browser) return;
  const prevChatSessions = loadMessagesFromLocalStorage();
  prevChatSessions[ses.chatId] = ses;
  delete prevChatSessions['']; // Clean up any empty keys
  localStorage.setItem('archive-messages', JSON.stringify(prevChatSessions));
}

function loadMessagesFromLocalStorage(): Record<string, ChatSession> {
  if (!browser) return {};
  const msgsJson = localStorage.getItem('archive-messages');
  return msgsJson ? JSON.parse(msgsJson) : {};
}

function loadQueuedMessagesFromLocalStorage(): QueuedMessage[] {
  if (!browser) return [];
  const msgJson = localStorage.getItem('queued-message');

  return msgJson ? sanitizeArray(JSON.parse(msgJson)) : [];
}

function sanitizeArray(arr: any[]): any[] {
  return arr.flatMap(item => {
    if (item === null) return [];              // remove nulls
    if (Array.isArray(item)) return sanitizeArray(item); // flatten nested arrays
    if (typeof item === "object") return [item]; // keep objects
    return [];
  });
}

function generateChatId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}