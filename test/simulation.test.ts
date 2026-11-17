import {
  SeededRandom,
  applyMove,
  createMatch,
  playerSnapshot,
  randomStateFromSeed,
  screenSnapshot,
  type Move,
} from "@gamehearth/sdk/platform";
import { describe, expect, it } from "vitest";
import { fullDeck, mauMau, rankOf, type Card, type MauMauAction } from "../src";
import type { MauMauMatch } from "./helpers";

const gamesPerPlayerCount = 60;
const maxMoves = 3000;

interface Played {
  final: MauMauMatch;
  moves: Move<MauMauAction>[];
  steps: number;
}

function checkInvariants(match: MauMauMatch): void {
  const { state } = match;
  const hands = match.players.map((player) => state.players[player]?.hand ?? []);
  const everyCard = [...hands.flat(), ...state.public.discard, ...state.secret.deck].sort();
  expect(everyCard).toEqual([...fullDeck].sort());

  for (const player of match.players) {
    expect(state.public.handSizes[player]).toBe(state.players[player]?.hand.length);
    const drawn = state.players[player]?.drawn ?? null;
    if (state.public.phase === "drawn" && player === state.public.current) {
      expect(drawn).not.toBeNull();
      expect(state.players[player]?.hand).toContain(drawn);
    } else {
      expect(drawn).toBeNull();
    }
  }
  expect(state.public.deckSize).toBe(state.secret.deck.length);
  expect(state.public.penalty % 2).toBe(0);
  expect(state.public.penalty).toBeGreaterThanOrEqual(0);
  const top = state.public.discard.at(-1) as Card;
  if (state.public.wish !== null) {
    expect(rankOf(top)).toBe("B");
  }
  if (state.public.penalty > 0) {
    expect(rankOf(top)).toBe("7");
  }
  if (match.result === undefined) {
    const active = match.players.filter((player) => (match.moves[player] ?? []).length > 0);
    expect(active).toEqual([state.public.current]);
  }
}

function checkNoLeaks(match: MauMauMatch): void {
  const hidden = (except?: string) => [
    ...match.state.secret.deck,
    ...match.players.filter((player) => player !== except).flatMap((player) => match.state.players[player]?.hand ?? []),
  ];
  for (const player of match.players) {
    const seen = JSON.stringify(playerSnapshot(match, player));
    for (const card of hidden(player)) {
      expect(seen, `${player} sieht ${card}`).not.toContain(`"${card}"`);
    }
  }
  const screen = JSON.stringify(screenSnapshot(match));
  for (const card of hidden()) {
    expect(screen, `Bildschirm sieht ${card}`).not.toContain(`"${card}"`);
  }
}

function playRandomly(playerCount: number, seed: string): Played {
  const bot = new SeededRandom(randomStateFromSeed(`bot-${seed}`));
  const created = createMatch(mauMau, { playerCount, seed });
  if (!created.ok) throw new Error(created.error.message);
  let match = created.match;
  checkInvariants(match);
  checkNoLeaks(match);
  const moves: Move<MauMauAction>[] = [];
  let steps = 0;
  while (match.result === undefined && steps < maxMoves) {
    const player = match.state.public.current;
    const move: Move<MauMauAction> = {
      player,
      action: bot.pick(match.moves[player] ?? []),
      now: steps,
      expectedVersion: match.version,
    };
    moves.push(move);
    const outcome = applyMove(mauMau, JSON.parse(JSON.stringify(match)) as MauMauMatch, move);
    if (!outcome.ok) throw new Error(`${seed}, Zug ${steps}: ${outcome.error.code} ${outcome.error.message}`);
    match = outcome.match;
    checkInvariants(match);
    checkNoLeaks(match);
    steps += 1;
  }
  return { final: match, moves, steps };
}

describe.each([2, 3, 4, 5, 6])("Zufallspartien mit %i Spielern", (playerCount) => {
  const played = Array.from({ length: gamesPerPlayerCount }, (_, round) => {
    const seed = `mau-${playerCount}-${round}`;
    return { seed, ...playRandomly(playerCount, seed) };
  });

  it("enden alle mit einem Ergebnis", () => {
    for (const game of played) {
      expect(game.final.result, game.seed).toBeDefined();
      expect(game.steps).toBeLessThan(maxMoves);
    }
  });

  it("enden meistens dadurch, dass jemand alle Karten los ist", () => {
    const regular = played.filter((game) =>
      game.final.result?.winners.some((winner) => game.final.state.players[winner]?.hand.length === 0),
    );
    expect(regular.length).toBeGreaterThan(gamesPerPlayerCount * 0.9);
  });

  it("lassen sich aus Seed und Zügen exakt wiederholen", () => {
    for (const game of played.slice(0, 30)) {
      const created = createMatch(mauMau, { playerCount, seed: game.seed });
      if (!created.ok) throw new Error(created.error.message);
      let match = created.match;
      for (const move of game.moves) {
        const outcome = applyMove(mauMau, match, move);
        if (!outcome.ok) throw new Error(outcome.error.message);
        match = outcome.match;
      }
      expect(JSON.stringify(match)).toBe(JSON.stringify(game.final));
    }
  });
});
