export const suits = ["kreuz", "pik", "herz", "karo"] as const;
export const ranks = ["7", "8", "9", "10", "B", "D", "K", "A"] as const;

export type Suit = (typeof suits)[number];
export type Rank = (typeof ranks)[number];
export type Card = `${Suit}-${Rank}`;

export const fullDeck: readonly Card[] = suits.flatMap((suit) => ranks.map((rank): Card => `${suit}-${rank}`));

export function suitOf(card: Card): Suit {
  return card.slice(0, card.indexOf("-")) as Suit;
}

export function rankOf(card: Card): Rank {
  return card.slice(card.indexOf("-") + 1) as Rank;
}
