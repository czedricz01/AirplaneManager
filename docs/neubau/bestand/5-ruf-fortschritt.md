# Bestand: Ruf, Rang, Fortschritt

Paket 1.5 · Stand 17.11.2026 · Commit 631dc2b

Monat = `src/lib/monthClose.ts`. Andere Dateien mit Pfad.
Beispielzahlen sind mit dem echten Code nachgerechnet (Hilfsskript, nicht im Projekt).

## Überblick

Dieser Bereich sagt, wie „gut“ und wie „groß“ die eigene Fluggesellschaft ist, und was sie
deshalb darf:

1. **Ruf** (0–100): eine Zahl, die jeden Monat ein Stück auf ein Ziel zuläuft. Das Ziel kommt
   aus Zufriedenheit (SAT) und Zustand der Flugzeuge. Dazu kommen Zuschläge (Werbung, Meilensteine,
   Rang, Jahresziel) und Abzüge (Streik, gestrichene Flüge). Der Ruf ändert die Nachfrage aller
   eigenen Strecken um −15 % bis +5 %.
2. **Rang** (10 Stufen, Startup bis Global Player): wird nie verloren. Jede Stufe verlangt Strecken,
   Fluggäste, Ruf, Regionen und Jahre. Sie öffnet Flughafen-Größen, Drehkreuze, Werbung,
   Forschungsprojekte und mehr.
3. **Fortschritt**: Meilensteine (31, einmalig), Jahresziele (jeden Dezember eines von drei),
   Forschung (45 Projekte, davon 5 Flugzeugklassen) und die Karriere-Punkte beim Ruhestand.

Rechenweg in einem Bild:

```
Monatsabschluss (Monat:588-695, :995-1069)
  Ruf-Ziel  = 0,65 × SAT-Teil + 0,35 × Zustands-Teil                 Monat:145-160
     SAT-Teil      = Fluggast-gewichtete SAT / 130 × 100 (0…100)
     Zustands-Teil = 0,6 × Kabine + 0,4 × Zelle (Mittel der fliegenden Flugzeuge)
  Ruf neu   = Ruf + (Ziel − Ruf) × 0,15        (nur wenn etwas flog)  Monat:591-603
            + Werbung (0,3 … 2 je Monat)                               Monat:606
            + Meilensteine (+2 … +8)                                   Monat:650-655
            + Rang-Aufstieg (+3 je Stufe)                              Monat:680
            ± Jahresziel (nur Dezember, −3 … +7)                        Monat:1042
  außerhalb des Abschlusses (sofort):
            − Streik ausgesessen 3, − gestrichene Flüge bis 4, + Übernahme 2
                                                    src/App.tsx:457, :475-476, :1867
  Wirkung   Nachfrage × (0,85 + Ruf/100 × 0,2)                        src/lib/gameState.ts:427-429
            Rang-Bedingung, Meilensteine, Jahresziel, Szenario, Karriere-Punkte
```

## Größen

