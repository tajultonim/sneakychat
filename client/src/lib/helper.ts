import emojis from './emoji-set.json';

export function isEmoji(text: string) {
  // Regex covers most emoji characters

  let emojilist: string[] = [];
  Object.values(emojis).forEach((c) => {
    emojilist = emojilist.concat(c.emojis);
  });

  return emojilist.includes(text);
  //   const emojiRegex = /^\p{Extended_Pictographic}(?:\u200D\p{Extended_Pictographic})*$/u;
  //   return emojiRegex.test(text);
}
