# SneakyChat 🦊 — Svelte + TypeScript + Tailwind

Anonymous fox chat app, rebuilt as a fully modular Svelte project with TypeScript and Tailwind CSS.

---

## Stack

| Tool | Purpose |
|---|---|
| **Svelte 5** | UI components & reactivity |
| **TypeScript** | Type-safe stores, socket events, props |
| **Tailwind CSS v3** | All styling — zero scoped `<style>` blocks |
| **Vite 5** | Dev server, HMR, production build |
| **socket.io** | Loaded via `<script>` tag; wrapped in `lib/socket.ts` |

---

## Project Structure

```
sneakychat/
├── index.html                  # HTML shell — loads socket.io before the bundle
├── vite.config.js              # Vite + Svelte plugin + /socket.io dev proxy
├── svelte.config.js            # vitePreprocess config for Svelte + Vite
├── tailwind.config.js          # Custom colors, fonts, keyframes, animations
├── postcss.config.js           # Tailwind + Autoprefixer
├── tsconfig.json               # TypeScript config (extends @tsconfig/svelte)
├── package.json
└── src/
    ├── main.ts                 # Entry point — mounts App, imports app.css
    ├── app.css                 # @tailwind directives + body overlay + font import
    ├── App.svelte              # Root: screen routing + all socket event wiring
    │
    ├── lib/
    │   └── socket.ts           # Typed singleton socket.io wrapper
    │
    ├── stores/
    │   ├── gameStore.ts        # berries, onlineCount, berryFillPct
    │   ├── toastStore.ts       # Toast queue — add(msg, duration?)
    │   ├── cooldownStore.ts    # Cooldown timer, derived label, isCoolingDown
    │   └── chatStore.ts        # Messages, chat timer, modal & extend state
    │
    └── components/
        ├── Fireflies.svelte        # Decorative floating dots (CSS animation)
        ├── Header.svelte           # Logo + connection status
        ├── StatsStrip.svelte       # Online pill + berry pill with progress bar
        ├── CooldownBadge.svelte    # "Next fox in Xs" ribbon
        ├── IdleScreen.svelte       # Home: Find Fox button + rules list
        ├── SearchingScreen.svelte  # Animated searching state + cancel
        ├── ChatScreen.svelte       # Header / messages / input / timer modal
        ├── SkipConfirmModal.svelte # "Skip this fox?" overlay
        └── ToastManager.svelte     # Toast stack with svelte/transition
```

---

## Getting Started

```bash
npm install
npm run dev       # → http://localhost:5173  (socket.io proxied automatically)
npm run build     # → dist/
npm run check     # svelte-check TypeScript type checking
```

---

## Common Customisations

| What | Where |
|---|---|
| **Colors / fonts** | `tailwind.config.js` → `theme.extend.colors / fontFamily` |
| **Custom animations** | `tailwind.config.js` → `theme.extend.keyframes / animation` |
| **Socket server URL** | `src/lib/socket.ts` + `vite.config.js` proxy target |
| **Cooldown thresholds** | `src/stores/cooldownStore.ts` → `getCooldownMs()` |
| **Berry cap** | `src/stores/gameStore.ts` → `MAX_BERRIES` |
| **Toast duration** | `src/stores/toastStore.ts` → `add()` default param |
| **Rules text** | `src/components/IdleScreen.svelte` → the rules array |
| **Firefly count** | `src/App.svelte` → `<Fireflies count={14} />` |
| **New screen** | Add `YourScreen.svelte`, extend `Screen` type in `App.svelte`, add `{:else if}` branch |
| **New socket event** | Wire in `App.svelte` `onMount` block; cast `d as { ... }` |

---

## Styling Approach

Every component uses **only Tailwind utility classes** — no `<style>` blocks.
Custom design tokens (fox orange, berry purple, forest green, etc.) are defined
once in `tailwind.config.js` and available as `text-fox`, `bg-berry`, `from-fox-dark`, etc.

Custom animations (`bobble`, `sneak`, `dpulse`, `popin`, `blink`, `float`, `modalin`, `toastin`)
are declared in `tailwind.config.js` under `theme.extend.keyframes / animation` and
used as `animate-bobble`, `animate-sneak`, etc.

The only global CSS file is `src/app.css` which handles:
- `@tailwind` directives
- Google Fonts `@import`
- `body::before` radial-gradient overlay (not expressible in plain Tailwind)
- `.firefly` custom property for translate animations
