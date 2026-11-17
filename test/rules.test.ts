import { applyMove, createMatch } from "@gamehearth/sdk/platform";
import { describe, expect, it } from "vitest";
import { fullDeck, mauMau, startingHandSize } from "../src";
import { matchFrom, movesOf, play, top } from "./helpers";

describe("Austeilen", () => {
  it.each([2, 3, 4, 5, 6])("verteilt bei %i Spielern alle 32 Karten genau einmal", (playerCount) => {
    const outcome = createMatch(mauMau, { playerCount, seed: `austeilen-${playerCount}` });
    if (!outcome.ok) throw new Error(outcome.error.message);
    const { state } = outcome.match;
    const hands = Object.values(state.players).map((own) => own.hand);
    for (const hand of hands) {
      expect(hand).toHaveLength(startingHandSize);
    }
    expect(state.public.discard).toHaveLength(1);
    expect(state.secret.deck).toHaveLength(32 - playerCount * startingHandSize - 1);
    expect([...hands.flat(), ...state.public.discard, ...state.secret.deck].sort()).toEqual([...fullDeck].sort());
    expect(state.public).toMatchObject({ current: "p1", phase: "play", wish: null, penalty: 0, stuck: 0 });
    expect(state.public.deckSize).toBe(state.secret.deck.length);
    expect(Object.values(state.public.handSizes)).toEqual(new Array(playerCount).fill(startingHandSize));
  });

  it("gibt einer offenen Startkarte keine Sonderwirkung", () => {
    const startSeven = matchFrom({ hands: { p1: ["herz-9", "pik-K"], p2: ["karo-9"] }, discard: ["herz-7"] });
    expect(movesOf(startSeven, "p1")).toEqual([{ type: "play", card: "herz-9" }]);
    const startJack = matchFrom({ hands: { p1: ["herz-9", "pik-B", "kreuz-9"], p2: ["karo-9"] }, discard: ["herz-B"] });
    expect(movesOf(startJack, "p1")).toEqual([{ type: "play", card: "herz-9" }]);
  });
});

describe("Bedienen", () => {
  const table = matchFrom({
    hands: { p1: ["herz-K", "pik-9", "pik-K"], p2: ["karo-8", "karo-D"], p3: ["kreuz-8"] },
    discard: ["herz-9"],
    deck: ["karo-A", "kreuz-A"],
  });

  it("bietet nur Karten gleicher Farbe oder gleichen Werts an", () => {
    expect(movesOf(table, "p1")).toEqual([
      { type: "play", card: "herz-K" },
      { type: "play", card: "pik-9" },
    ]);
  });

  it("gibt nur dem Sitz Züge, der dran ist", () => {
    expect(movesOf(table, "p2")).toEqual([]);
    expect(movesOf(table, "p3")).toEqual([]);
  });

  it("legt die Karte ab und gibt weiter", () => {
    const next = play(table, "p1", { type: "play", card: "pik-9" });
    expect(top(next)).toBe("pik-9");
    expect(next.state.players["p1"]?.hand).toEqual(["herz-K", "pik-K"]);
    expect(next.state.public).toMatchObject({ current: "p2", handSizes: { p1: 2, p2: 2, p3: 1 } });
  });

  it("lässt nur ziehen, wenn nichts passt", () => {
    const stuck = matchFrom({ hands: { p1: ["pik-K"], p2: ["karo-8"] }, discard: ["herz-9"], deck: ["karo-A"] });
    expect(movesOf(stuck, "p1")).toEqual([{ type: "draw" }]);
  });
});

