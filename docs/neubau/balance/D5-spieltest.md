# Paket D5: Kosten-Faktor Hard vor 1980 (O105 = B)

Stand: 28.11.2026. Auftrag: Antwort B auf O105 umsetzen (`D4-bericht.md`, Abschnitt 3): Kosten-Faktor Hard vor
1980 kleiner, Wert mit der Spieltest-Matrix. Entscheidung E112, Fund 90 in `BALANCE.md`.

## 1. Kurz

- **Neu:** Der Kosten-Faktor der Schwierigkeit (E87) hängt vom Monat ab. Hard 1,05 bis Ende 1979, von 1980 bis 1985
  gerade Linie zu 1,1, danach 1,1 wie bisher. Easy (0,85) und Normal (1) bleiben fest. Die KI rechnet weiter mit 1.
- **Gemessen (1970, DUS, Normal Mode):** Hard ÷ Easy optimierer 28 → **34 %**, luxus 23 → **30 %**. Ziel E106
  („etwa 30–50 % des Easy-Ergebnisses guter Strategien“) damit erreicht, luxus knapp.
- **Nicht betroffen:** Easy und Normal (gleiche Zahlen wie D4), alle Starts ab 1985 (1995, 2025), die KI und der
  Langlauf (der Faktor wirkt nur auf den Spieler).
- Tests: 1 271 grün (1 neu), Lint ohne Fehler. Im Browser nicht geprüft (keine Oberfläche betroffen; der Planer liest
  den Faktor aus dem Modell, R2).

## 2. Umsetzung

| Stelle | Änderung |
|---|---|
| `src/model/constants.ts:133` | `DIFFICULTY_COST_FACTOR_EARLY` (Easy 0,85 · Normal 1 · Hard 1,05), `DIFFICULTY_COST_EARLY_UNTIL` = 1980, `DIFFICULTY_COST_RAMP_YEARS` = 5 |
| `src/model/basics.ts:124` | `difficultyCostFactor(difficulty, month)`: früher Wert, ab 1980 stetig zum späten Wert (`timeOf`, ohne Sprung wie R5) |
| `src/model/monthClose.ts:1389` | Aufruf mit dem Monat des Abschlusses (`X`); Planer und Abschluss rechnen gleich |
| `src/model/basics.test.ts` | Neuer Test E112: Werte 1960, 12/1979, Mitte 1982, 1985, 2025; kein Sprung von Monat zu Monat |
| `SPEZIFIKATION.md` 1.8 | Kosten-Faktor mit Monat, Regel (Test) ergänzt |

Warum eine Rampe statt eines Schnitts am 1.1.1980: Ein Spiel ab 1970 läuft über 1980 hinaus. Ein Sprung um 5 %
der Betriebskosten im Januar 1980 würde knappe Strecken über Nacht in den Verlust drehen. Mit der Rampe steigen die
Kosten über fünf Jahre um etwa 0,08 % je Monat.

## 3. Spieltest-Matrix

`scripts/playtest-matrix.ts --jobs 4 --cache .playtest-runs/d5-105 --only '…'`: 1970 Easy und Hard, optimierer,
vorsichtig, luxus mit Startwert 1 und 2, standard mit Startwert 1 (14 Spiele, kein Fehler, keine Pleite).
Ergebnis der letzten 12 Monate in Mio. $, Mittel zweier Startwerte (standard nur Startwert 1).

**Normal Mode, DUS, 1970–1979**

| Strategie | Easy D4 | **Easy D5** | Hard D4 (1,1) | **Hard D5 (1,05)** | Hard ÷ Easy D4 → D5 |
|---|---|---|---|---|---|
| standard | +0,4 | +0,4 | −4,8 | **−4,3** | – |
| vorsichtig | +22 | +22 | −9,1 | **+1,7** (s1 +7,8, s2 −4,5) | Verlust → 8 % |
| luxus | +59 | +59 | +14 | **+18** (s1 +24, s2 +12) | 23 % → **30 %** |
| optimierer | +92 | +92 | +25 | **+31** (s1 +38, s2 +25) | 28 % → **34 %** |

- Easy trifft D4 auf die Million (optimierer +94 / +89, luxus +60 / +57): Die Läufe sind wiederholbar, der
  Unterschied bei Hard kommt nur vom Faktor.
- Firmenwert nach 10 Jahren Hard ÷ Easy: optimierer 46 %, luxus 44 % (D4: 39 / 40 %).
- Tiefste Kasse guter Strategien auf Hard 0,7–3,3 Mio. $ (D4: 1,1–2,8). Keine Pleite.
- Wirkung: 5 Prozentpunkte weniger Kosten heben Hard um 4–11 Mio. $ im Jahr, das Verhältnis um 6–7 Prozentpunkte.
- Die zwei Startwerte streuen stark (luxus 24 gegen 12 Mio. $). Das Verhältnis aus dem Mittel ist darum eine
  Schätzung auf etwa ± 5 Prozentpunkte.

**1995 und 2025:** nicht neu gerechnet. Der Faktor ist dort 1,1 wie in D4 (`basics.test.ts`, Test E112); die Zahlen aus
`D4-bericht.md`, Abschnitt 2 gelten weiter (1995: 38–45 %, 2025: 50–60 %).

**Langlauf:** nicht neu gerechnet. `difficultyCostFactor` wirkt nur auf den Spieler; die KI rechnet mit Normal (1).

## 4. Offen

Keine neue Frage. Hinweis: luxus liegt mit 30 % am unteren Rand des Bands. Soll Hard 1970 sicher im Band liegen,
wäre 1,03 der nächste Schritt (geschätzt + 2–3 Prozentpunkte); nicht gemessen.