### Ruf

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Startwert | 50 (neues Spiel); Spielstand ohne Wert: 50 | `src/App.tsx:253`, `:1662`; `src/lib/saveMigration.ts:467` | – | Ruf |
| Ruf-SAT (`weightedSat`) | Σ (Strecken-SAT je Klasse × Fluggäste der Klasse) / Σ Fluggäste | Monat:506-514, :597 | SAT (Paket 1.1), Fluggäste | SAT-Teil |
| SAT-Teil | SAT / 130 × 100, gekappt 0–100 | Monat:153 | Ruf-SAT | Ruf-Ziel |
| Kabinen-Mittel | Mittel `conditionInterior` der Flugzeuge, die eine Strecke haben (ungewichtet) | Monat:593-594 | Kabinenzustand | Zustands-Teil |
| Zellen-Mittel | Mittel `conditionGeneral` derselben Flugzeuge | Monat:595 | Zellenzustand | Zustands-Teil |
| Zustands-Teil | 0,6 × Kabine + 0,4 × Zelle, gekappt 0–100 | Monat:154 | obige | Ruf-Ziel |
| Ruf-Ziel | 0,65 × SAT-Teil + 0,35 × Zustands-Teil | Monat:159 | obige | Ruf |
| Monatsschritt | Ruf + (Ziel − Ruf) × 0,15; nur wenn Fluggäste > 0 | Monat:592, :602 | Ruf, Ziel | Ruf |
| Werbung | Σ laufende Kampagnen (lokal 0,5 · national 1 · global 2) + Vielfliegerprogramm 0,3 je Monat | `src/lib/marketing.ts:75-77`, `:190`, `:257-262`; Monat:606 | Kampagnen | Ruf |
| Meilenstein-Bonus | Σ Ruf der neu erreichten Meilensteine (2–8 je Stück) | Monat:653-654; `src/lib/milestones.ts:68-73` | Meilensteine | Ruf |
| Rang-Bonus | +3 je neue Stufe | Monat:680 | Rang | Ruf |
| Jahresziel | erfüllt: +3 … +7; verfehlt: −1 … −3 (nur Dezember) | Monat:1042; `src/lib/annualGoals.ts:185-193` | Jahresziel | Ruf |
| Streik-Abzug | −3, wenn der Streik ausgesessen wird | `src/lib/staff.ts:177`; `src/App.tsx:457` | Entscheidung | Ruf |
| Ausfall-Abzug | −1 je betroffene Strecke × nicht schon anders gestrichener Anteil, höchstens −4, auf 0,1 gerundet | `src/lib/disruptions.ts:97-100`, `:520-523`; `src/App.tsx:475-476` | Entscheidung „streichen“ | Ruf |
| Übernahme-Bonus | +2 je gekaufte Fluggesellschaft | `src/App.tsx:1867` | Übernahme | Ruf |
| Ruf-Nachfrage-Faktor | 0,85 + Ruf/100 × 0,2 (Ruf 0: 0,85 · 50: 0,95 · 75: 1 · 100: 1,05) | `src/lib/gameState.ts:427-429`, `:464` | Ruf | Nachfrage aller eigenen Strecken und Umsteiger (`src/lib/transferUtils.ts:200`) |

### Rang

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Rang-Werte (`RankStats`) | Strecken, Fluggäste des Monats (jede Teilstrecke gezählt), Ruf nach Meilensteinen, Regionen, volle Jahre seit Start | Monat:674; `src/App.tsx:794-801` | Monatsabschluss | Rang |
| Rang-Prüfung | höchste Stufe, deren fünf Bedingungen alle erfüllt sind; Stufen der Reihe nach | `src/lib/airlineRank.ts:136-151` | Rang-Werte | Rang |
| Neuer Rang | max(alter Rang, Prüfung): nie Abstieg | `src/lib/airlineRank.ts:154-156` | obige | alles unten |
| Fortschrittsbalken | Mittel der Anteile (aktuell / Ziel, je höchstens 1) über die Bedingungen > 0 | `src/lib/airlineRank.ts:166-182` | Rang-Werte | Anzeige Karriere |
| Flughafen-Größe erlaubt | 4 (Startup), 5 (Local, Regional), 6 (Domestic), 7 (ab National) | `src/lib/airlineRank.ts:46-99`; `src/lib/airportAccess.ts:19-28` | Rang | Strecken, Verwaltung |
| Ausnahmen Flughafen | Heimat, Flughäfen mit Verwaltung ≥ 1, alle Enden bestehender Strecken | `src/lib/airportAccess.ts:31-44` | Spielstand | Flughafen-Sperre |
| Drehkreuze erlaubt | Rang-Wert (1 … 12) + Meilenstein-Drehkreuze; Free Mode unbegrenzt | `src/lib/airlineRank.ts:206-209` | Rang, Meilensteine | Verwaltungsstufe 2 |
| Rang-Sperren | Vielflieger 2, nationale Werbung 3, VIP-Lounge 4, globale Werbung 6, Übernahme (Krise) 6, Stufe 3 am Flughafen 8, Übernahme (gesund) 9 | `src/lib/airlineRank.ts:187-197` | Rang | Oberfläche |
| Startrang | aus Startwerten (Ruf 50) oder Szenario-Untergrenze; Free Mode: 9 | `src/App.tsx:1608-1610`; `src/lib/airlineRank.ts:220-222` | Modus, Szenario | Rang |

Bedingungen je Stufe (`src/lib/airlineRank.ts:42-103`):

| Stufe | Strecken | Fluggäste/Monat | Ruf | Regionen | Jahre |
|---|---|---|---|---|---|
| 1 Local | 3 | 8 000 | 40 | 1 | 0 |
| 2 Regional | 6 | 25 000 | 45 | 1 | 1 |
| 3 Domestic | 12 | 70 000 | 50 | 1 | 3 |
| 4 National | 24 | 170 000 | 55 | 1 | 6 |
| 5 Continental | 40 | 350 000 | 60 | 2 | 10 |
| 6 International | 65 | 700 000 | 65 | 3 | 15 |
| 7 Intercontinental | 95 | 1 200 000 | 70 | 4 | 22 |
| 8 Flag Carrier | 135 | 2 000 000 | 75 | 5 | 30 |
| 9 Global Player | 190 | 3 500 000 | 80 | 6 | 40 |

