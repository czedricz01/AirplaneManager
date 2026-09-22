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

Der Startbildschirm verlangt ein Konto. Passwörter werden von Supabase
serverseitig gehasht und geprüft — im Browser liegt nie ein Passwort.

Registrieren geht nur mit einem **Einladungscode**. Den Code prüft ein
Datenbank-Trigger, nicht der Browser: ohne gültigen Code bricht die
Kontoerstellung in der Datenbank ab. Siehe `supabase/schema.sql`.

Ist kein Supabase-Projekt hinterlegt, zeigt der Startbildschirm stattdessen
*Continue Locally*. Das Spiel läuft dann ohne Konten, Spielstände bleiben in
diesem Browser.

Danach: *Start Game* → Airline benennen, Hub und Startdatum wählen, einen
Speicherdateinamen eintragen (der ist Pflicht) → *Start Game*.

### Spielstände

Spielstände liegen im Konto und sind auf jedem Gerät verfügbar. Geschrieben wird
immer zuerst in diesen Browser, dann in die Cloud — ein Speichervorgang hängt also
nie am Netz. Klappt der Upload nicht, wird der Stand vorgemerkt und beim nächsten
Anmelden nachgereicht. Die Statusanzeige oben rechts im Hauptmenü sagt, woran du
bist: *Cloud synced*, *Offline - changes queued* oder *Local only*.

Sind beide Fassungen eines Spielstands vorhanden, gewinnt die neuere.

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
| Anmeldung schlägt fehl | Meldung lesen — sie nennt den Grund (falsches Passwort, E-Mail nicht bestätigt, Server nicht erreichbar) |
| "Cloud accounts not configured" | Die Supabase-Variablen fehlen im Build, siehe unten |

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

## Konten und Cloud-Spielstände einrichten

Einmalige Einrichtung. Ohne sie läuft das Spiel im lokalen Modus weiter.

**1. Supabase-Projekt anlegen**

Auf <https://supabase.com> ein kostenloses Konto und ein neues Projekt anlegen.
Region egal, Europa ist für dich am schnellsten. Das Datenbank-Passwort, das dabei
abgefragt wird, brauchst du für das Spiel nicht — trotzdem sicher aufbewahren.

**2. Schema einspielen**

Im Projekt links auf *SQL Editor* → *New query*. Den gesamten Inhalt von
`supabase/schema.sql` hineinkopieren und *Run* drücken. Das legt die Tabellen
`profiles`, `saves` und `invite_codes` an, schaltet Row Level Security ein und
richtet die Trigger für den Einladungscode ein.

**3. Einen Einladungscode erzeugen**

Ebenfalls im SQL Editor:

```sql
insert into public.invite_codes (code, note, max_uses)
values ('NEO-START-2026', 'mein erstes Konto', 1);
```

**4. Schlüssel holen**

*Settings → API*. Du brauchst zwei Werte:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** → `VITE_SUPABASE_ANON_KEY`

> Den `service_role`-Schlüssel **niemals** verwenden. Der umgeht jede
> Zugriffsregel. Der `anon`-Schlüssel ist dagegen als öffentlich gedacht und
> darf im Browser landen — der Schutz kommt aus den Regeln in der Datenbank.

**5. In GitHub hinterlegen**

Repository → *Settings* → *Secrets and variables* → *Actions* → *New repository
secret*. Zwei Stück anlegen, exakt so benannt:

| Name | Wert |
|---|---|
| `VITE_SUPABASE_URL` | die Project URL |
| `VITE_SUPABASE_ANON_KEY` | der anon-public-Schlüssel |

**6. Neu veröffentlichen**

Einen beliebigen Commit nach `main` pushen, oder unter *Actions* den Workflow
*Deploy to GitHub Pages* manuell über *Run workflow* starten.

**7. Erstes Konto anlegen**

Seite öffnen → *Register with invite code* → E-Mail, Anzeigename, Passwort und den
Code aus Schritt 3. Supabase verschickt standardmäßig eine Bestätigungs-E-Mail.
Wenn du das nicht willst: *Authentication → Sign In / Providers → Email* und
*Confirm email* abschalten.

### Weitere Spieler einladen

Code erzeugen und weitergeben:

```sql
insert into public.invite_codes (code, note, max_uses, expires_at)
values ('NEO-CREW', 'Freunde', 5, now() + interval '30 days');
```

Nutzung nachsehen oder Code zurückziehen:

```sql
select code, uses, max_uses, expires_at, note from public.invite_codes;
delete from public.invite_codes where code = 'NEO-CREW';
```

### Lokale Entwicklung

```bash
cp .env.example .env
```

Dieselben zwei Werte eintragen. Ohne sie startet der Entwicklungsserver im
lokalen Modus.

---

## Konfiguration

> Achtung: Variablen mit dem Präfix `VITE_` landen im ausgelieferten Browser-Bundle
> und sind damit öffentlich. Niemals ein echtes Geheimnis dort ablegen.

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
  components/
    AuthGate.tsx       Anmeldung und Registrierung mit Einladungscode
  lib/
    financeUtils.ts    Einzige Quelle der Wahrheit für Kosten, Nachfrage, Preise
    eventSystem.ts     Historische und zufällige Weltereignisse
    imageUtils.ts      Auflösung von Flugzeugbild-URLs
    supabase.ts        Supabase-Client (null, wenn nicht konfiguriert)
    cloudSaves.ts      Spielstände: Cloud mit lokalem Rückfall und Abgleich
  data/                Flughäfen, Flugzeuge, Treibstoffpreise, Catering
supabase/schema.sql    Tabellen, Zugriffsregeln, Einladungscode-Trigger
server.ts              Express-Server: Vite im Dev-Modus, Bild-Upload-API
```

Die Finanzsimulation liegt vollständig in `src/lib/financeUtils.ts`. Alle Ansichten
rufen dieselbe `calculateRouteFinancials`-Funktion auf, damit Vorschau und
Monatsabrechnung nicht auseinanderlaufen.
