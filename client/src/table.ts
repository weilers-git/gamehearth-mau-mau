import Phaser from "phaser";
import type { GameConnection, GameUpdate, MoveResult } from "@gamehearth/sdk/client";
import type { Card, MauMauAction, MauMauState, Suit } from "../../src/index";
import { backKey, cardRatio, createTextures, faceKey, feltKey, suitKey, type TextureSink } from "./art";
import {
  choices,
  depths,
  drawLabel,
  handSlots,
  opponents,
  seatSlots,
  sortHand,
  statusLine,
  suitNames,
  suitOrder,
  tilt,
  wishMove,
  type Players,
  type Slot,
  type Snapshot,
} from "./view";

type Update = GameUpdate<MauMauState, MauMauAction>;

const font = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const colors = { accent: 0xe9a23b, accentText: "#f6c66a", text: "#f4ece5", muted: "#b8cbbd", dark: 0x0f2a1c, button: 0xfffdf8, buttonText: "#2a201b" };

interface Metrics {
  width: number;
  height: number;
  u: number;
  cardWidth: number;
  cardHeight: number;
  seatsY: number;
  centerY: number;
  deck: Slot;
  pile: Slot;
  statusY: number;
  buttonsY: number;
  handBottom: number;
}

export class TableScene extends Phaser.Scene {
  readonly #connection: GameConnection<MauMauState, MauMauAction>;
  readonly #dpr: number;
  #update: Update | undefined;
  #previous: Snapshot | undefined;
  #busy = false;
  #wishFor: Card | undefined;
  readonly #hand = new Map<Card, Phaser.GameObjects.Image>();
  readonly #pile = new Map<Card, Phaser.GameObjects.Image>();
  #felt!: Phaser.GameObjects.Image;
  #deck!: Phaser.GameObjects.Image;
  #deckCount!: Phaser.GameObjects.Text;
  #status!: Phaser.GameObjects.Text;
  #seats!: Phaser.GameObjects.Container;
  #badges!: Phaser.GameObjects.Container;
  #buttons!: Phaser.GameObjects.Container;
  #overlay!: Phaser.GameObjects.Container;

  constructor(connection: GameConnection<MauMauState, MauMauAction>, dpr: number) {
    super("table");
    this.#connection = connection;
    this.#dpr = dpr;
  }

