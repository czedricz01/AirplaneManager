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

### Im Spiel ankommen

Auf dem Startbildschirm gibt es drei Knöpfe:

| Knopf | Wann |
|---|---|
| **Initialize System** | Anmelden mit einem bestehenden Supabase-Konto |
| **Request Access** | Neues Supabase-Konto anlegen |
| **Play Offline** | Ohne Konto spielen — funktioniert immer |

**Für einen schnellen Test nimm "Play Offline".** Das Spiel braucht kein Konto.
Spielstände liegen dann im `localStorage` deines Browsers, also nur auf diesem Gerät
und in diesem Browser.

Danach: *Start Game* → Airline benennen, Hub und Startdatum wählen, einen
Speicherdateinamen eintragen (der ist Pflicht) → *Start Game*.

### Was Internet braucht

Das Spiel lädt einige Dinge aus dem Netz. Ohne Internet läuft es trotzdem, sieht aber
unvollständig aus:

- **Kartenkacheln** von Esri — ohne sie bleibt die Weltkarte schwarz
- **Schriftarten** von Google Fonts
- **Hintergrundbilder** von Unsplash
- **Flugzeugbilder** aus einem Supabase-Bucket (optional, konfigurierbar im Spiel)
- **Supabase**, nur wenn du dich anmelden willst

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
| Anmeldung schlägt fehl | Supabase nicht konfiguriert — nimm "Play Offline" |

---

## Konfiguration (optional)

Alles in `.env.example` ist optional. Für einen Supabase-Login:

```bash
cp .env.example .env
```

und `VITE_SUPABASE_URL` sowie `VITE_SUPABASE_ANON_KEY` eintragen (zu finden im
Supabase-Projekt unter *Settings → API*).

> Achtung: Variablen mit dem Präfix `VITE_` landen im ausgelieferten Browser-Bundle
> und sind damit öffentlich. Niemals ein Geheimnis dort ablegen.

---

## Nützliche Befehle

| Befehl | Was er tut |
|---|---|
| `npm run dev` | Entwicklungsserver auf Port 3000 |
| `npm run build` | Produktions-Build nach `dist/` |
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
    supabase.ts        Supabase-Client (null, wenn nicht konfiguriert)
  data/                Flughäfen, Flugzeuge, Treibstoffpreise, Catering
server.ts              Express-Server: Vite im Dev-Modus, Bild-Upload-API
```

Die Finanzsimulation liegt vollständig in `src/lib/financeUtils.ts`. Alle Ansichten
rufen dieselbe `calculateRouteFinancials`-Funktion auf, damit Vorschau und
Monatsabrechnung nicht auseinanderlaufen.
