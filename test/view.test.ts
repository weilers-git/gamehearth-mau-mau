import { describe, expect, it } from "vitest";
import {
  cardName,
  cardParts,
  choices,
  depths,
  describeMove,
  describeTable,
  drawLabel,
  handSlots,
  opponents,
  resultText,
  seatSlots,
  sortHand,
  statusLine,
  tilt,
  wishMove,
  type Players,
  type Snapshot,
} from "../client/src/view";
import type { MauMauAction } from "../src/index";

const players: Players = {
  p1: { name: "Anna", connected: true, you: true },
  p2: { name: "Ben", connected: true, you: false },
  p3: { name: "Clara", connected: false, you: false },
};

function snapshot(overrides: Partial<Snapshot["public"]> = {}, moves: MauMauAction[] = [], extra: Partial<Snapshot> = {}): Snapshot {
  return {
    player: "p1",
    players: ["p1", "p2", "p3"],
    public: { discard: ["herz-9"], current: "p1", phase: "play", wish: null, penalty: 0, handSizes: { p1: 3, p2: 5, p3: 4 }, deckSize: 12, stuck: 0, ...overrides },
    me: { hand: ["karo-K", "herz-7", "kreuz-B"], drawn: null },
    moves,
    version: 4,
    ...extra,
  };
}

describe("Karten", () => {
  it("zerlegt Karten und nennt sie lesbar", () => {
    expect(cardParts("herz-10")).toEqual({ suit: "herz", rank: "10", red: true });
    expect(cardParts("pik-B")).toEqual({ suit: "pik", rank: "B", red: false });
    expect(cardName("karo-A")).toBe("Karo Ass");
    expect(cardName("kreuz-D")).toBe("Kreuz Dame");
  });

  it("sortiert die Hand nach Farbe und Wert", () => {
    expect(sortHand(["karo-7", "herz-A", "kreuz-10", "herz-8", "pik-B", "kreuz-7"])).toEqual(["kreuz-7", "kreuz-10", "pik-B", "herz-8", "herz-A", "karo-7"]);
  });

  it("dreht jede Karte auf dem Stapel immer gleich und nur leicht", () => {
    expect(tilt("herz-7")).toBe(tilt("herz-7"));
    for (const card of ["herz-7", "pik-A", "karo-10", "kreuz-B"] as const) {
      expect(Math.abs(tilt(card))).toBeLessThanOrEqual(9.6);
    }
  });
});

describe("Züge", () => {
  const moves: MauMauAction[] = [
    { type: "play", card: "herz-7" },
    { type: "play", card: "kreuz-B", wish: "kreuz" },
    { type: "play", card: "kreuz-B", wish: "pik" },
    { type: "play", card: "kreuz-B", wish: "herz" },
    { type: "play", card: "kreuz-B", wish: "karo" },
    { type: "draw" },
  ];

  it("ordnet Züge den Karten zu und findet Ziehen und Behalten", () => {
    const options = choices(moves);
    expect([...options.plays.keys()]).toEqual(["herz-7", "kreuz-B"]);
    expect(options.plays.get("kreuz-B")).toHaveLength(4);
    expect(options.draw).toEqual({ type: "draw" });
    expect(options.pass).toBeUndefined();
    expect(wishMove(options.plays.get("kreuz-B") ?? [], "herz")).toEqual({ type: "play", card: "kreuz-B", wish: "herz" });
  });

  it("beschreibt Züge für Screenreader und Tests", () => {
    const state = snapshot({ penalty: 4 });
    expect(describeMove({ type: "play", card: "herz-7" }, state)).toBe("Herz 7 legen");
    expect(describeMove({ type: "play", card: "kreuz-B", wish: "karo" }, state)).toBe("Kreuz Bube legen, Wunsch Karo");
    expect(describeMove({ type: "draw" }, state)).toBe("4 Karten ziehen");
    expect(describeMove({ type: "pass" }, state)).toBe("Behalten");
    expect(drawLabel(snapshot())).toBe("Ziehen");
  });
});

