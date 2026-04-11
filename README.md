# SneakyChat 🦊

Anonymous peer-to-peer chat app with a token-based economy. Match with random foxes, chat for a limited time, earn berries, and come back for more.

Live demo: [https://sneakychat.pages.dev](https://sneakychat.pages.dev)

---

## Project Overview

SneakyChat is a full-stack application split into **client** (Svelte frontend) and **server** (Node.js backend):

- **Client**: Svelte 5 + TypeScript + Tailwind CSS — beautiful, responsive UI with real-time sockets
- **Server**: Express + Socket.io — matchmaking, JWT auth, economy system, persistent state

### Core Features

✨ **Instant Matching** — Find & chat with a random anonymous fox in seconds
🍇 **Berry Economy** — Earn berries for chatting, lose them for skipping
⏰ **Timed Chats** — 2-minute initial chats with option to extend by 5 minutes
💬 **Real-time Messaging** — Instant delivery with typing indicators & reactions
🦊 **Persistent Sessions** — Rejoin chats if you disconnect accidentally
📱 **Fully Responsive** — Beautiful design on mobile, tablet, and desktop
🛡️ **Anonymous** — No accounts, no tracking — pure ephemeral connection

---

## Project Structure

```
sneakychat/
├── client/                # Svelte 5 frontend
│   ├── src/
│   │   ├── routes/        # SvelteKit pages (/, /about, /privacy, /terms)
│   │   ├── components/    # Reusable UI components
│   │   ├── stores/        # Svelte stores (game state, chat, cooldown, etc.)
│   │   ├── lib/           # Utilities & Socket.io wrapper
│   │   └── app.css        # Global styles & Tailwind setup
│   ├── tailwind.config.js # Custom colors, animations, tokens
│   ├── vite.config.js     # Vite + SvelteKit + Socket.io dev proxy
│   ├── package.json
│   └── README.md
│
├── server/                # Express + Socket.io backend
│   ├── src/
│   │   ├── index.ts       # Main server logic (matchmaking, game rules, etc.)
│   │   └── types.d.ts     # Socket.io types
│   ├── tsconfig.json
│   ├── package.json
│   └── README.md
│
└── README.md              # This file
```

---

## Quick Start

### Prerequisites

- **Node.js** 18+
- **npm** 7+ (for monorepo workspaces)

### One-Command Setup

```bash
cd sneakychat
npm install              # Installs client & server dependencies
npm run dev              # Runs both client & server together
```

Visit **http://localhost:5173** (client auto-proxies `/socket.io` to server on :3000)

### Run Separately (Optional)

**Terminal 1 — Server:**

```bash
npm run dev:server      # → http://localhost:3000
```

**Terminal 2 — Client:**

```bash
npm run dev:client      # → http://localhost:5173
```

---

## Building & Deployment

### Production Build

```bash
npm run build            # Builds both client & server
cd server
npm start                # Runs production server → http://localhost:3000
```

### NPM Scripts Reference

| Command                | What it does                           |
| ---------------------- | -------------------------------------- |
| `npm install`          | Install client & server dependencies   |
| `npm run dev`          | Run both together (parallel)           |
| `npm run dev:client`   | Run client only (Svelte dev server)    |
| `npm run dev:server`   | Run server only (with tsx live reload) |
| `npm run build`        | Build both for production              |
| `npm run build:client` | Build client only → `client/build/`    |
| `npm run build:server` | Build server only → `server/dist/`     |
| `npm run check`        | Type-check both (svelte-check + tsc)   |

### Type Checking

```bash
npm run check            # Check both client & server
```

---

## Configuration Files

### File Structure

```
sneakychat/
├── .gitignore                     # Root: prevent committing secrets & build artifacts
├── .vscode/
│   ├── settings.json              # Shared editor settings (Prettier, formatting)
│   └── extensions.json            # Recommended VS Code extensions
├── client/
│   ├── .gitignore
│   ├── .env.development           # Dev vars (commit this)
│   ├── .env.production            # Prod template (commit this)
│   └── .env.local (git-ignored)   # Local overrides
└── server/
    ├── .gitignore
    ├── .env.development           # Dev vars (commit this)
    ├── .env.production            # Prod template (commit this)
    └── .env.local (git-ignored)   # Local overrides
```

### Environment Variables

**Client `(.env.development`)**

```env
# Socket.io server URL during development
VITE_SOCKET_URL=http://localhost:3000
VITE_ENV=development
```

**Client (`.env.production`)**

```env
# Update this with your actual domain before deploying
VITE_SOCKET_URL=https://yourdomain.com
VITE_ENV=production
```

**Server (`.env.development`)**

```env
# Development JWT secret (safe to commit — not used in production)
JWT_SECRET=sneaky-fox-berry-secret-change-in-prod
PORT=3000
NODE_ENV=development
```

**Server (`.env.production`)**

```env
# For production: set JWT_SECRET via environment variables (not in file!)
JWT_SECRET=your-strong-random-secret-min-32-chars
PORT=3000
NODE_ENV=production
```

