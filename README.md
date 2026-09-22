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

**Es gibt keine Registrierung.** Konten legt der Betreiber im Supabase-Dashboard
an, und die öffentliche Registrierung ist im Projekt abgeschaltet. Der Server
lehnt Kontoerstellung also ab, egal was der Browser schickt.

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
| `Invalid path specified in request URL` | `VITE_SUPABASE_URL` enthält einen Dienstpfad wie `/rest/v1`. Nur die reine Projekt-URL eintragen — die App schneidet solche Endungen inzwischen selbst ab, der Build muss dafür aber neu laufen |

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

Auf <https://supabase.com> ein kostenloses Konto und ein Projekt anlegen.

**2. Schema einspielen**

*SQL Editor* → *New query* → gesamten Inhalt von `supabase/schema.sql`
einfügen → *Run*. Das legt `profiles` und `saves` an und schaltet Row Level
Security ein.

**3. Registrierung abschalten**

*Authentication* → *Sign In / Providers* → *Email* → **Allow new users to sign
up** ausschalten.

Damit kann niemand mehr selbst ein Konto erstellen. Konten entstehen nur noch
dort, wo du sie anlegst.

**4. Schlüssel holen**

*Settings → API*. Zwei Werte:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** → `VITE_SUPABASE_ANON_KEY`

> Bei der Project URL wirklich nur `https://<kennung>.supabase.co` nehmen. Auf
> derselben Seite stehen darunter die Endpunkte für REST, Auth und Storage; wird
> versehentlich `.../rest/v1` kopiert, gehen die Anmeldeanfragen ins Leere und
> Supabase antwortet mit `Invalid path specified in request URL`. Die App
> schneidet solche Endungen inzwischen ab, aber sauber eintragen ist besser.

> Den `service_role`-Schlüssel **niemals** verwenden. Der umgeht jede
> Zugriffsregel. Der `anon`-Schlüssel ist als öffentlich gedacht und darf im
> Browser landen — der Schutz kommt aus den Regeln in der Datenbank.

**5. In GitHub hinterlegen**

Repository → *Settings* → *Secrets and variables* → *Actions* → *New repository
secret*. Zwei Stück, exakt so benannt:

| Name | Wert |
|---|---|
| `VITE_SUPABASE_URL` | die Project URL |
| `VITE_SUPABASE_ANON_KEY` | der anon-public-Schlüssel |

**6. Neu veröffentlichen**

Einen Commit nach `main` pushen, oder *Actions* → *Deploy to GitHub Pages* →
*Run workflow*.

### Konten anlegen

*Authentication* → *Users* → **Add user**:

1. E-Mail eintragen
2. Passwort eintragen
3. **Auto Confirm User** anhaken — sonst muss die Person erst eine
   Bestätigungsmail anklicken
4. *Create user*

E-Mail und Passwort der Person mitteilen. Fertig — sie kann sich anmelden.

Der Anzeigename im Spiel ist standardmäßig der Teil der E-Mail vor dem `@`.
Anders setzen:

```sql
update auth.users
   set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                            || jsonb_build_object('display_name', 'Captain Neo')
 where email = 'someone@example.com';
```

### Konten verwalten

| Aufgabe | Wo |
|---|---|
| Übersicht aller Konten | *Authentication → Users* |
| Passwort zurücksetzen | Zeile → *Reset password* (schickt eine Mail) |
| Konto löschen | Zeile → *Delete user* (Spielstände gehen mit) |
| E-Mail nachträglich bestätigen | Zeile → *Confirm email* |

Wer sein Passwort vergisst, kann es auch selbst über die Passwort-vergessen-Mail
zurücksetzen — das funktioniert, weil die Anmeldung über E-Mail läuft.

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
    AuthGate.tsx       Anmeldung (Konten legt der Betreiber an)
  lib/
    financeUtils.ts    Einzige Quelle der Wahrheit für Kosten, Nachfrage, Preise
    eventSystem.ts     Historische und zufällige Weltereignisse
    imageUtils.ts      Auflösung von Flugzeugbild-URLs
    supabase.ts        Supabase-Client (null, wenn nicht konfiguriert)
    cloudSaves.ts      Spielstände: Cloud mit lokalem Rückfall und Abgleich
  data/                Flughäfen, Flugzeuge, Treibstoffpreise, Catering
supabase/schema.sql    Tabellen und Zugriffsregeln
server.ts              Express-Server: Vite im Dev-Modus, Bild-Upload-API
```

Die Finanzsimulation liegt vollständig in `src/lib/financeUtils.ts`. Alle Ansichten
rufen dieselbe `calculateRouteFinancials`-Funktion auf, damit Vorschau und
Monatsabrechnung nicht auseinanderlaufen.
