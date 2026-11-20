# Mau-Mau für Gamehearth

Mau-Mau für 2–6 Spieler, jeder am eigenen Gerät: das erste Spiel für Gamehearth, eine selbst hostbare Spieleplattform. Die Spiellogik läuft als Reducer auf dem Server, die Oberfläche ist mit Phaser 4 gebaut.

Auf einen Gamehearth-Server kommt das Spiel über einen Katalog, etwa den [Gamehearth-Katalog](https://github.com/weilers-git/gamehearth-catalog): In der Verwaltung den Katalog hinzufügen und Mau-Mau installieren.

## Entwickeln

Voraussetzung ist Node 22.

```bash
npm install
npm test
npm run typecheck
npm run build
npm run check
```

| Befehl | Was er tut |
|---|---|
| `npm test` | Regeltests und Simulationen mit Vitest |
| `npm run build` | baut den Client nach `dist/client` |
| `npm run check` | prüft das Spiel mit dem Gamehearth-Werkzeug: Manifest, Lizenzen, Bot-Partien, Lecks, Determinismus, Lauf in der Server-Sandbox |
| `npm run pack` | baut den Client und das Spielpaket `dist/mau-mau-<version>.zip`, nur wenn `check` keine Fehler meldet |

SDK und Werkzeug liegen als npm-Tarball in `vendor/`, solange die Plattform noch nicht auf npm ist. Eine neue Fassung kommt aus dem Plattform-Repo: dort in `packages/sdk` und `packages/devtool` jeweils `npm pack --pack-destination <dieses Repo>/vendor`, danach hier `npm install ./vendor/gamehearth-sdk-<version>.tgz` und `npm install -D ./vendor/gamehearth-<version>.tgz`. Ein einfaches `npm install` nähme bei gleicher Versionsnummer den alten Stand aus dem Lockfile.

## Veröffentlichen

1. Version in `manifest.json` und `package.json` erhöhen, committen.
2. Tag setzen und pushen: `git tag v0.2.0 && git push origin v0.2.0`.
3. Die CI baut mit `check` und `pack` das Paket und hängt es an ein Release mit diesem Tag.
4. Im Katalog-Repo die Version eintragen: `npx gamehearth catalog add catalog.json https://github.com/weilers-git/gamehearth-mau-mau/releases/download/v0.2.0/mau-mau-0.2.0.zip`, committen und pushen.

Danach zeigt die Verwaltung jedes Servers mit diesem Katalog das Update an.

## Regeln

**Karten:** 32 Karten, Farben Kreuz, Pik, Herz und Karo, Werte 7, 8, 9, 10, Bube, Dame, König, Ass.

**Austeilen:** Jeder bekommt 5 Karten. Eine Karte liegt offen als Ablage, der Rest bildet den verdeckten Stapel. Die offene Startkarte hat keine Sonderwirkung. Spieler 1 beginnt, danach geht es reihum.

**Bedienen:** Man legt eine Karte gleicher Farbe oder gleichen Werts auf die Ablage.

**Ziehen:** Wer nicht bedienen kann, zieht eine Karte. Passt sie, darf man sie sofort legen; sonst ist der Nächste dran. Ist der Stapel leer, wird die Ablage außer der obersten Karte neu gemischt.

**Sonderkarten:**

| Karte | Wirkung |
|---|---|
| 7 | Der Nächste zieht 2 Karten. Er kann stattdessen selbst eine 7 legen; dann zieht der Folgende 4, und so weiter. Wer die Strafkarten zieht, darf in diesem Zug nichts mehr legen. |
| 8 | Der Nächste setzt aus. Bei zwei Spielern ist man also gleich noch einmal dran. |
| Bube | Darf auf jede Karte außer einen Buben. Wer ihn legt, wünscht sich eine Farbe; der Nächste muss diese Farbe legen oder ziehen. |
| Ass | Wer ein Ass legt, ist gleich noch einmal dran und muss eine passende Karte nachlegen: gleiche Farbe, ein weiteres Ass oder einen Buben. Kann er nicht, zieht er eine Karte; passt sie, darf er sie sofort legen, sonst ist der Nächste dran. |

**Ende:** Wer zuerst keine Karten mehr hat, gewinnt, und die Partie endet sofort. Das gilt auch, wenn die letzte Karte eine Sonderkarte ist. Können reihum alle weder legen noch ziehen, weil kein Stapel mehr da ist, endet die Partie ebenfalls; dann gewinnt, wer die wenigsten Karten hat.

**Ohne:** „Mau“ und „Mau-Mau“ ansagen.

**Hausregeln:** Der Gastgeber stellt sie in der Lobby ein. Die Tabelle oben beschreibt den Standard.

| Option | Standard | Wirkung |
|---|---|---|
| Bube auf Bube | nein | mit „ja“ darf ein Bube auch auf einen Buben; der neue Wunsch gilt |
| 7er stapeln | ja | mit „nein“ darf niemand eine 7 auf eine offene 7 legen; der Nächste zieht die Strafkarten |
| Ass | noch mal dran | mit „Nächster setzt aus“ wirkt ein Ass wie eine 8: Der Nächste setzt aus, und wer es gelegt hat, muss nicht nachlegen |

Abweichende Hausregeln nennt der Tisch dort, wo sie gerade greifen, etwa „+2 · nicht stapeln“.

## Zustand

| Bereich | Inhalt |
|---|---|
| `public` | Ablage, wer dran ist (`current`), Phase (`play` oder `drawn`), Wunschfarbe, offene Strafkarten durch 7en, Handgrößen, Größe des Stapels |
| `players[sitz]` | eigene Hand, gerade gezogene Karte |
| `secret` | Stapel |

Nach dem Ziehen steht die Phase öffentlich immer auf `drawn`, egal ob die gezogene Karte passt. So verrät die Anzeige nicht, ob jemand legen könnte.

## Züge

| Zug | wann |
|---|---|
| `{ type: "play", card: "herz-7" }` | Karte legen |
| `{ type: "play", card: "pik-B", wish: "karo" }` | Buben legen und Farbe wünschen |
| `{ type: "draw" }` | ziehen, wenn nichts passt (auch nach einem Ass), oder die Strafkarten einer 7 nehmen |
| `{ type: "pass" }` | die gerade gezogene Karte nicht legen |

Karten heißen `farbe-wert`, zum Beispiel `kreuz-10`, `herz-B` (Bube), `pik-D` (Dame), `karo-K` (König), `herz-A` (Ass).

## Oberfläche

Der Client liegt in `client/` und ist mit Phaser 4, Vite und TypeScript gebaut, dem empfohlenen Starter-Stack für Gamehearth-Spiele. `npm run build` baut ihn nach `dist/client`; das Manifest nennt diesen Ordner (`"client": "dist/client"`).

| Datei | Inhalt |
|---|---|
| `client/src/main.ts` | verbindet sich über `@gamehearth/sdk/client` mit der Plattform und startet Phaser |
| `client/src/table.ts` | der Tisch als Phaser-Szene: Mitspieler oben, Stapel und Ablage in der Mitte, die eigene Hand unten, Knöpfe für Ziehen und Behalten, Auswahl der Wunschfarbe beim Buben |
| `client/src/art.ts` | zeichnet Karten, Rückseite, Farbsymbole und Filz beim Start auf Canvas-Texturen; keine Bilddateien, alles CC0 |
| `client/src/view.ts` | alles, was die Oberfläche entscheidet, ohne Phaser: Kartennamen, Sortierung, legbare Karten, Statuszeile, Layout der Hand; getestet in `test/view.test.ts` |
| `client/src/access.ts` | eine unsichtbare Liste der erlaubten Züge als Knöpfe und eine Beschreibung des Tisches für Screenreader und Tastatur; die Browser-Tests spielen darüber |

Bedienung: Legbare Karten stehen etwas höher, die anderen sind abgedunkelt, solange man dran ist. Antippen legt die Karte; beim Buben fragt das Spiel nach der Wunschfarbe. Ziehen geht über den Knopf oder den Stapel. Die Oberfläche zeigt nur, was im eigenen Snapshot steht; welche Karten andere halten, kennt sie nicht.

Auf hochauflösenden Displays rechnet die Szene in Gerätepixeln (Phaser mit `zoom: 1 / devicePixelRatio`), damit Karten und Schrift scharf bleiben.

## Lizenz

Code unter MIT, die selbst gezeichneten Karten unter CC0 (siehe `manifest.json` und [LICENSE](LICENSE)).
