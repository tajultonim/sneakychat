export const STICKER_COSTS: Record<string, number> = {
  'bangla-apnar-buddhi-valo': 3,
  'bangla-bolen-ki': 3,
  'fluent-heart-eyes': 2,
  'fluent-laughing': 2,
  'fluent-surprise': 2,
  'fluent-crying': 2,
  'fluent-fire': 2,
  'fluent-thumbs-up': 2,
  'fluent-clap': 2,
  'fluent-party': 2,
  'default-fox-wink': 2,
  'default-fox-love': 2,
  'default-fox-laughing': 2,
};

export function getStickerCost(stickerId: string): number | null {
  if (!Object.prototype.hasOwnProperty.call(STICKER_COSTS, stickerId)) return null;
  return STICKER_COSTS[stickerId];
}
