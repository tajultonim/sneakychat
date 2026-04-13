// stores/stickerStore.ts
import { writable } from 'svelte/store';

export interface Sticker {
  id: string;
  name: string;
  pack: string; // 'fluent', 'default', etc.
  type: 'animated' | 'static';
  cost: number; // Usually 2 berries
  premium: boolean;
  url: string; // Path to sticker image
}

// GITHUB_BASE URLs for Microsoft Fluent UI Animated Emojis
const GITHUB_BASE = 'https://media.githubusercontent.com/media/microsoft/fluentui-emoji-animated/refs/heads/main/assets/';

export const stickerCollections = [
  // Fluent Emoji Stickers - Animated (served directly from GitHub)
  {
    id: 'fluent-heart-eyes',
    name: 'Heart Eyes',
    pack: 'fluent',
    type: 'animated' as const,
    cost: 2,
    premium: false,
    url: `${GITHUB_BASE}/Smiling%20face%20with%20heart-eyes/animated/smiling_face_with_heart-eyes_animated.png`,
  },
  {
    id: 'fluent-laughing',
    name: 'Laughing',
    pack: 'fluent',
    type: 'animated' as const,
    cost: 2,
    premium: false,
    url: `${GITHUB_BASE}/Face%20with%20tears%20of%20joy/animated/face_with_tears_of_joy_animated.png`,
  },
  {
    id: 'fluent-surprise',
    name: 'Surprised',
    pack: 'fluent',
    type: 'animated' as const,
    cost: 2,
    premium: false,
    url: `${GITHUB_BASE}/Face%20with%20open%20mouth/animated/face_with_open_mouth_animated.png`,
  },
  {
    id: 'fluent-crying',
    name: 'Crying',
    pack: 'fluent',
    type: 'animated' as const,
    cost: 2,
    premium: false,
    url: `${GITHUB_BASE}/Crying%20face/animated/crying_face_animated.png`,
  },
  {
    id: 'fluent-fire',
    name: 'Fire/Hot',
    pack: 'fluent',
    type: 'animated' as const,
    cost: 2,
    premium: false,
    url: `${GITHUB_BASE}/Fire/animated/fire_animated.png`,
  },
  {
    id: 'fluent-thumbs-up',
    name: 'Thumbs Up',
    pack: 'fluent',
    type: 'animated' as const,
    cost: 2,
    premium: false,
    url: `${GITHUB_BASE}/Thumbs%20up/Default/animated/thumbs_up_animated_default.png`,
  },
  {
    id: 'fluent-clap',
    name: 'Clapping',
    pack: 'fluent',
    type: 'animated' as const,
    cost: 2,
    premium: false,
    url: `${GITHUB_BASE}/Clapping%20hands/Default/animated/clapping_hands_animated_default.png`,
  },
  {
    id: 'fluent-party',
    name: 'Party',
    pack: 'fluent',
    type: 'animated' as const,
    cost: 2,
    premium: false,
    url: `${GITHUB_BASE}/Party%20popper/animated/party_popper_animated.png`,
  },

  // Default Stickers - Static/Premium
  {
    id: 'default-fox-wink',
    name: 'Fox Wink',
    pack: 'default',
    type: 'static' as const,
    cost: 2,
    premium: true,
    url: '/stickers/default/fox-wink.png',
  },
  {
    id: 'default-fox-love',
    name: 'Fox in Love',
    pack: 'default',
    type: 'static' as const,
    cost: 2,
    premium: true,
    url: '/stickers/default/fox-love.png',
  },
  {
    id: 'default-fox-laughing',
    name: 'Fox Laughing',
    pack: 'default',
    type: 'static' as const,
    cost: 2,
    premium: true,
    url: '/stickers/default/fox-laughing.png',
  },
];

export const stickers = writable<Sticker[]>(stickerCollections);

export const stickerStore = {
  getStickers(): Sticker[] {
    const collection: Sticker[] = [];
    stickerCollections.forEach((s) => collection.push(s));
    return collection;
  },

  getStickerById(id: string): Sticker | undefined {
    return stickerCollections.find((s) => s.id === id);
  },

  getStickersByPack(pack: string): Sticker[] {
    return stickerCollections.filter((s) => s.pack === pack);
  },

  getFreeStickers(): Sticker[] {
    return stickerCollections.filter((s) => !s.premium);
  },

  getPremiumStickers(): Sticker[] {
    return stickerCollections.filter((s) => s.premium);
  },
};
