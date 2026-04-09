# SneakyChat Server 🦊

Express + Socket.io backend for anonymous peer-to-peer chat matching with a token-based economy system.

---

## Stack

| Tool | Purpose |
|---|---|
| **Express.js** | HTTP server & middleware |
| **Socket.io** | Real-time bidirectional communication |
| **JWT** | Stateless authentication (berries, chat state) |
| **Node.js** | Runtime with ES modules |
| **TypeScript** | Type-safe server implementation |

---

## Features

- **Matchmaking Queue**: Find and pair anonymous users in real-time
- **Berry Economy**: Earn/spend berries for chat actions
- **Cooldown System**: Progressive cooldowns based on berry count
- **Persistent Tokens**: JWT tokens preserve user state across sessions
- **Chat Management**: Timer-based chat sessions with extension mechanics
- **Auto-Requeue**: Automatic matching after chat completion or disconnection
- **Typing Indicators**: Real-time presence updates
- **Message Delivery**: Confirmation-based messaging system

---

## Project Structure

```
server/
├── src/
│   ├── types.ts           # Type definitions (FoxPayload, QueueEntry, Chat, Timer)
│   ├── constants.ts       # Game constants (MAX_BERRIES, COSTS, REWARDS, DURATIONS)
│   ├── state.ts           # Global state management (queues, chats, socket maps)
│   ├── tokens.ts          # JWT functions (sign, verify, freshPayload)
│   ├── utils.ts           # Helper functions (clamp, generateChatId, getCooldownMs)
│   ├── middleware.ts      # Socket.io auth middleware
│   ├── matchmaking.ts     # Matchmaking logic (queue, matching, requeue)
│   ├── chat.ts            # Chat lifecycle (timers, extend, end)
│   ├── events.ts          # Socket event handlers (findFox, message, etc.)
│   ├── index.ts           # Server startup & setup
│   └── types.d.ts         # Socket.io type declarations
├── dist/                  # Compiled JavaScript (after `npm run build`)
├── package.json
├── tsconfig.json
├── README.md
└── REFACTORING.md         # Detailed modularization notes
```

### Module Overview

| Module | Lines | Purpose |
|--------|-------|---------|
| **types.ts** | 39 | Type definitions + Timer class |
| **constants.ts** | 10 | Game config constants |
| **state.ts** | 12 | Centralized state maps |
| **tokens.ts** | 22 | JWT operations |
| **utils.ts** | 30 | Utility helpers |
| **middleware.ts** | 18 | Auth setup |
| **matchmaking.ts** | 106 | Queue & matching logic |
| **chat.ts** | 112 | Chat lifecycle |
| **events.ts** | 313 | Socket event handlers |
| **index.ts** | 49 | Server entry & wiring |

---

## Getting Started

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the server root:

```env
JWT_SECRET=your-secret-key-change-in-production
PORT=3000
```

### Development

```bash
npm run dev       # Start with tsx (live reload)
npm run type-check  # Type check without emitting
```

### Production

```bash
npm run build     # Compile TypeScript → dist/
npm start         # Run dist/index.js
```

---

## Game Economy & Constants

| Constant | Value | Purpose |
|---|---|---|
| `MAX_BERRIES` | 100 | Maximum berry cap |
| `STARTING_BERRIES` | 55 | New user starter berries |
| `COST_MATCH` | 1 | Berry cost per matched chat |
| `COST_SKIP` | 0 | Berry cost to skip during search |
| `REWARD_TIMER_END` | 5 | Berries earned when timer expires |
| `REWARD_EXTEND_BONUS` | 5 | Bonus berries for extending chat |
| `REWARD_FINISH` | 0 | Berries earned for completing chat |
| `INITIAL_CHAT_MS` | 2 min | Initial chat duration |
| `EXTENSION_CHAT_MS` | 5 min | Extended chat duration |

### Cooldown Logic

Cooldowns scale inversely with berry count (low berries = longer wait):

```
≥50 berries  → 0s cooldown
40-49        → 10s
30-39        → 20s
20-29        → 30s
10-19        → 60s
1-9          → 90s
0            → 120s
```

---

## Socket Events

### Client → Server

| Event | Payload | Purpose |
|---|---|---|
| `findFox` | — | Search for a match |
| `message` | `{ id, text?, replyTo?, type, reaction? }` | Send text/reaction message |
| `extendChat` | — | Vote to extend current chat |
| `chatComplete` | — | Finish chat after timer ends |
| `skip` | — | Skip current chat/search |
| `typing` | `{ isTyping: boolean }` | Announce typing status |
| `rejoinRoom` | `{ roomId, ouid }` | Rejoin a chat after disconnect |
| `exitChat` | — | Manually leave chat |

### Server → Client

| Event | Payload | Purpose |
|---|---|---|
| `init` | `{ token, berries, activeChatId }` | Connection setup |
| `onlineCount` | `{ count }` | Active user count (broadcast every 10s) |
| `searching` | `{ msg }` | Entered matchmaking queue |
| `matched` | `{ token, chatId, partnerId, berries, durationMs, msg }` | Match found |
| `message` | `{ from, text, id, replyTo, reaction, type, timestamp }` | Incoming message |
| `partner-status` | `{ status, event? }` | Partner online/typing/offline/rejoined |
| `timerEnd` | `{ token, berries, phase, msg }` | Chat timer expired |
| `chatExtended` | `{ token, berries, durationMs, msg }` | Chat extended by both |
| `chatEnded` | `{ token, berries, reason, msg }` | Chat ended |
| `autoRequeue` | `{ msg }` | Auto-queued after disconnect/skip |
| `noberries` | `{ msg }` | Insufficient berries or cooldown active |
| `idle` | `{ token?, berries?, reason?, msg }` | Returned to idle state |
| `berriesUpdate` | `{ token, berries }` | Berry count/token sync |
| `extendRequest` | `{ msg }` | Partner voted to extend |
| `error` / `info` | `{ msg }` | Generic status messages |