### Meilensteine, Jahresziele, Karriere-Punkte

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Meilenstein-Werte | Strecken, Flotte, Kasse nach Monatsgewinn, längste Strecke, Kontinente, Gewinnserie, Ruf, Fluggäste gesamt, Umsteiger des Monats, Widebody/Überschall vorhanden, Übernahmen | Monat:635-648 | Monatsabschluss | Meilensteine |
| Kontinente | Anzahl verschiedener `continentOf` aller Strecken-Enden (kann „OT“ enthalten) | Monat:614-622; `src/lib/geoUtils.ts:107-116` | Strecken | Meilenstein „Reach“ |
| Gewinnserie | Verlust → 0; ohne Strecken unverändert; sonst +1 | Monat:611 | Monatsgewinn | Meilensteine, Moral |
| Meilenstein-Belohnung | Bronze 3 Ruf + 0,5 Mio. $; Silber 5 + 3 Mio. $ + 2 % Slots; Gold 8 + 15 Mio. $ + 3 % Slots; Sonderleistung 4 + 2 Mio. $ + 1 % Slots; einzelne mit eigenem Ruf-Wert oder Drehkreuz | `src/lib/milestones.ts:68-73`, `:85-134` | Stufe | Ruf, Kasse, Slot-Preis, Drehkreuze |
| Slot-Nachlass | Σ Nachlässe, höchstens 30 %; × Forschungs-Faktor | `src/lib/milestones.ts:137`, `:146-156`; `src/App.tsx:265` | Meilensteine, Forschung | Slot-Kauf |
| Jahresziel-Angebot | jeden Dezember drei: Gewinn × 1,1 (mind. 2 Mio. $), ein Fokus-Ziel nach Jahreszahl reihum, Gewinn × 1,35 (mind. 3 Mio. $) | `src/lib/annualGoals.ts:68-77`, `:81-107`, `:115-121`; Monat:1062-1069 | Vorjahr, Strecken, Regionen, Ruf | Ziel-Auswahl |
| Ziel-Belohnung | Geld: 1 % (stetig) bzw. 3 % (hoch) des Ziels, auf 50 000 $ gerundet; Fokus 1–1,5 Mio. $ | `src/lib/annualGoals.ts:74`, `:85-105` | Ziel | Kasse, Ruf |
| Ohne Wahl | im Januar wird das stetige Ziel gesetzt | Monat:1004-1020 | Angebot | Jahresziel |
| Jahres-Stand | Gewinn und Fluggäste aus den Monatsberichten des Jahres; Strecken, Regionen, Ruf von jetzt | `src/lib/annualGoals.ts:166-182`; Monat:1022-1026 | Berichte | Ziel erfüllt |
| Karriere-Punkte | Vermögen 100 × log10(Kasse + Flottenwert in Mio. $) + Rang 80 je Stufe (Free Mode 0) + Meilensteine 10 + Ruf × 2 + Übernahmen 25 + Projekte 15 + Jahre 5 (höchstens 60 Jahre) | `src/lib/careerScore.ts:39-54`; `src/App.tsx:838-849` | Spielstand | Ruhmeshalle |
| Szenario-Sterne | Sieg in ≤ 50 % der Zeit 3, ≤ 75 % 2, sonst 1 | `src/lib/careerScore.ts:114-118` | Szenario | Freischaltung |

