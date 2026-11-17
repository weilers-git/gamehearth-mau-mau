import { applyMove, matchFormat, randomStateFromSeed, type Match } from "@gamehearth/sdk/platform";
import { mauMau, type Card, type MauMauAction, type MauMauState, type Phase, type Suit } from "../src";

export type MauMauMatch = Match<MauMauState, MauMauAction>;

export interface Table {
  hands: Record<string, Card[]>;
  discard: Card[];
  deck?: Card[];
  current?: string;
  phase?: Phase;
  wish?: Suit | null;
  penalty?: number;
  stuck?: number;
}

export function matchFrom(table: Table): MauMauMatch {
  const players = Object.keys(table.hands);
  const deck = table.deck ?? [];
  const state: MauMauState = {
    public: {
      discard: [...table.discard],
      current: table.current ?? "p1",
      phase: table.phase ?? "play",
      wish: table.wish ?? null,
      penalty: table.penalty ?? 0,
      handSizes: Object.fromEntries(players.map((player) => [player, table.hands[player]?.length ?? 0])),
      deckSize: deck.length,
      stuck: table.stuck ?? 0,
    },
    players: Object.fromEntries(players.map((player) => [player, { hand: [...(table.hands[player] ?? [])], drawn: null }])),
    secret: { deck: [...deck] },
  };
  return {
    format: matchFormat,
    seed: "tisch",
    players,
    state,
    moves: Object.fromEntries(players.map((player) => [player, mauMau.legalMoves(state, player)])),
    randomState: randomStateFromSeed("tisch"),
    version: 0,
  };
}

export function play(match: MauMauMatch, player: string, action: MauMauAction): MauMauMatch {
  const outcome = applyMove(mauMau, match, { player, action, now: 0 });
  if (!outcome.ok) {
    throw new Error(`${player}: ${JSON.stringify(action)} abgelehnt: ${outcome.error.code} ${outcome.error.message}`);
  }
  return outcome.match;
}

export function movesOf(match: MauMauMatch, player: string): MauMauAction[] {
  return match.moves[player] ?? [];
}

export function top(match: MauMauMatch): Card | undefined {
  return match.state.public.discard.at(-1);
}