describe("Statuszeile", () => {
  it("sagt, wer dran ist", () => {
    expect(statusLine(snapshot({ current: "p2" }), players)).toEqual({ text: "Ben ist dran", mine: false });
    expect(statusLine(snapshot({}, [{ type: "play", card: "herz-7" }]), players)).toEqual({ text: "Du bist dran", mine: true });
    expect(statusLine(snapshot({}, [{ type: "draw" }]), players).text).toBe("Du bist dran: nichts passt, ziehen");
  });

  it("erklärt Strafkarten und die gezogene Karte", () => {
    expect(statusLine(snapshot({ penalty: 2 }, [{ type: "play", card: "herz-7" }, { type: "draw" }]), players).text).toBe("Eine 7 legen oder 2 Karten ziehen");
    expect(statusLine(snapshot({ penalty: 4 }, [{ type: "draw" }]), players).text).toBe("Du musst 4 Karten ziehen");
    expect(statusLine(snapshot({ phase: "drawn" }, [{ type: "play", card: "herz-7" }, { type: "pass" }]), players).text).toBe("Gezogene Karte legen oder behalten");
    expect(statusLine(snapshot({ phase: "drawn" }, [{ type: "pass" }]), players).text).toBe("Passt nicht, behalten");
  });

  it("nennt Sieger, Unentschieden und den eigenen Sieg", () => {
    expect(resultText({ winners: ["p1"] }, players, "p1")).toBe("Du hast gewonnen!");
    expect(resultText({ winners: ["p2"] }, players, "p1")).toBe("Ben hat gewonnen");
    expect(resultText({ winners: ["p1", "p2", "p3"] }, players, "p1")).toBe("Unentschieden: du, Ben und Clara");
    expect(resultText({ winners: [] }, players, "p1")).toBe("Niemand hat gewonnen");
    expect(statusLine(snapshot({}, [], { result: { winners: ["p3"] } }), players).text).toBe("Clara hat gewonnen");
  });

  it("beschreibt den Tisch ohne verdeckte Karten anderer", () => {
    const text = describeTable(snapshot({ wish: "pik" }), players);
    expect(text).toBe("Oben liegt Herz 9. Gewünscht ist Pik. Deine Karten: Kreuz Bube, Herz 7, Karo König. Ben hat 5 Karten. Clara hat 4 Karten.");
  });
});

describe("Layout", () => {
  it("legt Dialoge über jede Hand, auch mit allen 32 Karten", () => {
    expect(depths.overlay).toBeGreaterThan(depths.hand + 32);
    expect(depths.hand).toBeGreaterThan(depths.pile + 3);
  });


  it("setzt Gegner in Zugreihenfolge nach dem eigenen Sitz", () => {
    expect(opponents("p2", ["p1", "p2", "p3", "p4"])).toEqual(["p3", "p4", "p1"]);
    expect(opponents("p9", ["p1", "p2"])).toEqual(["p1", "p2"]);
    expect(seatSlots(3, 400, 10).map((slot) => slot.x)).toEqual([100, 200, 300]);
  });

  it("legt die Hand mittig und bleibt im Bild, auch mit vielen Karten", () => {
    const width = 390;
    const cardWidth = 80;
    for (const count of [1, 5, 12, 25]) {
      const slots = handSlots(count, width, 800, cardWidth, 116);
      expect(slots).toHaveLength(count);
      for (const slot of slots) {
        expect(slot.x - cardWidth / 2).toBeGreaterThanOrEqual(0);
        expect(slot.x + cardWidth / 2).toBeLessThanOrEqual(width);
      }
    }
    const one = handSlots(1, width, 800, cardWidth, 116)[0];
    expect(one?.x).toBe(width / 2);
    const many = handSlots(25, width, 800, cardWidth, 116);
    expect(new Set(many.map((slot) => slot.y)).size).toBeGreaterThan(1);
    expect(handSlots(0, width, 800, cardWidth, 116)).toEqual([]);
  });
});