### Forschung und Flugzeugklassen

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Bonus-Projekt Kosten, Dauer | (1,2 + 1,3 × Rang) Mio. $ (in $ von 1960); 3 + aufrunden(Rang/2) Monate; einzelne fest | `src/lib/research.ts:80-89` | Rang des Projekts | Projektkosten |
| Projektkosten im Jahr | Grundkosten × (1 + 0,04 × (Jahr − 1960)) | `src/lib/research.ts:196-199` | Jahr | Kasse |
| Gleichzeitige Projekte | 2 + abrunden(Rang/3), höchstens 5 | `src/lib/research.ts:177-179` | Rang | Start-Sperre |
| Start-Sperre | fertig, läuft, Rang zu klein, Vorgänger fehlt, kein Platz, zu wenig Geld | `src/lib/research.ts:286-298` | obige | Oberfläche |
| Fertig | wenn Monate seit Start ≥ Dauer, zu Monatsbeginn | `src/lib/research.ts:312-323` | Zeit | Wirkungen |
| Wirkungen | Summe aller fertigen Projekte; Kostenfaktoren 1 − Summe, mindestens 0,4 | `src/lib/research.ts:253-283` | fertige Projekte | Treibstoff, Nachfrage, Defekte, Moral, Umsteiger, Slots, SAT, Anlauf, Effizienz, Beliebtheit, Wartung, Besatzung, Gebühren, Verpflegung, Abnutzung, Wiederverkauf |
| Nachfrage-Bonus | Nachfrage-Faktor × (1 + Bonus), höchstens +5 % | `src/lib/gameState.ts:488-490` | Forschung | Nachfrage |
| Flugzeugklasse | Überschall (> 1000 km/h); Widebody > 500 Sitze = Jumbo; Narrowbody ≤ 130 Sitze = Regional; sonst ≤ 60 Sitze = Commuter, darüber Regional | `src/lib/aircraftClasses.ts:48-58` | Datenblatt | Kauf-Sperre |
| Offene Klassen | Commuter + erforschte; Free Mode alle; Klassen der eigenen Flotte bleiben offen | `src/lib/aircraftClasses.ts:61-70`; `src/App.tsx:808-812` | Forschung, Flotte | Kauf |
| Startforschung | Klassen-Projekte bis zum Startrang gelten als fertig | `src/lib/research.ts:191-193` | Startrang | Forschung |

Alle 45 Projekte fertig: Treibstoff × 0,93, Nachfrage +5 %, Defekte × 0,7, Moral +5,
Umsteiger +10 %, Slots × 0,92, SAT +2, Anlauf 75 % statt 60 %, Effizienz und Beliebtheit je
+6 Punkte, Wartung × 0,96, Besatzung × 0,97, Gebühren × 0,97, Verpflegung × 0,96,
Abnutzung × 0,94, Wiederverkauf +2,5 %. Summe der Kosten: 1 085 Mio. $ (1960),
2 387 Mio. $ (1990), 3 690 Mio. $ (2020).

## Konstanten

| Wert | Bedeutung | Fundstelle |
|---|---|---|
| 0,15 | Anteil des Abstands zum Ziel, den der Ruf je Monat schließt (Halbwertszeit 4,3 Monate) | Monat:143 |
| 130 | SAT, bei der der SAT-Teil voll ist | Monat:153 |
| 0,65 / 0,35 | Gewicht SAT / Zustand im Ruf-Ziel | Monat:159 |
| 0,6 / 0,4 | Gewicht Kabine / Zelle im Zustands-Teil | Monat:154 |
| 0,85 / 0,2 | Ruf-Nachfrage-Faktor bei Ruf 0 / Spanne bis Ruf 100 (neutral bei 75) | `src/lib/gameState.ts:428` |
| 50 | Start-Ruf | `src/App.tsx:253` |
| 0,5 / 1 / 2 / 0,3 | Ruf je Monat: lokale, nationale, globale Kampagne, Vielflieger | `src/lib/marketing.ts:75-77`, `:190` |
| 3 | Rang-Aufstieg, Streik ausgesessen | Monat:680; `src/lib/staff.ts:177` |
| 1 / 4 | Ausfall: Ruf je Strecke / höchstens | `src/lib/disruptions.ts:97-100` |
| 2 | Übernahme | `src/App.tsx:1867` |
| 3/5/8/4 | Ruf je Meilenstein Bronze/Silber/Gold/Sonderleistung | `src/lib/milestones.ts:68-73` |
| 0,3 | höchster Slot-Nachlass aus Meilensteinen | `src/lib/milestones.ts:137` |
| 2 000 000 | Mindest-Gewinnziel (stetig; hoch × 1,5) | `src/lib/annualGoals.ts:58` |
| 1,1 / 1,35 | Gewinnziel stetig / hoch gegenüber Vorjahr | `src/lib/annualGoals.ts:117`, `:119` |
| 80 | Karriere-Punkte je Rang-Stufe | `src/lib/careerScore.ts:39` |
| 0,04 | Kostenwachstum Forschung je Jahr (linear, von 1960) | `src/lib/research.ts:198` |
| 0,4 | kleinster Kostenfaktor aus Forschung | `src/lib/research.ts:253` |
| 500 / 130 / 60 | Sitzgrenzen Jumbo / Regional-Narrowbody / Commuter | `src/lib/aircraftClasses.ts:48`, `:56-57` |
| 1000 km/h | Grenze Überschall | `src/lib/aircraftClasses.ts:52`; Monat:646 |
| 1 / 0,67 Punkte | höchste Abnutzung je Monat Kabine / Zelle (wirkt auf Zustands-Teil) | Monat:1512-1516 |