describe("Ziehen", () => {
  it("nimmt eine Karte und lässt sie sofort legen, wenn sie passt", () => {
    const table = matchFrom({ hands: { p1: ["pik-K"], p2: ["karo-8"] }, discard: ["herz-9"], deck: ["kreuz-7", "herz-A"] });
    const drawn = play(table, "p1", { type: "draw" });
    expect(drawn.state.players["p1"]).toEqual({ hand: ["pik-K", "herz-A"], drawn: "herz-A" });
    expect(drawn.state.public).toMatchObject({ current: "p1", phase: "drawn", deckSize: 1 });
    expect(movesOf(drawn, "p1")).toEqual([{ type: "play", card: "herz-A" }, { type: "pass" }]);
  });

  it("lässt nur passen, wenn die gezogene Karte nicht passt", () => {
    const table = matchFrom({ hands: { p1: ["pik-K"], p2: ["karo-8"] }, discard: ["herz-9"], deck: ["kreuz-7"] });
    const drawn = play(table, "p1", { type: "draw" });
    expect(movesOf(drawn, "p1")).toEqual([{ type: "pass" }]);
    const passed = play(drawn, "p1", { type: "pass" });
    expect(passed.state.public).toMatchObject({ current: "p2", phase: "play" });
    expect(passed.state.players["p1"]).toEqual({ hand: ["pik-K", "kreuz-7"], drawn: null });
  });

  it("verrät öffentlich nicht, ob die gezogene Karte passt", () => {
    const fitting = play(matchFrom({ hands: { p1: ["pik-K"], p2: ["karo-8"] }, discard: ["herz-9"], deck: ["herz-A"] }), "p1", {
      type: "draw",
    });
    const notFitting = play(matchFrom({ hands: { p1: ["pik-K"], p2: ["karo-8"] }, discard: ["herz-9"], deck: ["kreuz-7"] }), "p1", {
      type: "draw",
    });
    expect(fitting.state.public).toEqual(notFitting.state.public);
  });

  it("mischt die Ablage außer der obersten Karte neu, wenn der Stapel leer ist", () => {
    const table = matchFrom({
      hands: { p1: ["pik-K"], p2: ["karo-8"] },
      discard: ["kreuz-7", "kreuz-8", "kreuz-D", "herz-9"],
      deck: [],
    });
    const drawn = play(table, "p1", { type: "draw" });
    expect(drawn.state.public.discard).toEqual(["herz-9"]);
    expect(drawn.state.public.deckSize).toBe(2);
    const own = drawn.state.players["p1"];
    expect(["kreuz-7", "kreuz-8", "kreuz-D"]).toContain(own?.drawn);
    expect([...(own?.hand ?? []), ...drawn.state.secret.deck].sort()).toEqual(["kreuz-7", "kreuz-8", "kreuz-D", "pik-K"].sort());
  });
});

describe("7", () => {
  const table = matchFrom({
    hands: { p1: ["herz-7", "pik-K"], p2: ["pik-7", "herz-K"], p3: ["karo-9", "kreuz-7"] },
    discard: ["herz-9"],
    deck: ["kreuz-A", "kreuz-K", "kreuz-D", "kreuz-B", "karo-A"],
  });

  it("lässt den Nächsten 2 Karten ziehen oder eine 7 drauflegen", () => {
    const next = play(table, "p1", { type: "play", card: "herz-7" });
    expect(next.state.public).toMatchObject({ current: "p2", penalty: 2 });
    expect(movesOf(next, "p2")).toEqual([{ type: "play", card: "pik-7" }, { type: "draw" }]);
  });

  it("addiert gestapelte 7en, und wer zieht, ist danach fertig", () => {
    let match = play(table, "p1", { type: "play", card: "herz-7" });
    match = play(match, "p2", { type: "play", card: "pik-7" });
    expect(match.state.public).toMatchObject({ current: "p3", penalty: 4 });
    expect(movesOf(match, "p3")).toEqual([{ type: "play", card: "kreuz-7" }, { type: "draw" }]);
    match = play(match, "p3", { type: "draw" });
    expect(match.state.players["p3"]?.hand).toHaveLength(6);
    expect(match.state.public).toMatchObject({ current: "p1", penalty: 0, phase: "play" });
  });

  it("gibt nur so viele Strafkarten, wie es noch gibt", () => {
    const short = matchFrom({
      hands: { p1: ["herz-K"], p2: ["pik-K", "pik-D"] },
      discard: ["herz-7"],
      deck: ["kreuz-A"],
      current: "p2",
      penalty: 4,
    });
    const after = play(short, "p2", { type: "draw" });
    expect(after.state.players["p2"]?.hand).toHaveLength(3);
    expect(after.state.public).toMatchObject({ penalty: 0, current: "p1", deckSize: 0 });
  });
});

