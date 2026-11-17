import { defineGame, type GameState, type PlayerId, type Random } from "@gamehearth/sdk";
import { fullDeck, rankOf, suitOf, suits, type Card, type Suit } from "./cards";

export const startingHandSize = 5;
export const sevenPenalty = 2;

export type Phase = "play" | "drawn";

export interface Public {
  discard: Card[];
  current: PlayerId;
  phase: Phase;
  wish: Suit | null;
  penalty: number;
  handSizes: Record<PlayerId, number>;
  deckSize: number;
  stuck: number;
}

export interface Hand {
  hand: Card[];
  drawn: Card | null;
}

export interface Secret {
  deck: Card[];
}

export type MauMauState = GameState<Public, Hand, Secret>;

export type MauMauAction = { type: "play"; card: Card; wish?: Suit } | { type: "draw" } | { type: "pass" };

export const mauMau = defineGame<MauMauState, MauMauAction>({
  setup({ players, random }) {
    const deck = random.shuffle(fullDeck);
    const hands: Record<PlayerId, Hand> = {};
    for (const player of players) {
      hands[player] = { hand: deck.splice(0, startingHandSize), drawn: null };
    }
    const first = deck.pop();
    if (first === undefined || players[0] === undefined) {
      throw new Error(`Mau-Mau braucht mindestens einen Spieler und genug Karten, bekam ${players.length} Spieler`);
    }
    const state: MauMauState = {
      public: {
        discard: [first],
        current: players[0],
        phase: "play",
        wish: null,
        penalty: 0,
        handSizes: {},
        deckSize: 0,
        stuck: 0,
      },
      players: hands,
      secret: { deck },
    };
    updateCounts(state);
    return state;
  },

  legalMoves(state, player) {
    if (player !== state.public.current) {
      return [];
    }
    const own = handOf(state, player);
    if (state.public.phase === "drawn") {
      const plays = own.drawn !== null && fits(state, own.drawn) ? playMoves(own.drawn) : [];
      return [...plays, { type: "pass" }];
    }
    const plays = own.hand.filter((card) => fits(state, card)).flatMap(playMoves);
    if (state.public.penalty > 0) {
      return [...plays, { type: "draw" }];
    }
    return plays.length > 0 ? plays : [{ type: "draw" }];
  },

  apply(state, action, { player, players, random }) {
    switch (action.type) {
      case "play":
        playCard(state, player, players, action.card, action.wish);
        break;
      case "draw":
        drawCards(state, player, players, random);
        break;
      case "pass":
        endTurn(state, players, 1);
        break;
    }
    updateCounts(state);
  },

  result(state) {
    const finished = Object.keys(state.players).filter((player) => handOf(state, player).hand.length === 0);
    if (finished.length > 0) {
      return { winners: finished };
    }
    const seats = Object.keys(state.players);
    if (state.public.stuck >= seats.length) {
      const fewest = Math.min(...seats.map((player) => handOf(state, player).hand.length));
      return { winners: seats.filter((player) => handOf(state, player).hand.length === fewest) };
    }
    return undefined;
  },
});

export function topCard(state: MauMauState): Card {
  const top = state.public.discard[state.public.discard.length - 1];
  if (top === undefined) {
    throw new Error("Der Ablagestapel ist leer");
  }
  return top;
}

export function fits(state: MauMauState, card: Card): boolean {
  const top = topCard(state);
  if (state.public.penalty > 0) {
    return rankOf(card) === "7";
  }
  if (rankOf(card) === "B") {
    return rankOf(top) !== "B";
  }
  if (state.public.wish !== null) {
    return suitOf(card) === state.public.wish;
  }
  return suitOf(card) === suitOf(top) || rankOf(card) === rankOf(top);
}

function playMoves(card: Card): MauMauAction[] {
  return rankOf(card) === "B" ? suits.map((wish) => ({ type: "play", card, wish })) : [{ type: "play", card }];
}

function handOf(state: MauMauState, player: PlayerId): Hand {
  const own = state.players[player];
  if (own === undefined) {
    throw new Error(`Sitz ${player} hat keine Hand`);
  }
  return own;
}

function playCard(
  state: MauMauState,
  player: PlayerId,
  players: readonly PlayerId[],
  card: Card,
  wish: Suit | undefined,
): void {
  const own = handOf(state, player);
  own.hand = own.hand.filter((held) => held !== card);
  own.drawn = null;
  state.public.discard.push(card);
  state.public.wish = null;
  state.public.stuck = 0;
  if (own.hand.length === 0) {
    state.public.phase = "play";
    return;
  }
  switch (rankOf(card)) {
    case "7":
      state.public.penalty += sevenPenalty;
      endTurn(state, players, 1);
      break;
    case "8":
      endTurn(state, players, 2);
      break;
    case "B":
      state.public.wish = wish ?? suitOf(card);
      endTurn(state, players, 1);
      break;
    case "A":
      state.public.phase = "play";
      break;
    default:
      endTurn(state, players, 1);
  }
}

function drawCards(state: MauMauState, player: PlayerId, players: readonly PlayerId[], random: Random): void {
  const own = handOf(state, player);
  if (state.public.penalty > 0) {
    const taken = takeCards(state, own, state.public.penalty, random);
    state.public.penalty = 0;
    state.public.stuck = taken.length === 0 ? state.public.stuck + 1 : 0;
    endTurn(state, players, 1);
    return;
  }
  const [card] = takeCards(state, own, 1, random);
  if (card === undefined) {
    state.public.stuck += 1;
    endTurn(state, players, 1);
    return;
  }
  state.public.stuck = 0;
  own.drawn = card;
  state.public.phase = "drawn";
}

function takeCards(state: MauMauState, own: Hand, count: number, random: Random): Card[] {
  const taken: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (state.secret.deck.length === 0) {
      reshuffle(state, random);
    }
    const card = state.secret.deck.pop();
    if (card === undefined) {
      break;
    }
    own.hand.push(card);
    taken.push(card);
  }
  return taken;
}

function reshuffle(state: MauMauState, random: Random): void {
  const top = topCard(state);
  const rest = state.public.discard.slice(0, -1);
  state.public.discard = [top];
  state.secret.deck = random.shuffle(rest);
}

function endTurn(state: MauMauState, players: readonly PlayerId[], steps: number): void {
  handOf(state, state.public.current).drawn = null;
  const index = players.indexOf(state.public.current);
  state.public.current = players[(index + steps) % players.length] ?? state.public.current;
  state.public.phase = "play";
}

function updateCounts(state: MauMauState): void {
  for (const [player, own] of Object.entries(state.players)) {
    state.public.handSizes[player] = own.hand.length;
  }
  state.public.deckSize = state.secret.deck.length;
}
