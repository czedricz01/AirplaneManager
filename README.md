# AirlineManagerNeo

A single-player airline management simulator. You start in 1960 with a hub, a budget
and no aircraft, and build a route network month by month against AI competitors.

---

## Im Browser starten

Du brauchst **Node.js 20 oder neuer**. Prüfen:

```bash
node -v
```

Zeigt das nichts oder eine Zahl unter 20, installiere Node von <https://nodejs.org>
(die "LTS"-Version) und öffne das Terminal danach neu.

### Einmalig: Abhängigkeiten installieren

Im Projektordner:

```bash
npm install
```

Das lädt alle benötigten Pakete in den Ordner `node_modules/`. Dauert beim ersten Mal
ein bis zwei Minuten. Du musst das nur wiederholen, wenn sich `package.json` ändert.

### Jedes Mal: Entwicklungsserver starten

```bash
npm run dev
```

Es erscheint:

```
[Server] Listening on http://0.0.0.0:3000
```

Jetzt im Browser **<http://localhost:3000>** öffnen. Die Seite lädt sich automatisch
neu, sobald du eine Datei im Code änderst. Zum Beenden im Terminal `Strg + C`.

### Anmelden

Der Startbildschirm verlangt eine Anmeldung. Die Zugangsdaten stehen in
`src/App.tsx` (`APP_USERNAME` / `APP_PASSWORD`).

> **Das ist kein Sicherheitsmechanismus.** Die Prüfung läuft im Browser, und der
> ausgelieferte JavaScript-Code enthält beide Werte im Klartext — jeder Besucher
> kann sie auslesen. Es hält Zufallsbesucher ab, mehr nicht. Verwende dieses
> Passwort nirgendwo sonst. Echter Zugangsschutz bräuchte einen Server, den
> GitHub Pages nicht bietet.

Die Anmeldung wird im `localStorage` gemerkt, ein Neuladen wirft dich also nicht
heraus. *Logout* im Hauptmenü beendet sie.

Danach: *Start Game* → Airline benennen, Hub und Startdatum wählen, einen
Speicherdateinamen eintragen (der ist Pflicht) → *Start Game*.

### Was Internet braucht

Das Spiel lädt einige Dinge aus dem Netz. Ohne Internet läuft es trotzdem, sieht aber
unvollständig aus:

- **Kartenkacheln** von Esri — ohne sie bleibt die Weltkarte schwarz
- **Schriftarten** von Google Fonts
- **Hintergrundbilder** von Unsplash
- **Flugzeugbilder** aus einem Storage-Bucket (optional, im Spiel konfigurierbar)

### Produktionsversion bauen

```bash
npm run build     # erzeugt dist/
NODE_ENV=production npm start
```

Läuft dann ebenfalls auf <http://localhost:3000>, aber ohne Hot Reload.

### Wenn etwas nicht klappt

| Problem | Ursache / Lösung |
|---|---|
| `EADDRINUSE :3000` | Port belegt. Anderes Programm beenden oder `PORT` in `server.ts` ändern |
| Leere weiße Seite | Browser-Konsole öffnen (F12) und Fehlermeldung lesen |
| Karte bleibt schwarz | Kein Internet oder Esri-Kacheln blockiert (Firewall/Proxy) |
| `command not found: npm` | Node.js ist nicht installiert |
| Anmeldung schlägt fehl | Zugangsdaten prüfen (`APP_USERNAME` / `APP_PASSWORD` in `src/App.tsx`) |

---

## Veröffentlichung über GitHub Pages

Live: **https://czedricz01.github.io/AirplaneManager/**

`.github/workflows/deploy-pages.yml` baut die Seite bei jedem Push nach `main` und
veröffentlicht sie. Pull Requests werden nur gebaut und typgeprüft, nicht deployt —
die Umgebung `github-pages` nimmt Deployments ausschließlich vom Standardbranch an.

Einmalig eingerichtet: *Settings → Pages → Source: GitHub Actions*.

> Da das Repository öffentlich ist, sind Quellcode und Zugangsdaten ohnehin für
> jeden einsehbar. Wer das nicht will, stellt das Repository auf privat — dafür
> braucht GitHub Pages allerdings einen kostenpflichtigen Tarif.

---

## Konfiguration (optional)

Alles in `.env.example` ist optional.

> Achtung: Variablen mit dem Präfix `VITE_` landen im ausgelieferten Browser-Bundle
> und sind damit öffentlich. Niemals ein Geheimnis dort ablegen.

---

## Nützliche Befehle

| Befehl | Was er tut |
|---|---|
| `npm run dev` | Entwicklungsserver auf Port 3000 |
| `npm run build` | Produktions-Build nach `dist/` (inkl. Server) |
| `npm run build:pages` | Nur die statische Seite nach `dist/` (für GitHub Pages) |
| `npm run build:static` | Eine einzige eigenständige HTML-Datei nach `dist-static/` |
| `npm start` | Startet den gebauten Server (braucht `NODE_ENV=production`) |
| `npm run lint` | TypeScript-Typprüfung, ohne Dateien zu schreiben |
| `npm run clean` | Löscht `dist/` |

---

## Projektaufbau

```
src/
  App.tsx              Zentrale Komponente: Spielzustand, Karte, Monatswechsel
  main.tsx             Einstiegspunkt
  components/          Ansichten (Flotte, Routen, Flughäfen, Konkurrenz, …)
  lib/
    financeUtils.ts    Einzige Quelle der Wahrheit für Kosten, Nachfrage, Preise
    eventSystem.ts     Historische und zufällige Weltereignisse
    imageUtils.ts      Auflösung von Flugzeugbild-URLs
  data/                Flughäfen, Flugzeuge, Treibstoffpreise, Catering
server.ts              Express-Server: Vite im Dev-Modus, Bild-Upload-API
```

Die Finanzsimulation liegt vollständig in `src/lib/financeUtils.ts`. Alle Ansichten
rufen dieselbe `calculateRouteFinancials`-Funktion auf, damit Vorschau und
Monatsabrechnung nicht auseinanderlaufen.