## Beispielwerte (nachgerechnet)

Ruf-Ziel je Ruf-SAT und Zustand (Kabine = Zelle):

| SAT | Zustand 100 | 80 | 60 | 40 |
|---|---|---|---|---|
| 50 | 60 | 53 | 46 | 39 |
| 70 | 70 | 63 | 56 | 49 |
| 80 | 75 | 68 | 61 | 54 |
| 90 | 80 | 73 | 66 | 59 |
| 100 | 85 | 78 | 71 | 64 |
| 130 und mehr | 100 | 93 | 86 | 79 |

Weg zum Ziel (Start 50, Ziel 73): nach 1 Monat 53,5 · 3: 58,9 · 6: 64,3 · 12: 69,7 · 24: 72,5.

Ein einmaliger Bonus von +8 ist nach 1 Monat noch 6,8 · nach 3: 4,9 · nach 6: 3,0 · nach 12: 1,1.

Dauernde Zuschläge je Monat heben das Gleichgewicht um Zuschlag / 0,15:
Vielflieger +2,0 · lokale Kampagne +3,3 · nationale +6,7 · globale +13,3 · globale + Vielflieger +15,3.

## Widersprüche und Auffälligkeiten

### W1 · Werbung kauft Ruf dauerhaft
- Befund: Der Kommentar sagt, Ruf „kann nicht gekauft werden, nur verdient“. Werbung addiert aber
  jeden Monat Punkte, nachdem der Ruf zum Ziel gelaufen ist. Im Gleichgewicht liegt der Ruf damit
  um Zuschlag / 0,15 über dem Ziel.
- Fundstelle: Monat:127-131, :602, :606; `src/lib/marketing.ts:75-77`, `:190`
- Folge im Spiel: Eine globale Kampagne mit Vielfliegerprogramm hebt den Ruf dauerhaft um
  15 Punkte. Das sind +3 % Nachfrage auf allen Strecken (zusätzlich zur Kampagnen-Nachfrage) und
  bei Rang-Bedingungen (Ruf 75–80) oft der Unterschied. Schlechte SAT lässt sich so überdecken.
- Vorschlag: Festlegen, ob Werbung Ruf (Ansehen) oder nur Bekanntheit (Nachfrage) bringt. Wenn
  Ruf: als Teil des Ziels rechnen (dann kein Aufschaukeln), nicht als Zuschlag danach.
- Braucht Entscheidung: ja

### W2 · Einmalige Boni und Strafen verfliegen in Monaten
- Befund: Meilensteine, Rang-Aufstieg, Jahresziel, Streik, Ausfall und Übernahme ändern den
  Ruf einmalig. Der Monatsschritt zieht ihn danach zurück zum Ziel.
- Fundstelle: Monat:602, :654, :680, :1042; `src/App.tsx:457`, `:476`, `:1867`
- Folge im Spiel: Ein Gold-Meilenstein (+8) ist nach 6 Monaten noch +3, nach einem Jahr +1.
  Die Meldung „Reputation +8“ verspricht mehr. Dafür kann ein Bonus im richtigen Monat eine
  Rang-Schwelle überspringen, und der Rang bleibt für immer (W6). Ein Jahresziel „Ruf 66“ wird im
  Dezember nach den Dezember-Boni gemessen.
- Vorschlag: Ruf als Ziel-Folger ohne Einmal-Boni bauen (Belohnungen in Geld oder Freischaltungen)
  oder Boni als eigenen, langsam abklingenden Teil führen, der in der Anzeige sichtbar ist.
- Braucht Entscheidung: ja

### W3 · Start-Ruf und Neutralpunkt liegen weit auseinander
- Befund: Neues Spiel startet mit Ruf 50 (Nachfrage −5 %). Neutral ist 75. Die KI rechnet immer
  neutral. Ein Ziel von 75 braucht SAT 80 mit neuen Flugzeugen oder SAT 100 mit Zustand 70.
  Typische Economy-SAT aus 1.1 (ohne Verpflegung, ohne Schalter): 70–78 auf Kurzstrecke, 50 auf
  6 Stunden. Das ergibt Ziele von 60–74.