### First-Time Setup

```bash
# Create local env file overrides (git-ignored)
cp client/.env.development client/.env.local
cp server/.env.development server/.env.local

# Edit .env.local files if needed
# These override the committed .env.development files
```

### Security Best Practices

✅ **DO:**

- Commit `.env.development` with safe/test values
- Commit `.env.production` as **template** (no real secrets)
- Use `.env.local` for personal overrides (git-ignored)
- Use strong random secrets in production (min 32 characters)
- Set production secrets via environment variables or platform secrets manager

❌ **DON'T:**

- Commit real secrets or `.env.local` files
- Use same secret for dev & production
- Hardcode secrets in code
- Commit `.DS_Store`, `node_modules`, `dist`, `build`

---

## Technology Stack

### Client

| Tech                 | Role                                       |
| -------------------- | ------------------------------------------ |
| **Svelte 5**         | Reactive UI components & logic             |
| **TypeScript**       | Type-safe components & stores              |
| **Tailwind CSS v3**  | Utility-first styling (zero scoped styles) |
| **Vite 5**           | Dev server, HMR, optimized builds          |
| **SvelteKit**        | Routing, SSR, static export                |
| **Socket.io Client** | Real-time bidirectional comms              |

### Server

| Tech           | Role                          |
| -------------- | ----------------------------- |
| **Node.js**    | JavaScript runtime            |
| **Express.js** | HTTP framework & basic routes |
| **Socket.io**  | WebSocket abstraction         |
| **JWT**        | Stateless user session tokens |
| **TypeScript** | Type-safe server logic        |

---

## Architecture

### Client Flow

```
Idle Screen
   ↓ (click Find Fox)
Searching Screen
   ↓ (socket 'matched' event)
Chat Screen (2 min timer)
   ├→ Messages sent/received in real-time
   ├→ Typing indicators
   ├→ Reactions
   └→ Timer ends → Extend/Finish option
        ├→ Extend (both agree) → +5 min
        └→ Finish or timeout → Stats & back to Idle
```

### Server State

- **In-Memory**: Matchmaking queue, active chats, socket payloads
- **Resets on**: Server restart (no persistent DB)
- **Preserved via**: JWT tokens signed on client (berries, lastMatch, activeChatId)
- **Auth**: Socket.io middleware verifies token on connection

### Communication

- **Socket Events**: All real-time comms (match, message, timer, extend, etc.)
- **State Sync**: After any change, server sends updated JWT token to client
- **Graceful Disconnect**: Auto-requeue on drop, rejoin available for active chats

---

## Economy System

### Berries

Every user starts with **55 berries** (max: 100).

| Action               | Cost/Reward        |
| -------------------- | ------------------ |
| Start a matched chat | -1 🍇 (both users) |
| Chat timer expires   | +5 🍇 (both users) |
| Both extend chat     | +5 🍇 (both users) |
| Complete/finish chat | +0 🍇 (both users) |
| Skip active chat     | -0 🍇 (skippers)   |
| Skip in queue        | -0 🍇 (users)      |

### Cooldown

When berries run low, users must wait before searching again:

```
≥50 berries  → 0s
40-49        → 10s
30-39        → 20s
20-29        → 30s
10-19        → 60s
1-9          → 90s
0            → 120s (locked out)
```

This prevents spamming and encourages longer, more meaningful chats.

---

## Customization

### Client

| What              | Where                                                |
| ----------------- | ---------------------------------------------------- |
| Colors & fonts    | `client/tailwind.config.js` → `theme.extend`         |
| Chat duration     | `client/src/stores/cooldownStore.ts`                 |
| Rules text        | `client/src/components/IdleScreen.svelte`            |
| Firefly count     | `client/src/routes/+page.svelte`                     |
| Socket server URL | `client/.env.development` / `client/.env.production` |

### Server

| What                | Where                                                               |
| ------------------- | ------------------------------------------------------------------- |
| Max berries         | `server/src/constants.ts` → `MAX_BERRIES`                           |
| Starting berries    | `server/src/constants.ts` → `STARTING_BERRIES`                      |
| Chat durations      | `server/src/constants.ts` → `INITIAL_CHAT_MS` / `EXTENSION_CHAT_MS` |
| Cooldown thresholds | `server/src/utils.ts` → `getCooldownMs()`                           |
| Berry rewards       | `server/src/constants.ts` → `REWARD_*`                              |
| Matchmaking logic   | `server/src/matchmaking.ts`                                         |
| Chat lifecycle      | `server/src/chat.ts`                                                |
| Socket events       | `server/src/events.ts`                                              |
| JWT secret          | `server/.env.development` / `server/.env.production`                |

**Server is modularized** — See [server/README.md](./server/README.md) for detailed module breakdown and architecture.

---

## Deployment

### Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/client/build ./client/build
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
```

**Build & run:**

```bash
docker build -t sneakychat .
docker run -p 3000:3000 \
  -e JWT_SECRET=your-strong-secret \
  -e VITE_SOCKET_URL=https://yourdomain.com \
  sneakychat
