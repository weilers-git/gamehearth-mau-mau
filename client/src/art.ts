import type { Card, Suit } from "../../src/index";
import { cardParts, rankOrder, suitOrder } from "./view";

export const cardTextureWidth = 200;
export const cardTextureHeight = 290;
export const cardRatio = cardTextureHeight / cardTextureWidth;

const ink = { red: "#c62828", black: "#1d1b1a" };

export interface TextureSink {
  createCanvas(key: string, width: number, height: number): { context: CanvasRenderingContext2D; refresh(): unknown } | null;
}

export function faceKey(card: Card): string {
  return `card-${card}`;
}

export const backKey = "card-back";
export const feltKey = "felt";

export function suitKey(suit: Suit): string {
  return `suit-${suit}`;
}

export function drawSuit(ctx: CanvasRenderingContext2D, suit: Suit, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size, size);
  ctx.fillStyle = color;
  ctx.beginPath();
  switch (suit) {
    case "herz":
      ctx.moveTo(0.5, 0.95);
      ctx.bezierCurveTo(0.15, 0.68, 0, 0.48, 0, 0.3);
      ctx.bezierCurveTo(0, 0.12, 0.14, 0.02, 0.28, 0.02);
      ctx.bezierCurveTo(0.39, 0.02, 0.47, 0.09, 0.5, 0.18);
      ctx.bezierCurveTo(0.53, 0.09, 0.61, 0.02, 0.72, 0.02);
      ctx.bezierCurveTo(0.86, 0.02, 1, 0.12, 1, 0.3);
      ctx.bezierCurveTo(1, 0.48, 0.85, 0.68, 0.5, 0.95);
      break;
    case "karo":
      ctx.moveTo(0.5, 0);
      ctx.lineTo(0.9, 0.5);
      ctx.lineTo(0.5, 1);
      ctx.lineTo(0.1, 0.5);
      ctx.closePath();
      break;
    case "pik":
      ctx.moveTo(0.5, 0.02);
      ctx.bezierCurveTo(0.85, 0.3, 1, 0.45, 1, 0.6);
      ctx.bezierCurveTo(1, 0.76, 0.87, 0.85, 0.73, 0.85);
      ctx.bezierCurveTo(0.63, 0.85, 0.56, 0.8, 0.53, 0.74);
      ctx.quadraticCurveTo(0.56, 0.9, 0.66, 0.98);
      ctx.lineTo(0.34, 0.98);
      ctx.quadraticCurveTo(0.44, 0.9, 0.47, 0.74);
      ctx.bezierCurveTo(0.44, 0.8, 0.37, 0.85, 0.27, 0.85);
      ctx.bezierCurveTo(0.13, 0.85, 0, 0.76, 0, 0.6);
      ctx.bezierCurveTo(0, 0.45, 0.15, 0.3, 0.5, 0.02);
      break;
    case "kreuz":
      ctx.arc(0.5, 0.27, 0.21, 0, Math.PI * 2);
      ctx.moveTo(0.48, 0.56);
      ctx.arc(0.27, 0.56, 0.21, 0, Math.PI * 2);
      ctx.moveTo(0.94, 0.56);
      ctx.arc(0.73, 0.56, 0.21, 0, Math.PI * 2);
      ctx.moveTo(0.44, 0.45);
      ctx.lineTo(0.56, 0.45);
      ctx.quadraticCurveTo(0.56, 0.86, 0.66, 0.98);
      ctx.lineTo(0.34, 0.98);
      ctx.quadraticCurveTo(0.44, 0.86, 0.44, 0.45);
      break;
  }
  ctx.fill();
  ctx.restore();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