- Fundstelle: `src/App.tsx:253`; `src/lib/gameState.ts:421-429`; Monat:153-159; 1.1 Beispielwerte
- Folge im Spiel: Viele Spieler bleiben dauerhaft unter 75 und haben gegenüber der KI weniger
  Nachfrage. Die Firmen-Ansicht färbt den Ruf ab 65 grün, obwohl er dort noch −2 % kostet
  (`src/components/MyCompanyView.tsx:250`, `:253`).
- Vorschlag: Neutralpunkt, Startwert und Farbstufen gemeinsam festlegen (= O1).
- Braucht Entscheidung: ja (= O1)

### W4 · Ruf wird an neun Stellen geschrieben, an zwei Orten
- Befund: Der Monatsschritt, Werbung, Meilensteine, Rang und Jahresziel stehen im Monatsabschluss.
  Streik, Ausfall und Übernahme ändern den Ruf sofort in `App.tsx`. Die Grenzen 0 und 100 werden
  je Stelle einzeln geprüft (`Math.min`/`Math.max`).
- Fundstelle: Monat:602, :606, :654, :680, :1042; `src/App.tsx:457`, `:476`, `:1867`
- Folge im Spiel: Keine falsche Zahl gefunden. Aber jede neue Ruf-Quelle braucht eine weitere
  Stelle; die Erklärung „woher kommt mein Ruf“ kann die Oberfläche nicht zeigen.
- Vorschlag: Eine Funktion „Ruf-Änderung“ mit Liste der Ursachen je Monat.
- Braucht Entscheidung: nein

### W5 · Zustand zählt jedes Flugzeug gleich, abgestellte gar nicht
- Befund: Der Zustands-Teil ist das ungewichtete Mittel der Flugzeuge mit Strecke. Ein kleines
  Flugzeug zählt so viel wie ein Jumbo. Abgestellte Flugzeuge zählen nicht.
- Fundstelle: Monat:593-595
- Folge im Spiel: Ein abgenutztes Flugzeug abstellen hebt den Ruf, ohne dass ein Fluggast etwas
  merkt (er fliegt ohnehin nicht damit). Zehn neue Turboprops gleichen einen alten Jumbo mit
  400 Fluggästen je Flug aus. Der Zustand der Kabine steckt außerdem schon in der SAT
  (Abnutzungsfaktor, 1.1); er zählt im Ruf also doppelt.
- Vorschlag: Zustand nach Fluggästen gewichten, oder nur die Zelle hier zählen (die Kabine wirkt
  schon über SAT).
- Braucht Entscheidung: nein

### W6 · Rang hängt an einem einzigen Monat
- Befund: Der Rang prüft die Fluggäste und den Ruf des gerade abgeschlossenen Monats. Er wird nie
  verloren.
- Fundstelle: Monat:674-675; `src/lib/airlineRank.ts:154-156`
- Folge im Spiel: Ein Sommermonat (Saison bis 1,15 auf den Tourismus-Teil, 1.2) oder ein Monat mit
  Meilenstein-Boni (W2) genügt. Danach darf die Gesellschaft schrumpfen, ohne etwas zu verlieren.
  Das ist gewollt („a licence once granted is not taken back“, `src/lib/airlineRank.ts:4`), macht
  den Rang aber zum Zeitpunkt-Spiel.
- Vorschlag: Mittel über 3 oder 12 Monate prüfen, Rang weiter nie verlieren.
- Braucht Entscheidung: ja

### W7 · Rang-Texte zu Forschungsplätzen stimmen nicht
- Befund: Die Plätze folgen `2 + abrunden(Rang/3)`: 3 ab Domestic (3), 4 ab International (6),
  5 ab Global Player (9). Die Rang-Texte versprechen den dritten Platz bei National (4) und den
  fünften bei Flag Carrier (8).
- Fundstelle: `src/lib/research.ts:177-179`; `src/lib/airlineRank.ts:71`, `:95`
- Folge im Spiel: Der Aufstieg zu Flag Carrier meldet „A fifth development project at a time“, die
  Sperre sagt dann „Only 4 projects“.
- Vorschlag: Plätze als Feld in `RANKS` führen und Text daraus erzeugen.
- Braucht Entscheidung: nein (nur welche Stufe gilt: Vorschlag Texte, also 4 und 8)

### W8 · Überschall-Klasse im freien Spiel kaum erreichbar
- Befund: Die Überschall-Klasse erscheint bei Flag Carrier (30 Jahre im Geschäft) und braucht
  24 Monate. Die Concorde wird neu nur von 1976 bis Mitte 1980 geliefert (Monat 192–245).