```

### Heroku / Railway / Render

1. Connect your git repository
2. Set environment variables in platform dashboard:
   - `JWT_SECRET=your-strong-random-secret-min-32-chars`
   - `VITE_SOCKET_URL=https://your-app.herokuapp.com` (or your domain)
3. Set build command: `npm install && npm run build`
4. Set start command: `node server/dist/index.js`
5. Deploy!

For Heroku specifically:

```bash
heroku config:set JWT_SECRET=your-strong-secret
heroku config:set VITE_SOCKET_URL=https://your-app.herokuapp.com
git push heroku main
```

### Production Checklist

Before deploying:

- [ ] Set `JWT_SECRET` to strong random string (min 32 chars)
- [ ] Update `VITE_SOCKET_URL` to your actual domain
- [ ] Restrict CORS to your domain in `server/src/index.ts`
- [ ] Test build locally: `npm run build && npm start`
- [ ] Use environment variables (not .env files) for secrets
- [ ] Enable HTTPS for all connections
- [ ] Set up monitoring/logging for production

---

## Contributing

### Development Workflow

1. **Client changes**: Automatic HMR in dev mode
2. **Server changes**: Auto-reloads with tsx (or manually restart)
3. **Type checking**: `npm run check` before committing
4. **Build**: Always `npm run build` before deploying

### Common Tasks

**Add a new socket event:**

1. Define handler in `server/src/events.ts` → `registerEventHandlers()`
2. Emit from client via `socket.emit()` in store/component
3. Add any new constants to `server/src/constants.ts` if needed

**Add a new game mechanic:**

1. Add constant in `server/src/constants.ts`
2. Implement logic in `server/src/matchmaking.ts` or `server/src/chat.ts`
3. Call from event handler in `server/src/events.ts`

**Fix a bug:**

1. Identify which concern (matching, chat, tokens, etc.)
2. Go to that module: `server/src/[module].ts`
3. Fix and test

**Add a new page:**

1. Create `client/src/routes/[path]/+page.svelte`
2. Optional: Create `+page.ts` for metadata / prerender
3. Add to navigation in Header

**Tweak game balance:**

1. Edit constants in `server/src/constants.ts`
2. Test with multiple clients
3. See `server/README.md` for detailed architecture

---

## Troubleshooting

### Build & Deployment

| Issue                                      | Solution                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| "Address already in use" on :3000 or :5173 | Kill process: `lsof -i :3000 \| tail -1 \| awk '{print $2}' \| xargs kill -9` |
| Client can't connect to server             | Check server is running, check proxy in `client/vite.config.js`, check CORS   |
| TypeScript build errors                    | Run `npm run check`, fix files, rebuild                                       |
| npm workspaces not working                 | Ensure you're at root (sneakychat/), run `npm install --workspaces`           |

### Runtime Issues

| Issue                  | Cause                        | Fix                                       |
| ---------------------- | ---------------------------- | ----------------------------------------- |
| "Already searching..." | User already in queue        | Refresh or wait for timeout               |
| "Chat not found"       | Server restarted             | Chats are in-memory; rejoin not available |
| Typing indicators lag  | Network latency              | Normal behavior                           |
| CORS errors            | Frontend/server URL mismatch | Update `VITE_SOCKET_URL` in `.env`        |
| Messages not syncing   | JWT token issue              | Refresh page or reconnect                 |

### Development Issues

| Issue                        | Solution                                                           |
| ---------------------------- | ------------------------------------------------------------------ |
| ".env not being read"        | Check filename, directory (client/ or server/), restart dev server |
| VS Code settings not working | Open at root folder (sneakychat/), not client/ or server/          |
| Extensions not recommended   | Open `.vscode/extensions.json`, install manually if needed         |
| Secrets leaked in git        | Use `git-secret` or `git-crypt`, or rebase history with care       |

---

## Security Notes

- **CORS**: Currently allows `origin: '*'` in server — restrict to your domain in production
- **JWT_SECRET**: Must be strong & secret (change from default!)
- **No Auth DB**: Stateless design means no user data persists
- **No Message DB**: Messages are ephemeral (not stored)
- **HTTPS Required**: For production deployment, enforce TLS

---

## Future Ideas

- 🎨 Avatar customization & fox breeds
- 🏆 Leaderboards (berries, chat count, favorite partners)
- 🔊 Voice/video chat option
- 🎮 Mini-games to earn berries faster
- 🌍 Translation support
- 📊 Analytics dashboard (server-side metrics)

---

## License

MIT

---

## Support

For issues or questions:

1. Check **Quick Start** (above) for setup help
2. Check **Configuration Files** for environment setup
3. Check **Troubleshooting** for common issues
4. Check [client/README.md](./client/README.md) for frontend details
5. Check [server/README.md](./server/README.md) for backend/architecture details
6. Open an issue on GitHub

---

**Built with 🦊 love.**
