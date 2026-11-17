import type { GameResult, PlayerId, PlayerInfo, PlayerSnapshot } from "@gamehearth/sdk/client";
import type { Card, Hand, MauMauAction, Public, Rank, Suit } from "../../src/index";

export type Snapshot = PlayerSnapshot<Public, Hand, MauMauAction>;
export type Players = Record<PlayerId, PlayerInfo>;

export const depths = { pile: 10, hand: 200, overlay: 1000 } as const;

export const suitOrder: readonly Suit[] = ["kreuz", "pik", "herz", "karo"];
export const rankOrder: readonly Rank[] = ["7", "8", "9", "10", "B", "D", "K", "A"];

export const suitNames: Record<Suit, string> = { kreuz: "Kreuz", pik: "Pik", herz: "Herz", karo: "Karo" };
const rankNames: Record<Rank, string> = { "7": "7", "8": "8", "9": "9", "10": "10", B: "Bube", D: "Dame", K: "König", A: "Ass" };

export interface CardParts {
  suit: Suit;
  rank: Rank;
  red: boolean;
}

export function cardParts(card: Card): CardParts {
  const at = card.indexOf("-");
  const suit = card.slice(0, at) as Suit;
  const rank = card.slice(at + 1) as Rank;
  return { suit, rank, red: suit === "herz" || suit === "karo" };
}

export function cardName(card: Card): string {
  const { suit, rank } = cardParts(card);
  return `${suitNames[suit]} ${rankNames[rank]}`;
}

export function sortHand(cards: readonly Card[]): Card[] {
  const key = (card: Card) => {
    const { suit, rank } = cardParts(card);
    return suitOrder.indexOf(suit) * 10 + rankOrder.indexOf(rank);
  };
  return [...cards].sort((a, b) => key(a) - key(b));
}

export interface Choices {
  plays: Map<Card, MauMauAction[]>;
  draw: MauMauAction | undefined;
  pass: MauMauAction | undefined;
}

export function choices(moves: readonly MauMauAction[]): Choices {
  const plays = new Map<Card, MauMauAction[]>();
  let draw: MauMauAction | undefined;
  let pass: MauMauAction | undefined;
  for (const move of moves) {
    if (move.type === "play") {
      plays.set(move.card, [...(plays.get(move.card) ?? []), move]);
    } else if (move.type === "draw") {
      draw = move;
    } else {
      pass = move;
    }
  }
  return { plays, draw, pass };
}

export function wishMove(options: readonly MauMauAction[], wish: Suit): MauMauAction | undefined {
  return options.find((move) => move.type === "play" && move.wish === wish);
}

export function opponents(seat: PlayerId, seats: readonly PlayerId[]): PlayerId[] {
  const at = seats.indexOf(seat);
  return at < 0 ? [...seats] : [...seats.slice(at + 1), ...seats.slice(0, at)];
}

export function nameOf(players: Players, seat: PlayerId): string {
  return players[seat]?.name ?? seat;
}

export function drawLabel(snapshot: Snapshot): string {
  const penalty = snapshot.public.penalty;
  return penalty > 0 ? `${penalty} Karten ziehen` : "Ziehen";
}

export function statusLine(snapshot: Snapshot, players: Players): { text: string; mine: boolean } {
  if (snapshot.result !== undefined) {
    return { text: resultText(snapshot.result, players, snapshot.player), mine: false };
  }
  const current = snapshot.public.current;
  if (current !== snapshot.player) {
    return { text: `${nameOf(players, current)} ist dran`, mine: false };
  }
  const options = choices(snapshot.moves);
  if (snapshot.public.phase === "drawn") {
    return { text: options.plays.size > 0 ? "Gezogene Karte legen oder behalten" : "Passt nicht, behalten", mine: true };
  }
  if (snapshot.public.penalty > 0) {
    return {
      text: options.plays.size > 0 ? `Eine 7 legen oder ${snapshot.public.penalty} Karten ziehen` : `Du musst ${snapshot.public.penalty} Karten ziehen`,
      mine: true,
    };
  }
  return { text: options.plays.size > 0 ? "Du bist dran" : "Du bist dran: nichts passt, ziehen", mine: true };
}

export function resultText(result: GameResult, players: Players, seat: PlayerId): string {
  const winners = result.winners;
  if (winners.length === 0) {
    return "Niemand hat gewonnen";
  }
  if (winners.length === 1) {
    return winners[0] === seat ? "Du hast gewonnen!" : `${nameOf(players, winners[0] as PlayerId)} hat gewonnen`;
  }
  const names = winners.map((winner) => (winner === seat ? "du" : nameOf(players, winner)));
  return `Unentschieden: ${names.slice(0, -1).join(", ")} und ${names[names.length - 1] ?? ""}`;
}

export interface Slot {
  x: number;
  y: number;
}

export function handSlots(count: number, width: number, bottom: number, cardWidth: number, cardHeight: number): Slot[] {
  if (count === 0) {
    return [];
  }
  const margin = cardWidth * 0.25;
  const available = Math.max(width - 2 * margin, cardWidth);
  const minStep = cardWidth * 0.36;
  const perRow = Math.max(1, Math.min(count, Math.floor((available - cardWidth) / minStep) + 1));
  const rows = Math.ceil(count / perRow);
  const slots: Slot[] = [];
  for (let row = 0; row < rows; row++) {
    const inRow = Math.min(perRow, count - row * perRow);
    const step = inRow > 1 ? Math.min(cardWidth * 0.72, (available - cardWidth) / (inRow - 1)) : 0;
    const total = cardWidth + step * (inRow - 1);
    const startX = (width - total) / 2 + cardWidth / 2;
    const y = bottom - cardHeight / 2 - (rows - 1 - row) * cardHeight * 0.42;
    for (let index = 0; index < inRow; index++) {
      slots.push({ x: startX + index * step, y });
    }
  }
  return slots;
}

export function seatSlots(count: number, width: number, top: number): Slot[] {
  return Array.from({ length: count }, (_, index) => ({ x: (width * (index + 1)) / (count + 1), y: top }));
}

export function tilt(card: Card): number {
  let hash = 0;
  for (let index = 0; index < card.length; index++) {
    hash = (hash * 31 + card.charCodeAt(index)) | 0;
  }
  return ((Math.abs(hash) % 17) - 8) * 1.2;
}

export function describeMove(move: MauMauAction, snapshot: Snapshot): string {
  if (move.type === "draw") {
    return drawLabel(snapshot);
  }
  if (move.type === "pass") {
    return "Behalten";
  }
  return move.wish === undefined ? `${cardName(move.card)} legen` : `${cardName(move.card)} legen, Wunsch ${suitNames[move.wish]}`;
}

export function describeTable(snapshot: Snapshot, players: Players): string {
  const top = snapshot.public.discard[snapshot.public.discard.length - 1];
  const parts = [
    top === undefined ? "" : `Oben liegt ${cardName(top)}.`,
    snapshot.public.wish === null ? "" : `Gewünscht ist ${suitNames[snapshot.public.wish]}.`,
    `Deine Karten: ${sortHand(snapshot.me.hand).map(cardName).join(", ") || "keine"}.`,
    ...opponents(snapshot.player, snapshot.players).map((seat) => `${nameOf(players, seat)} hat ${snapshot.public.handSizes[seat] ?? 0} Karten.`),
  ];
  return parts.filter((part) => part !== "").join(" ");
}