describe("8", () => {
  it("lässt bei drei Spielern den Nächsten aussetzen", () => {
    const table = matchFrom({ hands: { p1: ["herz-8", "pik-K"], p2: ["herz-K"], p3: ["karo-K"] }, discard: ["herz-9"] });
    expect(play(table, "p1", { type: "play", card: "herz-8" }).state.public.current).toBe("p3");
  });

  it("lässt bei zwei Spielern denselben Spieler noch einmal ran", () => {
    const table = matchFrom({ hands: { p1: ["herz-8", "pik-K"], p2: ["herz-K"] }, discard: ["herz-9"] });
    expect(play(table, "p1", { type: "play", card: "herz-8" }).state.public.current).toBe("p1");
  });
});

describe("Bube", () => {
  const table = matchFrom({
    hands: { p1: ["pik-B", "herz-K"], p2: ["kreuz-B", "karo-9", "karo-K", "herz-D"] },
    discard: ["herz-9"],
    deck: ["kreuz-A"],
  });

  it("darf auf jede Karte und bietet einen Zug pro Wunschfarbe an", () => {
    expect(movesOf(table, "p1")).toEqual([
      { type: "play", card: "pik-B", wish: "kreuz" },
      { type: "play", card: "pik-B", wish: "pik" },
      { type: "play", card: "pik-B", wish: "herz" },
      { type: "play", card: "pik-B", wish: "karo" },
      { type: "play", card: "herz-K" },
    ]);
  });

  it("verlangt danach die gewünschte Farbe und verbietet Bube auf Bube", () => {
    const wished = play(table, "p1", { type: "play", card: "pik-B", wish: "karo" });
    expect(wished.state.public).toMatchObject({ wish: "karo", current: "p2" });
    expect(movesOf(wished, "p2")).toEqual([
      { type: "play", card: "karo-9" },
      { type: "play", card: "karo-K" },
    ]);
  });

  it("hebt den Wunsch auf, sobald darauf gelegt wurde", () => {
    const wished = play(table, "p1", { type: "play", card: "pik-B", wish: "karo" });
    expect(play(wished, "p2", { type: "play", card: "karo-9" }).state.public.wish).toBeNull();
  });

  it("lässt ziehen, wenn die gewünschte Farbe fehlt", () => {
    const wished = play(table, "p1", { type: "play", card: "pik-B", wish: "pik" });
    expect(movesOf(wished, "p2")).toEqual([{ type: "draw" }]);
  });
});