  create(): void {
    createTextures(this.textures as unknown as TextureSink);
    this.#felt = this.add.image(0, 0, feltKey).setOrigin(0, 0).setDepth(-100);
    this.#deck = this.add.image(0, 0, backKey).setDepth(1);
    this.#deck.setInteractive({ useHandCursor: true }).on("pointerup", () => this.#drawFromDeck());
    this.#deckCount = this.add.text(0, 0, "", { fontFamily: font, color: colors.text, fontStyle: "700" }).setOrigin(0.5, 0).setDepth(2);
    this.#status = this.add.text(0, 0, "", { fontFamily: font, color: colors.text, fontStyle: "700", align: "center" }).setOrigin(0.5).setDepth(5);
    this.#seats = this.add.container(0, 0).setDepth(3);
    this.#badges = this.add.container(0, 0).setDepth(40);
    this.#buttons = this.add.container(0, 0).setDepth(50);
    this.#overlay = this.add.container(0, 0).setDepth(depths.overlay);
    this.scale.on("resize", () => this.#render(false));
    this.#connection.onUpdate((update) => {
      this.#update = update;
      this.#render(true);
    });
  }

  #metrics(): Metrics {
    const width = this.scale.width;
    const height = this.scale.height;
    const u = this.#dpr;
    const cardWidth = Phaser.Math.Clamp(Math.min(width / 4.7, height / 6.4), 50 * u, 120 * u);
    const cardHeight = cardWidth * cardRatio;
    const seatsY = 16 * u;
    const seatsHeight = 26 * u + cardWidth * 0.5;
    const handBottom = height - 14 * u;
    const handTop = handBottom - cardHeight * 1.25;
    const centerY = Math.max(seatsY + seatsHeight + cardHeight / 2 + 18 * u, Math.min(height * 0.44, handTop - cardHeight / 2 - 92 * u));
    const gap = cardWidth * 0.7;
    return {
      width,
      height,
      u,
      cardWidth,
      cardHeight,
      seatsY,
      centerY,
      deck: { x: width / 2 - gap, y: centerY },
      pile: { x: width / 2 + gap, y: centerY },
      statusY: centerY + cardHeight / 2 + 26 * u,
      buttonsY: centerY + cardHeight / 2 + 66 * u,
      handBottom,
    };
  }

  #render(animated: boolean): void {
    const update = this.#update;
    if (update === undefined) {
      return;
    }
    const snapshot = update.snapshot as Snapshot;
    const m = this.#metrics();
    this.#felt.setDisplaySize(m.width, m.height);
    const seatPositions = this.#renderSeats(snapshot, update.players, m);
    this.#renderDeck(snapshot, m);
    this.#renderPile(snapshot, m, animated, seatPositions);
    this.#renderHand(snapshot, m, animated);
    this.#renderOpponentDraws(snapshot, m, animated, seatPositions);
    this.#renderControls(snapshot, update.players, m);
    this.#renderOverlay(snapshot, m);
    this.#previous = snapshot;
  }

  #renderSeats(snapshot: Snapshot, players: Players, m: Metrics): Map<string, Slot> {
    this.#seats.removeAll(true);
    const order = opponents(snapshot.player, snapshot.players);
    const slots = seatSlots(order.length, m.width, m.seatsY);
    const positions = new Map<string, Slot>();
    const mini = m.cardWidth * 0.42;
    const slotWidth = m.width / (order.length + 1);
    order.forEach((seat, index) => {
      const slot = slots[index] as Slot;
      const count = snapshot.public.handSizes[seat] ?? 0;
      const info = players[seat];
      const current = snapshot.public.current === seat && snapshot.result === undefined;
      const shown = Math.min(count, 6);
      const step = Math.min(mini * 0.32, (slotWidth * 0.8 - mini) / Math.max(shown - 1, 1));
      const fanWidth = mini + step * Math.max(shown - 1, 0);
      const fanY = slot.y + (mini * cardRatio) / 2 + 2 * m.u;
      positions.set(seat, { x: slot.x, y: fanY });
      if (current) {
        const glow = this.add.graphics();
        glow.fillStyle(colors.accent, 0.28);
        const boxWidth = Math.max(fanWidth, mini * 1.6) + 18 * m.u;
        const boxHeight = mini * cardRatio + 30 * m.u;
        glow.fillRoundedRect(slot.x - boxWidth / 2, slot.y - 6 * m.u, boxWidth, boxHeight, 12 * m.u);
        glow.lineStyle(2 * m.u, colors.accent, 0.9);
        glow.strokeRoundedRect(slot.x - boxWidth / 2, slot.y - 6 * m.u, boxWidth, boxHeight, 12 * m.u);
        this.#seats.add(glow);
      }
      for (let index = 0; index < shown; index++) {
        const back = this.add.image(slot.x - fanWidth / 2 + mini / 2 + index * step, fanY, backKey).setDisplaySize(mini, mini * cardRatio);
        back.setAngle((index - (shown - 1) / 2) * 4);
        this.#seats.add(back);
      }
      const countText = this.add
        .text(slot.x + fanWidth / 2 + 2 * m.u, fanY - (mini * cardRatio) / 2, String(count), {
          fontFamily: font,
          fontSize: `${12 * m.u}px`,
          fontStyle: "700",
          color: "#2a201b",
          backgroundColor: "#fffdf8",
          padding: { x: 5 * m.u, y: 1 * m.u },
        })
        .setOrigin(0.5, 0.5);
      this.#seats.add(countText);
      const label = info === undefined ? seat : info.connected ? info.name : `${info.name} (offline)`;
      const name = this.add
        .text(slot.x, fanY + (mini * cardRatio) / 2 + 4 * m.u, label, {
          fontFamily: font,
          fontSize: `${13 * m.u}px`,
          fontStyle: current ? "700" : "500",
          color: info?.connected === false ? colors.muted : colors.text,
          fixedWidth: slotWidth - 6 * m.u,
          align: "center",
        })
        .setOrigin(0.5, 0);
      this.#seats.add(name);
    });
    return positions;
  }

  #renderDeck(snapshot: Snapshot, m: Metrics): void {
    const size = snapshot.public.deckSize;
    this.#deck.setPosition(m.deck.x, m.deck.y).setDisplaySize(m.cardWidth, m.cardHeight).setVisible(size > 0);
    this.#deck.setAlpha(choices(snapshot.moves).draw === undefined ? 0.9 : 1);
    this.#deckCount
      .setText(size > 0 ? `${size}` : "")
      .setFontSize(13 * m.u)
      .setPosition(m.deck.x, m.deck.y + m.cardHeight / 2 + 4 * m.u);
  }

  #renderPile(snapshot: Snapshot, m: Metrics, animated: boolean, seats: Map<string, Slot>): void {
    const visible = snapshot.public.discard.slice(-3);
    const previousTop = this.#previous?.public.discard[this.#previous.public.discard.length - 1];
    for (const [card, image] of [...this.#pile]) {
      if (!visible.includes(card)) {
        image.destroy();
        this.#pile.delete(card);
      }
    }
    visible.forEach((card, index) => {
      let image = this.#pile.get(card);
      const isNewTop = index === visible.length - 1 && card !== previousTop && this.#previous !== undefined;
      if (image === undefined) {
        const start = animated && isNewTop ? this.#origin(card, seats, m) : m.pile;
        image = this.add.image(start.x, start.y, faceKey(card));
        this.#pile.set(card, image);
      }
      image.setDisplaySize(m.cardWidth, m.cardHeight).setDepth(depths.pile + index);
      if (animated && isNewTop) {
        this.tweens.add({ targets: image, x: m.pile.x, y: m.pile.y, angle: tilt(card), duration: 280, ease: "Cubic.easeOut" });
      } else {
        this.tweens.killTweensOf(image);
        image.setPosition(m.pile.x, m.pile.y).setAngle(tilt(card));
      }
    });
  }

  #origin(card: Card, seats: Map<string, Slot>, m: Metrics): Slot {
    const own = this.#hand.get(card);
    if (own !== undefined) {
      return { x: own.x, y: own.y };
    }
    const previous = this.#previous;
    if (previous !== undefined) {
      const seat = seats.get(previous.public.current);
      if (seat !== undefined) {
        return seat;
      }
    }
    return m.deck;
  }

  #renderHand(snapshot: Snapshot, m: Metrics, animated: boolean): void {
    const cards = sortHand(snapshot.me.hand);
    const slots = handSlots(cards.length, m.width, m.handBottom, m.cardWidth, m.cardHeight);
    const options = choices(snapshot.moves);
    const myTurn = snapshot.moves.length > 0;
    const drawn = snapshot.me.drawn;
    for (const [card, image] of [...this.#hand]) {
      if (!cards.includes(card)) {
        image.destroy();
        this.#hand.delete(card);
      }
    }
    const fresh = this.#previous !== undefined;
    cards.forEach((card, index) => {
      const slot = slots[index] as Slot;
      const playable = options.plays.has(card);
      const raise = playable ? 16 * m.u : 0;
      let image = this.#hand.get(card);
      if (image === undefined) {
        const start = animated && fresh ? m.deck : { x: slot.x, y: slot.y };
        image = this.add.image(start.x, start.y, faceKey(card));
        image.setInteractive({ useHandCursor: true }).on("pointerup", () => this.#tapCard(card));
        this.#hand.set(card, image);
      }
      image.setDisplaySize(m.cardWidth, m.cardHeight).setDepth(depths.hand + index);
      image.setTint(myTurn && !playable ? 0xb9b9b9 : 0xffffff);
      if (image.input !== null) {
        image.input.cursor = playable ? "pointer" : "default";
      }
      const target = { x: slot.x, y: slot.y - raise - (card === drawn ? 10 * m.u : 0) };
      this.tweens.killTweensOf(image);
      if (animated) {
        this.tweens.add({ targets: image, x: target.x, y: target.y, angle: 0, duration: 260, ease: "Cubic.easeOut" });
      } else {
        image.setPosition(target.x, target.y).setAngle(0);
      }
    });
  }

  #renderOpponentDraws(snapshot: Snapshot, m: Metrics, animated: boolean, seats: Map<string, Slot>): void {
    const previous = this.#previous;
    if (!animated || previous === undefined) {
      return;
    }
    for (const [seat, slot] of seats) {
      const before = previous.public.handSizes[seat] ?? 0;
      const after = snapshot.public.handSizes[seat] ?? 0;
      for (let index = 0; index < Math.min(after - before, 4); index++) {
        const back = this.add.image(m.deck.x, m.deck.y, backKey).setDisplaySize(m.cardWidth, m.cardHeight).setDepth(30);
        this.tweens.add({
          targets: back,
          x: slot.x,
          y: slot.y,
          scale: back.scale * 0.42,
          alpha: 0.2,
          delay: index * 90,
          duration: 320,
          ease: "Cubic.easeIn",
          onComplete: () => back.destroy(),
        });
      }
    }
  }

  #renderControls(snapshot: Snapshot, players: Players, m: Metrics): void {
    const status = statusLine(snapshot, players);
    this.#status
      .setText(status.text)
      .setFontSize((status.mine ? 17 : 15) * m.u)
      .setColor(status.mine ? colors.accentText : colors.text)
      .setPosition(m.width / 2, m.statusY)
      .setWordWrapWidth(m.width - 24 * m.u);

    this.#badges.removeAll(true);
    const badgeY = m.pile.y - m.cardHeight / 2 - 16 * m.u;
    if (snapshot.public.wish !== null) {
      this.#badges.add(this.#badge(m.pile.x, badgeY, `Wunsch: ${suitNames[snapshot.public.wish]}`, snapshot.public.wish, m));
    }
    if (snapshot.public.penalty > 0) {
      this.#badges.add(this.#badge(m.deck.x, m.deck.y - m.cardHeight / 2 - 16 * m.u, `+${snapshot.public.penalty}`, undefined, m));
    }

    this.#buttons.removeAll(true);
    if (snapshot.result !== undefined) {
      return;
    }
    const options = choices(snapshot.moves);
    const labels: { text: string; move: MauMauAction }[] = [];
    if (options.draw !== undefined) {
      labels.push({ text: drawLabel(snapshot), move: options.draw });
    }
    if (options.pass !== undefined) {
      labels.push({ text: "Behalten", move: options.pass });
    }
    const width = Math.min(170 * m.u, (m.width - 40 * m.u) / Math.max(labels.length, 1));
    labels.forEach((label, index) => {
      const x = m.width / 2 + (index - (labels.length - 1) / 2) * (width + 12 * m.u);
      this.#buttons.add(this.#button(x, m.buttonsY, width, label.text, () => void this.#send(label.move), m));
    });
  }

  #badge(x: number, y: number, text: string, suit: Suit | undefined, m: Metrics): Phaser.GameObjects.Container {
    const label = this.add.text(0, 0, text, { fontFamily: font, fontSize: `${13 * m.u}px`, fontStyle: "700", color: "#2a201b" }).setOrigin(0, 0.5);
    const icon = suit === undefined ? undefined : this.add.image(0, 0, suitKey(suit)).setDisplaySize(16 * m.u, 16 * m.u);
    const padding = 9 * m.u;
    const iconWidth = icon === undefined ? 0 : 20 * m.u;
    const width = label.width + iconWidth + padding * 2;
    const height = 26 * m.u;
    const background = this.add.graphics();
    background.fillStyle(colors.accent, 1);
    background.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    label.setX(-width / 2 + padding + iconWidth);
    icon?.setPosition(-width / 2 + padding + 8 * m.u, 0);
    return this.add.container(x, y, icon === undefined ? [background, label] : [background, icon, label]);
  }

  #button(x: number, y: number, width: number, text: string, onTap: () => void, m: Metrics): Phaser.GameObjects.Container {
    const height = 46 * m.u;
    const background = this.add.graphics();
    background.fillStyle(colors.button, 1);
    background.fillRoundedRect(-width / 2, -height / 2, width, height, 12 * m.u);
    const label = this.add.text(0, 0, text, { fontFamily: font, fontSize: `${16 * m.u}px`, fontStyle: "700", color: colors.buttonText }).setOrigin(0.5);
    const button = this.add.container(x, y, [background, label]);
    button.setSize(width, height);
    button.setInteractive({ useHandCursor: true }).on("pointerup", onTap);
    return button;
  }

  #renderOverlay(snapshot: Snapshot, m: Metrics): void {
    this.#overlay.removeAll(true);
    if (snapshot.result === undefined && this.#wishFor !== undefined) {
      const options = snapshot.moves.filter((move) => move.type === "play" && move.card === this.#wishFor);
      if (options.length === 0) {
        this.#wishFor = undefined;
      } else {
        this.#renderWishPicker(options, m);
      }
    }
  }

  #renderWishPicker(options: MauMauAction[], m: Metrics): void {
    const shade = this.add.rectangle(0, 0, m.width, m.height, colors.dark, 0.7).setOrigin(0, 0);
    shade.setInteractive().on("pointerup", () => {
      this.#wishFor = undefined;
      this.#render(false);
    });
    const panelWidth = Math.min(m.width - 24 * m.u, 360 * m.u);
    const panelHeight = 190 * m.u;
    const panelX = m.width / 2;
    const panelY = m.height / 2;
    const panel = this.add.graphics();
    panel.fillStyle(0xfffdf8, 1);
    panel.fillRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 16 * m.u);
    const blocker = this.add.zone(panelX, panelY, panelWidth, panelHeight).setInteractive();
    const title = this.add
      .text(panelX, panelY - panelHeight / 2 + 24 * m.u, "Welche Farbe wünschst du dir?", { fontFamily: font, fontSize: `${16 * m.u}px`, fontStyle: "700", color: "#2a201b" })
      .setOrigin(0.5);
    this.#overlay.add([shade, panel, blocker, title]);
    const size = Math.min(64 * m.u, (panelWidth - 40 * m.u) / 4);
    suitOrder.forEach((suit, index) => {
      const x = panelX + (index - 1.5) * (size + 10 * m.u);
      const y = panelY + 10 * m.u;
      const tile = this.add.graphics();
      tile.fillStyle(0xf1e9e0, 1);
      tile.fillRoundedRect(x - size / 2, y - size / 2, size, size, 12 * m.u);
      const icon = this.add.image(x, y, suitKey(suit)).setDisplaySize(size * 0.62, size * 0.62);
      const name = this.add.text(x, y + size / 2 + 8 * m.u, suitNames[suit], { fontFamily: font, fontSize: `${12 * m.u}px`, color: "#6f6158" }).setOrigin(0.5, 0);
      const hit = this.add.zone(x, y + 8 * m.u, size, size + 24 * m.u).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => {
        const move = wishMove(options, suit);
        this.#wishFor = undefined;
        this.#render(false);
        if (move !== undefined) {
          void this.#send(move);
        }
      });
      this.#overlay.add([tile, icon, name, hit]);
    });
  }

  #tapCard(card: Card): void {
    const update = this.#update;
    if (update === undefined || this.#busy || update.snapshot.result !== undefined) {
      return;
    }
    const options = choices(update.snapshot.moves).plays.get(card);
    if (options === undefined) {
      if (update.snapshot.moves.length > 0) {
        this.#shake(card);
      }
      return;
    }
    if (options.length > 1) {
      this.#wishFor = card;
      this.#render(false);
      return;
    }
    const move = options[0];
    if (move !== undefined) {
      void this.#send(move);
    }
  }

  #drawFromDeck(): void {
    const draw = this.#update === undefined ? undefined : choices(this.#update.snapshot.moves).draw;
    if (draw !== undefined) {
      void this.#send(draw);
    }
  }

  async #send(move: MauMauAction): Promise<MoveResult | undefined> {
    if (this.#busy) {
      return undefined;
    }
    this.#busy = true;
    try {
      const result = await this.#connection.move(move);
      if (!result.ok && result.code === "illegal-move" && move.type === "play") {
        this.#shake(move.card);
      }
      return result;
    } finally {
      this.#busy = false;
    }
  }

  #shake(card: Card): void {
    const image = this.#hand.get(card);
    if (image === undefined) {
      return;
    }
    const x = image.x;
    this.tweens.add({ targets: image, x: x + 6 * this.#dpr, duration: 50, yoyo: true, repeat: 2, onComplete: () => image.setX(x) });
  }
}