const font = (size: number) => `700 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

export function drawFace(ctx: CanvasRenderingContext2D, card: Card): void {
  const w = cardTextureWidth;
  const h = cardTextureHeight;
  const { suit, rank, red } = cardParts(card);
  const color = red ? ink.red : ink.black;
  ctx.clearRect(0, 0, w, h);
  roundedRect(ctx, 3, 3, w - 6, h - 6, 18);
  ctx.fillStyle = "#fffdf8";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#d9cfc3";
  ctx.stroke();

  const corner = (flip: boolean) => {
    ctx.save();
    if (flip) {
      ctx.translate(w, h);
      ctx.rotate(Math.PI);
    }
    ctx.fillStyle = color;
    ctx.font = font(rank === "10" ? 40 : 46);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(rank, 34, 16);
    drawSuit(ctx, suit, 34, 88, 34, color);
    ctx.restore();
  };
  corner(false);
  corner(true);

  if (rank === "B" || rank === "D" || rank === "K") {
    roundedRect(ctx, 52, 62, w - 104, h - 124, 12);
    ctx.fillStyle = red ? "#fbe9e7" : "#ece9e4";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = font(84);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(rank, w / 2, h / 2 - 22);
    drawSuit(ctx, suit, w / 2, h / 2 + 50, 46, color);
  } else {
    drawSuit(ctx, suit, w / 2, h / 2, rank === "A" ? 112 : 84, color);
  }
}

export function drawBack(ctx: CanvasRenderingContext2D): void {
  const w = cardTextureWidth;
  const h = cardTextureHeight;
  ctx.clearRect(0, 0, w, h);
  roundedRect(ctx, 3, 3, w - 6, h - 6, 18);
  ctx.fillStyle = "#fffdf8";
  ctx.fill();
  roundedRect(ctx, 14, 14, w - 28, h - 28, 12);
  ctx.fillStyle = "#7a2e1d";
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "rgba(255, 230, 200, 0.16)";
  ctx.lineWidth = 6;
  for (let offset = -h; offset < w + h; offset += 22) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + h, h);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "#e9a23b";
  ctx.beginPath();
  ctx.moveTo(w / 2, h / 2 - 46);
  ctx.bezierCurveTo(w / 2 + 34, h / 2 - 8, w / 2 + 30, h / 2 + 40, w / 2, h / 2 + 44);
  ctx.bezierCurveTo(w / 2 - 30, h / 2 + 40, w / 2 - 34, h / 2 + 2, w / 2 - 12, h / 2 - 20);
  ctx.bezierCurveTo(w / 2 - 8, h / 2 - 4, w / 2, h / 2 + 2, w / 2 + 4, h / 2 - 2);
  ctx.bezierCurveTo(w / 2 - 2, h / 2 - 18, w / 2 - 4, h / 2 - 30, w / 2, h / 2 - 46);
  ctx.fill();
}

export function drawFelt(ctx: CanvasRenderingContext2D, size: number): void {
  const gradient = ctx.createRadialGradient(size / 2, size * 0.45, size * 0.05, size / 2, size / 2, size * 0.75);
  gradient.addColorStop(0, "#2f7a52");
  gradient.addColorStop(0.6, "#22603f");
  gradient.addColorStop(1, "#163f2a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
}

export function createTextures(sink: TextureSink): void {
  for (const suit of suitOrder) {
    for (const rank of rankOrder) {
      const card = `${suit}-${rank}` as Card;
      const texture = sink.createCanvas(faceKey(card), cardTextureWidth, cardTextureHeight);
      if (texture !== null) {
        drawFace(texture.context, card);
        texture.refresh();
      }
    }
    const icon = sink.createCanvas(suitKey(suit), 128, 128);
    if (icon !== null) {
      drawSuit(icon.context, suit, 64, 64, 104, suit === "herz" || suit === "karo" ? ink.red : ink.black);
      icon.refresh();
    }
  }
  const back = sink.createCanvas(backKey, cardTextureWidth, cardTextureHeight);
  if (back !== null) {
    drawBack(back.context);
    back.refresh();
  }
  const felt = sink.createCanvas(feltKey, 512, 512);
  if (felt !== null) {
    drawFelt(felt.context, 512);
    felt.refresh();
  }
}
