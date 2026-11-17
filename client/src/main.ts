import Phaser from "phaser";
import { connect } from "@gamehearth/sdk/client";
import type { MauMauAction, MauMauState } from "../../src/index";
import { mountAccessibleControls } from "./access";
import { TableScene } from "./table";

async function start(): Promise<void> {
  const parent = document.getElementById("game");
  if (parent === null) {
    return;
  }
  let connection;
  try {
    connection = await connect<MauMauState, MauMauAction>();
  } catch (error) {
    const fallback = document.getElementById("fallback");
    if (fallback !== null) {
      fallback.textContent = `Mau-Mau läuft nur in Gamehearth. ${error instanceof Error ? error.message : ""}`;
      fallback.hidden = false;
    }
    return;
  }
  const access = document.getElementById("access");
  if (access !== null) {
    mountAccessibleControls(access, connection);
  }
  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
  const size = () => ({ width: Math.max(parent.clientWidth, 1) * dpr, height: Math.max(parent.clientHeight, 1) * dpr });
  const initial = size();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: initial.width,
    height: initial.height,
    backgroundColor: "#1f4d36",
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
    banner: false,
    audio: { noAudio: true },
    scene: new TableScene(connection, dpr),
  });
  const resize = () => {
    const next = size();
    game.scale.resize(next.width, next.height);
    game.scale.setZoom(1 / dpr);
  };
  new ResizeObserver(resize).observe(parent);
}

void start();