---

## Authentication

Uses **JWT tokens** to preserve user state. Tokens are signed with `JWT_SECRET` and contain:

```typescript
{
  berries: number              // Current berry count (0-100)
  lastMatch: number | null     // Timestamp of last match (for cooldown)
  activeChatId: string | null  // Current chat ID if in progress
  ua?: string                  // User-Agent (optional)
}
```

**Flow:**
1. Client connects → receives `init` event with signed token
2. Client sends token in subsequent events
3. Server verifies token and reads state
4. Token re-signed after any state change and sent back to client

---

## Key Logic

### Matchmaking

1. User emits `findFox`
2. Check: berries, cooldown, not already in chat
3. Try to pop someone from queue
4. If match found → both charged 1 berry, chat created, timer started
5. If no match → user added to queue, waits

### Chat Lifecycle

```
Search
   ↓
Matched (initial phase, 2min timer)
   ├→ Timer expires → Idle screen with extend option
   │   ├→ Both vote extend → Extended phase (5min timer)
   │   │   ├→ Timer expires → Idle screen again
   │   │   └→ Complete → End chat, both return to idle
   │   └→ Complete → End chat, both return to idle
   └→ Skip → Victim auto-requeued, skippers go to idle
```

### Message Flow

1. Client sends `message` event with callback
2. Server relays to partner, calls partner's callback
3. Partner callback response routed back to sender
4. Sender emits self-copy (so they see their own messages)

---

## Architecture

The server is organized into **focused modules** with clear responsibilities:

### Dependency Hierarchy

```
types/constants/state ← Foundation layer (no dependencies)
         ↓
tokens/utils ← Operations layer (uses foundation)
         ↓
matchmaking/chat ← Business logic (game rules)
         ↓
middleware/events ← Socket layer (handlers)
         ↓
index ← Entry point (wires everything)
```

### Key Design Principles

1. **Single Responsibility**: Each module has one clear purpose
2. **Parameter Injection**: Pass `io` instance to functions that emit (no globals)
3. **Centralized State**: All state mutations via `state.ts`
4. **Type Safety**: Full TypeScript across all modules
5. **No Circular Dependencies**: Clean import graph

### How to Extend

**Add a new socket event:**
1. Define handler in `events.ts` → `registerEventHandlers()`
2. Emit from client
3. Add any new constants to `constants.ts` if needed

**Add a new game mechanic:**
1. Add constant in `constants.ts`
2. Implement logic in `matchmaking.ts` or `chat.ts`
3. Call from event handler in `events.ts`

**Fix a bug:**
1. Identify which concern is broken (matching, chat, tokens, etc.)
2. Go to that module (e.g., `matchmaking.ts` for queue issues)
3. Fix and test

**See REFACTORING.md** for detailed modularization notes.

---

## Deployment

1. Set `JWT_SECRET` to a strong random string (production)
2. Set `PORT` if needed (default: 3000)
3. Build: `npm run build`
4. Run: `npm start` (or use process manager like PM2)
5. Ensure CORS is configured if frontend is on different origin
   - Currently allows `origin: '*'` (consider restricting in production)

---

## Troubleshooting

| Issue | Solution |
|---|---|
| JWT verification fails | Ensure `JWT_SECRET` matches on signing and verification |
| Messages not delivering | Check partner is still connected (`partnerSock?.id` is truthy) |
| Queue stuck | Look for clients not emitting `skip`/`disconnect` properly |
| Cooldown too aggressive | Adjust `getCooldownMs()` thresholds in `utils.ts` |
| Need to change berry values | Edit constants in `constants.ts` |
| Matchmaking broken | Check `matchmaking.ts` for tryMatch/requeueSocket logic |

---

## Development Notes

### Code Organization

- **types.ts**: All TypeScript interfaces and the Timer class
- **constants.ts**: Edit this to tweak game balance (berries, costs, rewards, timings)
- **state.ts**: Global in-memory state (no persistence)
- **tokens.ts**: JWT signing/verification logic
- **utils.ts**: Pure helper functions (no side effects)
- **matchmaking.ts**: Queue operations and matching algorithm
- **chat.ts**: Chat session management and timer logic
- **events.ts**: Socket event handlers (entry points for game logic)
- **middleware.ts**: Authentication on socket connection
- **index.ts**: Server initialization and wiring

### Logging

The server logs key events to console:
- `🦊 Connected` — New socket connection
- `🔍 Queued` — User entered matchmaking queue
- `💬 Chat` — Two users matched
- `⏰ Timer ended` — Chat timer expired
- `🔄 Extended` — Chat was extended
- `🔚 Ended` — Chat ended (reason + chatId)
- `👋 Left` — Socket disconnected

### State Management

All state is **in-memory** (resets on server restart):
- `matchmakingQueue[]` — Users waiting for a match
- `activeChats{}` — Active chat sessions with timers & users
- `socketToChat{}` — Maps socket ID → chat ID
- `socketPayloads{}` — Maps socket ID → FoxPayload (berry count, etc.)

Update state only via the modules that manage it (matchmaking.ts, chat.ts)

### Performance

- **Timers**: Uses `setImmediate()` for queue operations (non-blocking)
- **Broadcasts**: Online count broadcast every 10s (configurable in constants.ts)
- **Auto-Requeue**: Delayed with `setImmediate()` to avoid race conditions
- **No database**: All state is ephemeral (scale horizontally with multiple instances)