describe("Ass", () => {
  const table = matchFrom({
    hands: { p1: ["herz-A", "pik-A", "pik-9", "karo-K"], p2: ["karo-D", "kreuz-D"] },
    discard: ["herz-9"],
    deck: ["kreuz-K"],
  });

  it("verlangt nach einem Ass eine weitere passende Karte, ohne Passen", () => {
    const ace = play(table, "p1", { type: "play", card: "herz-A" });
    expect(ace.state.public).toMatchObject({ current: "p1", phase: "play" });
    expect(movesOf(ace, "p1")).toEqual([{ type: "play", card: "pik-A" }]);
    expect(movesOf(ace, "p2")).toEqual([]);
  });

  it("erlaubt Ass auf Ass und verlangt danach eine Karte der neuen Farbe", () => {
    let match = play(table, "p1", { type: "play", card: "herz-A" });
    match = play(match, "p1", { type: "play", card: "pik-A" });
    expect(match.state.public).toMatchObject({ current: "p1", phase: "play" });
    expect(movesOf(match, "p1")).toEqual([{ type: "play", card: "pik-9" }]);
    match = play(match, "p1", { type: "play", card: "pik-9" });
    expect(match.state.public).toMatchObject({ current: "p2", phase: "play" });
  });

  it("lässt nach einem Ass eine Karte ziehen, wenn nichts passt, und eine passende sofort legen", () => {
    const lucky = matchFrom({
      hands: { p1: ["herz-A", "karo-K"], p2: ["karo-D"] },
      discard: ["herz-9"],
      deck: ["herz-D"],
    });
    let match = play(lucky, "p1", { type: "play", card: "herz-A" });
    expect(movesOf(match, "p1")).toEqual([{ type: "draw" }]);
    match = play(match, "p1", { type: "draw" });
    expect(match.state.public).toMatchObject({ current: "p1", phase: "drawn" });
    expect(movesOf(match, "p1")).toEqual([{ type: "play", card: "herz-D" }, { type: "pass" }]);
    match = play(match, "p1", { type: "play", card: "herz-D" });
    expect(match.state.public).toMatchObject({ current: "p2", phase: "play" });
  });

  it("gibt nach dem Ziehen an den Nächsten weiter, wenn auch die gezogene Karte nicht passt", () => {
    const unlucky = matchFrom({
      hands: { p1: ["herz-A", "karo-K"], p2: ["karo-D"] },
      discard: ["herz-9"],
      deck: ["kreuz-D"],
    });
    let match = play(play(unlucky, "p1", { type: "play", card: "herz-A" }), "p1", { type: "draw" });
    expect(movesOf(match, "p1")).toEqual([{ type: "pass" }]);
    match = play(match, "p1", { type: "pass" });
    expect(match.state.public).toMatchObject({ current: "p2", phase: "play" });
    expect(match.state.players["p1"]?.hand).toEqual(["karo-K", "kreuz-D"]);
  });

  it("wirkt mit einer nachgelegten 7 wie eine normale 7", () => {
    const sevens = matchFrom({ hands: { p1: ["herz-A", "herz-7", "pik-K"], p2: ["karo-D"] }, discard: ["herz-9"] });
    const match = play(play(sevens, "p1", { type: "play", card: "herz-A" }), "p1", { type: "play", card: "herz-7" });
    expect(match.state.public).toMatchObject({ current: "p2", penalty: 2 });
  });
});

describe("Ende", () => {
  it.each([
    ["eine normale Karte", "herz-K"],
    ["ein Ass", "herz-A"],
    ["eine 8", "herz-8"],
    ["einen Buben", "herz-B"],
  ] as const)("beendet die Partie, wenn jemand %s als letzte Karte legt", (_name, card) => {
    const table = matchFrom({ hands: { p1: [card], p2: ["karo-D"] }, discard: ["herz-9"] });
    const action = card === "herz-B" ? { type: "play" as const, card, wish: "pik" as const } : { type: "play" as const, card };
    const finished = play(table, "p1", action);
    expect(finished.result).toEqual({ winners: ["p1"] });
    expect(applyMove(mauMau, finished, { player: "p2", action: { type: "draw" }, now: 0 }).ok).toBe(false);
  });

  it("endet, wenn niemand mehr legen oder ziehen kann, und gibt den Sieg an die wenigsten Karten", () => {
    let match = matchFrom({
      hands: { p1: ["pik-K", "pik-D"], p2: ["kreuz-K"], p3: ["karo-K", "karo-D", "kreuz-8"] },
      discard: ["herz-9"],
      deck: [],
    });
    for (const player of ["p1", "p2"]) {
      expect(movesOf(match, player)).toEqual([{ type: "draw" }]);
      match = play(match, player, { type: "draw" });
      expect(match.result).toBeUndefined();
    }
    match = play(match, "p3", { type: "draw" });
    expect(match.result).toEqual({ winners: ["p2"] });
  });

  it("setzt die Zählung zurück, sobald jemand wieder legen kann", () => {
    let match = matchFrom({
      hands: { p1: ["pik-K"], p2: ["herz-K", "kreuz-D"] },
      discard: ["herz-9"],
      deck: [],
    });
    match = play(match, "p1", { type: "draw" });
    expect(match.state.public.stuck).toBe(1);
    match = play(match, "p2", { type: "play", card: "herz-K" });
    expect(match.state.public.stuck).toBe(0);
    expect(match.result).toBeUndefined();
  });
});