- Fundstelle: `src/lib/research.ts:155-156`; `src/lib/airlineRank.ts:93`; `src/data/aircraft.ts:22-33`
- Folge im Spiel: Start 1960 → frühestens 1990 Flag Carrier, 1992 erforscht. Neu kaufen geht nicht
  mehr. Ob der Gebrauchtmarkt sie dann anbietet, prüft 1.7. Meilenstein „Flying faster than
  sound“ (+8 Ruf) hängt daran.
- Vorschlag: Klasse an die Zeit statt an den Rang binden, oder früheren Rang.
- Braucht Entscheidung: ja

### W9 · Feste Dollar-Beträge über 60 Jahre
- Befund: Meilenstein-Geld (0,5–15 Mio. $), Kassen-Meilensteine (100 Mio. – 10 Mrd. $),
  Mindest-Gewinnziel (2 Mio. $) und das Vermögen in den Karriere-Punkten sind nominal.
  Forschung wächst mit eigener Rate: 4 % des Werts von 1960 je Jahr; der Kostenindex (1.4) mit
  1,2 % je Jahr.
- Fundstelle: `src/lib/milestones.ts:68-73`, `:112-116`; `src/lib/annualGoals.ts:58`;
  `src/lib/careerScore.ts:43`; `src/lib/research.ts:196-199`; `src/lib/realCosts.ts:19-28`
- Folge im Spiel: 2020 kostet Forschung das 3,4-fache von 1960, Löhne und Gebühren das 2,05-fache.
  Ein Bronze-Meilenstein ist 1960 viel, 2020 wenig wert. Wer später startet, bekommt mehr
  Vermögens-Punkte für dieselbe Leistung.
- Vorschlag: Alle Einmal-Beträge über einen Index (= 1.4 Frage 5).
- Braucht Entscheidung: ja (= 1.4 Frage 5)

### W10 · Stetiges Gewinnziel ohne Geld, auch nach Verlustjahr gleich
- Befund: Das stetige Ziel ist mindestens 2 Mio. $. 1 % davon (20 000 $) wird auf 50 000 $
  gerundet, also 0. Nach einem Verlustjahr ist das Ziel dasselbe wie nach einem kleinen Gewinn.
- Fundstelle: `src/lib/annualGoals.ts:69`, `:74`
- Folge im Spiel: Gewinn −5 Mio., 0 oder +1 Mio. $ im Vorjahr: immer Ziel 2 Mio. $, Belohnung
  +3 Ruf und 0 $. Das hohe Ziel (3 Mio. $) zahlt 100 000 $.
- Vorschlag: Ziel aus Vorjahr und Unternehmensgröße; Geld-Belohnung mit Mindestbetrag.
- Braucht Entscheidung: nein

### W11 · Zwei Erdteil-Einteilungen
- Befund: Meilenstein „Kontinente“ zählt `continentOf`, das „OT“ (keine Region) liefern kann.
  Rang, Werbung und Jahresziel zählen `regionOf`, das „OT“ auf eine der sechs Regionen verteilt.
- Fundstelle: Monat:620; `src/lib/geoUtils.ts:107-116`, `:125-133`; `src/lib/chronicle.ts:107-121`
- Folge im Spiel: Papeete (−17,6; −149,6) zählt beim Meilenstein als eigener „Kontinent“ OT, beim
  Rang als Ozeanien. „Every continent served“ (6) ist damit mit fünf echten Regionen plus OT
  erreichbar.
- Vorschlag: Überall `regionOf`.
- Braucht Entscheidung: nein

### W12 · Texte weichen vom Code ab (klein)
- Befund:
  - Meilensteine „Reputation above 60/80/95“ prüfen ≥ (`src/lib/milestones.ts:120-122`).
  - Forschung „Aircraft efficiency +1%“ heißt +1 Punkt auf der Skala 0–100; bei Effizienz 50 sind
    das 2 % (`src/lib/research.ts:24-27`, `:244`). Gleiches für „Plane type satisfaction +1%“.
  - `demandBonus` heißt im Kommentar „added“, wird aber multipliziert
    (`src/lib/research.ts:205`; `src/lib/gameState.ts:490`).
  - `computeReputationTarget` nimmt noch `loadFactor` an und zählt ihn nicht; der Abschluss
    rechnet ihn trotzdem (`repSeatsWeek`, Monat:149-150, :453, :515, :600). Der Nebenbefund aus
    1.4 (Auslastung mit gewichteten Sitzen) ist damit ohne Wirkung.
