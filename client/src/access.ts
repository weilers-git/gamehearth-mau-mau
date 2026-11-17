import type { GameConnection } from "@gamehearth/sdk/client";
import type { MauMauAction, MauMauState } from "../../src/index";
import { describeMove, describeTable, statusLine, type Snapshot } from "./view";

export function mountAccessibleControls(root: HTMLElement, connection: GameConnection<MauMauState, MauMauAction>): void {
  const status = document.createElement("p");
  status.setAttribute("aria-live", "polite");
  const table = document.createElement("p");
  const moves = document.createElement("div");
  moves.setAttribute("role", "group");
  moves.setAttribute("aria-label", "Deine Züge");
  root.append(status, table, moves);
  let busy = false;
  connection.onUpdate((update) => {
    const snapshot = update.snapshot as Snapshot;
    status.textContent = statusLine(snapshot, update.players).text;
    table.textContent = describeTable(snapshot, update.players);
    moves.replaceChildren(
      ...snapshot.moves.map((move) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = describeMove(move, snapshot);
        button.addEventListener("click", () => {
          if (busy) {
            return;
          }
          busy = true;
          void connection.move(move).finally(() => {
            busy = false;
          });
        });
        return button;
      }),
    );
  });
}