- Folge im Spiel: keine falsche Zahl; Erklärtexte ungenau, toter Code.
- Vorschlag: Beim Neubau Texte aus den Konstanten erzeugen (Paket 4.1).
- Braucht Entscheidung: nein

### W13 · Schwierigkeit wirkt hier nirgends
- Befund: Ruf-Ziel, Ruf-Schritt, Rang-Bedingungen, Meilensteine, Ziele und Forschung kennen die
  Schwierigkeit nicht.
- Fundstelle: obige Dateien (kein `difficulty`)
- Folge im Spiel: Auf Hard sinken Nachfrage und Preis (1.2, 1.3), die Rang-Schwellen bei
  Fluggästen bleiben gleich. Hard wirkt dadurch auch auf das Vorankommen, nur indirekt.
- Vorschlag: In 2.2 mitentscheiden (= O6).
- Braucht Entscheidung: ja (= O6)

### W14 · Karriere-Punkte: Free Mode und Normal Mode in einer Liste
- Befund: Free Mode bekommt 0 statt bis zu 720 Rang-Punkte und 75 weniger Forschungs-Punkte
  (Klassen zählen nicht). Beide stehen in derselben Ruhmeshalle (nur markiert). Ruf zählt höchstens
  200, Forschung bis 675.
- Fundstelle: `src/lib/careerScore.ts:42-54`, `:75-79`; `src/App.tsx:846-847`
- Folge im Spiel: Gleiche Leistung über 60 Jahre: Normal 2 700, Free 1 905 Punkte. Alle Projekte
  erforschen bringt fast so viel wie den höchsten Rang.
- Vorschlag: Getrennte Listen oder ein Faktor; Gewichte in 2.x festlegen.
- Braucht Entscheidung: nein

## Doppelte Rechnungen

- Rang-Werte zweimal gebaut: im Abschluss (Monat:674, Fluggäste = `paxWeek × 4` gerundet) und in
  `src/App.tsx:794-801` (Fluggäste aus dem letzten Bericht `paxTotal`, Monat:1253). Gleiche Zahl,
  zwei Wege; Regionen einmal über `regionsServed`, einmal über `routesByRegion`.
- Ruf-Nachfrage-Faktor: Die Firmen-Ansicht ruft `reputationDemandFactor` selbst auf
  (`src/components/MyCompanyView.tsx:253`); richtig. Die eigenen Farbstufen 65/40 sind eine
  zweite, unabhängige Bewertung (W3).
- Jahres-Stand zweimal: im Abschluss für den Dezember (Monat:1022-1026) und in
  `src/App.tsx:823-827` für den Fortschrittsbalken. Beide über `buildYearSnapshot`.
- Erdteile: `continentOf` und `regionOf` (W11).
- Grenzen 0–100 für den Ruf an acht Stellen einzeln (W4).

## Bezug zu bisherigen offenen Fragen

- O1 (Neutralpunkt 75 oder 50): W3 belegt mit Zahlen, dass typische Ziele unter 75 liegen.
- O6 (Schwierigkeit): W13.
- 1.1 Frage 3 (SAT-Skala, Ruf zählt nur bis 130): bestätigt (Monat:153).
- 1.4 Frage 5 (Kostenindex für Einmalpreise): W9 erweitert auf Forschung, Belohnungen, Punkte.
- 1.4 Nebenbefund (Auslastung im Ruf): erledigt, Auslastung zählt nicht mehr (W12).

## Offene Fragen an den Menschen

1. Soll Werbung den Ruf heben, und wenn ja, dauerhaft oder nur solange sie läuft? (W1)
2. Sollen Belohnungen und Strafen den Ruf einmalig ändern (und dann verfliegen), oder nur das
   Ruf-Ziel, oder gar nicht (dann nur Geld und Freischaltungen)? (W2)
3. Rang: Bedingungen an einem Monat oder am Mittel mehrerer Monate prüfen? (W6)
4. Flugzeugklassen: an den Rang binden (heute) oder auch an die Zeit, damit z. B. die Concorde
   erreichbar ist? (W8)
5. Sollen Kabinenzustand und SAT beide in den Ruf zählen, obwohl die Kabine schon in der SAT
   steckt? Und Zustand nach Fluggästen gewichten? (W5)
6. Karriere-Punkte: Was soll am meisten zählen (Vermögen, Rang, Ruf, Forschung), und eine
   gemeinsame Ruhmeshalle für Free und Normal Mode? (W14)
7. Start-Ruf: bei 50 lassen, wenn der Neutralpunkt bei 75 bleibt? (W3, = O1)
