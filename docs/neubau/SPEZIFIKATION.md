# Spezifikation des Rechenmodells

Entsteht in Phase 2. Diese Datei ist die einzige Quelle dafür, was das Spiel
rechnen **soll**. Der Code folgt ihr, nicht umgekehrt.

## Aufbau je Größe

```
### <Name> (Code-Name: `<bezeichner>`)
- Bedeutung: <ein Satz, was die Größe im Spiel darstellt>
- Einheit und Bereich: <z. B. Punkte 0 … 160>
- Formel: <einfach geschrieben>
- Hängt ab von: <andere Größen>
- Wirkt auf: <andere Größen, jede Wirkung nur einmal>
- Konstanten: <Name = Wert, Begründung>
- Regeln (werden als Tests geprüft): <z. B. „mehr Service senkt nie die SAT“>
- Anzeige: <wo und wie der Spieler sie sieht>
```

## 1. Grundbegriffe und Einheiten

Dieser Abschnitt legt fest, in welchen Einheiten das Modell rechnet und wie die Größen heißen.
Alle späteren Abschnitte (2–8) halten sich daran. Grundlage: E4–E14, E36, E50, R4, R5.

### 1.1 Zeit

| Begriff | Code-Name | Festlegung |
|---|---|---|
| Spielmonat | `month` | Ganze Zahl; 0 = Januar 1960, 12 = Januar 1961 (wie heute, `src/data/scenarios.ts:21`). |
| Kalenderjahr | `yearOf(month)` | 1960 + abrunden(`month` / 12). Für Tabellen, Lieferzeiträume, Texte. |
| Stetige Zeit | `timeOf(month)` | 1960 + `month` / 12 (Jahre mit Bruchteil). Für alles, was mit der Zeit wächst (Kostenindex, Nachfrage-Wachstum). Keine Sprünge am Jahreswechsel (R5). |
| Woche | – | Grundtakt jeder Strecke: Abflüge, Fluggäste, Erlös und Flugkosten werden je Woche gerechnet. |
| Wochen je Monat | `WEEKS_PER_MONTH` | 365,25 / 12 / 7 ≈ 4,348. Überall dieselbe Konstante (E5). Monatswert = Wochenwert × `WEEKS_PER_MONTH`. |
| Jahr | – | 12 Monate ≈ 52,18 Wochen. Jahreswerte (z. B. Abschreibung, E29) werden durch 12 geteilt, nie durch 48 oder 52. |
| Monatsabschluss | `closeMonth` | Einziger Zeitschritt des Spiels. Alles, was sich über die Zeit ändert (Kasse, Ruf, Zustand, Strecken-Alter), ändert sich hier, einmal je Monat. |
| Flugzeit | `blockMinutes` | Minuten (Blockzeit), ungerundet. Stunden nur in der Anzeige. |

Regeln (Tests):
- Ein Wochenwert × `WEEKS_PER_MONTH` × 12 = Wochenwert × 52,18 (Erlös und Kosten nutzen dieselbe Jahreslänge).
- `timeOf` steigt mit jedem Monat um genau 1/12.

### 1.2 Raum und Mengen

| Größe | Einheit | Hinweis |
|---|---|---|
| Entfernung | km, Großkreis | ungerundet |
| Geschwindigkeit | km/h | Reisegeschwindigkeit aus den Flugzeugdaten; die feste Bezugsgeschwindigkeit für die Marktgröße (E20) steht in Abschnitt 3. |
| Treibstoff | Liter | Tabelle in $ je Gallone (`src/data/fuelPrices.ts`); Umrechnung einmal: 1 Gallone = 3,78541 Liter. |
| Fluggäste | Fluggäste je Woche | Erwartungswert, **nicht gerundet** (R4). Obergrenze: angebotene Sitze. |
| Sitze, Flugzeuge, Abflüge je Woche, Slots | Stück | Ganze Zahlen, weil der Spieler sie so einstellt. |
| Klasse | `economy`, `premium`, `business`, `first` | Immer diese vier (Premium = Premium Economy, wie heute `src/lib/financeUtils.ts:887`); eine Klasse ohne Sitze zählt nicht mit. |

### 1.3 Geld und Kostenindex

**Spiel-Dollar ($).** Alle Beträge sind Spiel-Dollar in festen Preisen. Es gibt keine allgemeine
Inflation. Was sich über die Zeit verschiebt, regelt allein der Kostenindex.

**Kostenindex** (Code-Name: `costIndex(month)`)
- Bedeutung: Wie viel teurer Löhne, Gebühren, Preise und Einmalbeträge gegenüber 1960 sind.
- Einheit und Bereich: Faktor, 1 im Januar 1960, wächst danach stetig.
- Formel: `costIndex = (1 + COST_GROWTH) ^ (timeOf(month) − 1960)`, Zeit begrenzt auf 1960 … 2100.
- Konstanten: `COST_GROWTH = 0,012` je Jahr (Startwert von heute, `src/lib/realCosts.ts:19`);
  endgültiger Wert aus dem Balance-Skript (3.9, E7).
- Wirkt auf (E6, E7): jeden Dollar-Betrag, den das Modell als Konstante festlegt: Löhne, Flughafen-Gebühren,
  Unterhalt, Mieten, **Grundpreise der Tickets**, Einmalpreise (Slots, Verwaltungsstufen, Einrichtungen,
  Kabinen-Umbau), Belohnungen, Forschungskosten, KI-Zuschuss (solange es ihn gibt, E47),
  **Listenpreise der Flugzeuge** (E54): Kaufpreis = Listenpreis aus `src/data/aircraft.ts` × `costIndex`
  des Kaufmonats; das Wertmodell (E29) rechnet ab diesem Kaufpreis (Einzelheiten Abschnitte 5 und 8).
- Wirkt nicht auf:
  - die Treibstoff-Tabelle (echte Preise, E8),
  - Beträge, die als **Anteil einer anderen Größe** festgelegt sind (z. B. Krisen-Antworten als Anteil der
    Treibstoff-Rechnung, E6, E35; Grundüberholung als Anteil des Listenpreises, E31). Sie wachsen mit
    ihrer Bezugsgröße; ein zweiter Index würde doppelt zählen.
- Schreibweise im Modell: Feste Beträge stehen als Wert von 1960 in den Konstanten (Endung `_1960`,
  z. B. `SLOT_PRICE_NARROWBODY_1960`). Sie werden nur über eine Funktion `atCost(betrag1960, month)`
  umgerechnet. Eine zweite Stelle mit `costIndex` gibt es nicht.
- Regeln (Tests):
  - `costIndex(0) = 1`; `costIndex` sinkt nie mit der Zeit.
  - Jeder feste Betrag im Jahr 2020 = Betrag 1960 × `costIndex` 2020 (Stichprobe je Bereich).
  - Ein Betrag, der als Anteil festgelegt ist, ändert sich nicht, wenn nur der Kostenindex steigt
    und die Bezugsgröße gleich bleibt.
- Anzeige: Texte und Preise in der Oberfläche zeigen immer den Betrag des aktuellen Monats (E52, 4.1).

### 1.4 Skalen

Jede Skala hat einen Namen, einen Bereich und, wo nötig, einen Neutralpunkt. Grenzen werden einmal
gesetzt, am Ende der Funktion, die die Größe festlegt (R4).

| Größe (Oberfläche) | Code-Name | Bereich | Neutral / Bedeutung | Quelle |
|---|---|---|---|---|
| Satisfaction (je Klasse) | `satisfaction` | 0 … 160 Punkte | 100 = „wie erwartet“, 160 = Spitze | E9, E14 |
| Route satisfaction | `routeSatisfaction` | 0 … 160 Punkte | Mittel der Klassen, nach Fluggästen gewichtet | E9, E10 |
| Cabin rating | `cabinRating` | 0 … 100 Punkte | Wert der Kabine eines Flugzeugs; Erwartung je Klasse in Abschnitt 2 | E9 |
| Type appeal | `typeAppeal` | 0 … 100 Punkte | Beliebtheit des Flugzeugtyps | E9 |
| Service points | `servicePoints` | Punkte, Bereich in Abschnitt 2 | Beitrag von Essen, Getränken, Extras | E9 |
| Reputation | `reputation` | 0 … 100 Punkte | **50 = neutral** (Nachfrage-Faktor 1); Start 50 | E36 |
| Zustand (Kabine, Zelle) | `cabinCondition`, `airframeCondition` | 0 … 100 % | 100 = neu | – |
| Passenger share | `passengerShare` | 0 … 1 (Anzeige %) | Anteil an den Fluggästen eines Städtepaars | E9 |
| Departure share | `departureShare` | 0 … 1 (Anzeige %) | Anteil an den Abflügen eines Städtepaars | E9 |

**Faktoren.** Jeder Faktor ist eine Zahl ohne Einheit mit **1 = neutral**. Der Neutralpunkt ist der
übliche Zustand (Schwierigkeit Normal, Ruf 50, Satisfaction 100, keine Saison-Abweichung). Ein Faktor
wirkt an genau einer Stelle (R2); welche, steht bei der Größe in den Abschnitten 2–8.

**Prozent.** Intern immer als Anteil 0 … 1 gerechnet (Ausnahme: Zustand, wie heute in % gespeichert).
Prozent nur in der Anzeige.

### 1.5 Namen

Neue Namen nach E9. Die Oberfläche nutzt die englischen Namen; der Code dieselben Wörter in camelCase.
„SAT“, „Loyalty“ und „Market share“ gibt es nicht mehr als Sammelnamen.

| Oberfläche | Code-Name | Bedeutung | Heute |
|---|---|---|---|
| Type appeal | `typeAppeal` | Beliebtheit eines Flugzeugtyps (mit Alter, Neuheit, Forschung) | „Plane type satisfaction“, `popularity` |
| Cabin rating | `cabinRating` | Wert der eingebauten Kabine eines Flugzeugs, 0–100 | „63% SAT“, `getPlaneSat` |
| Service points | `servicePoints` | Punkte aus Essen, Getränken, Extras | `sat` in `src/data/catering.ts` |
| Satisfaction | `satisfaction` | Zufriedenheit einer Klasse auf einer Strecke, 0–160 | SAT je Klasse |
| Route satisfaction | `routeSatisfaction` | Zufriedenheit der Strecke, nach Fluggästen gewichtet | sitzgewichtete SAT |
| Established route bonus | `establishedRouteBonus` | Zuschlag für alte Strecken | „Loyalty“ in `routeMaturity.ts` |
| Frequent flyer | `frequentFlyer` | Vielflieger-Programm (Anziehung) | „Loyalty“ in `marketing.ts` |
| Passenger share | `passengerShare` | Anteil an den Fluggästen | `marketShare` |
| Departure share | `departureShare` | Anteil an den Abflügen | `departureMarketShare` |
| Reputation | `reputation` | Ruf der Gesellschaft, 0–100 | unverändert |

**Weitere Grundbegriffe** (gelten für alle Abschnitte):

| Begriff | Code-Name | Bedeutung |
|---|---|---|
| Gesellschaft | `airline` | Spieler oder KI. Alle rechnen mit denselben Regeln (E44). |
| Städtepaar / Markt | `market` | Zwei Flughäfen, ohne Richtung. Ein Markt-Modell je Paar (E13, R1). |
| Angebot | `offer` | Was eine Gesellschaft auf einem Paar anbietet: Sitze je Klasse, Abflüge je Woche, Preise, Satisfaction, Flugzeit. Auch Umsteige-Verbindungen sind Angebote. |
| Strecke | `route` | Ein Flugzeug fliegt ein Paar hin und zurück. Mehrere Strecken einer Gesellschaft auf einem Paar bilden ein Angebot (R1). |
| Abflug | `departure` | Ein Flug, der an einem Flughafen startet. Abflüge werden je Richtung gezählt. |
| Grundpreis | `baseFare` | Preis je Klasse aus Entfernung und Flugzeit, × Kostenindex (E7). |
| Marktpreis | `marketFare` | Bezugspreis des Markts, an dem jedes Angebot gemessen wird (E13); Herleitung in Abschnitt 4. |
| Fehlender Preis | – | = Marktpreis, an einer Stelle (R8). |
| Drehkreuz | `hub` | Flughafen mit Verwaltungsstufe einer Gesellschaft. |
| Rang | `rank` | Stufe der Gesellschaft; Regeln in Abschnitt 6. |
| Startwerte | `START_*` | Ruf, Kasse je Startkapital-Stufe, Startflotte als Konstanten (E11). |

### 1.6 Slot

**Slot** (Code-Name: `slot`)
- Bedeutung: Das Recht, an einem Flughafen **einmal je Woche abzufliegen** (E50).
- Einheit und Bereich: Stück, ganze Zahl, je Gesellschaft und Flughafen.
- Formel: Belegte Slots an Flughafen X = Summe der Abflüge je Woche aller Strecken der Gesellschaft,
  die in X starten. Hin- und Rückflug einer Strecke belegen je einen Slot an ihrem Abflughafen.
  Ankünfte brauchen keinen Slot.
- Hängt ab von: Flugplan (Abflüge je Woche).
- Wirkt auf: ob eine Strecke angelegt oder erweitert werden darf; Slot-Unterhalt (Abschnitt 5).
- Konstanten: Grenze je Flughafen im Modell (E50); Slot-Arten und Preise in Abschnitt 5.
- Regeln (Tests):
  - Belegte Slots ≤ gekaufte Slots, für Spieler und KI.
  - Eine Strecke mit 7 Umläufen je Woche belegt 7 Slots an jedem ihrer zwei Flughäfen.
  - Die Summe der Slots aller Gesellschaften an einem Flughafen überschreitet seine Grenze nicht.
- Anzeige: Planer und Flughafen-Ansicht lesen „belegt / gekauft / Grenze“ aus dem Modell (R2).

### 1.7 Rundung (R4)

- **Intern ungerundet.** Das Modell rechnet mit Gleitkommazahlen. Kein `Math.round`, `floor` oder `ceil`
  in Zwischenschritten. Ausnahmen nur für Stück-Größen aus 1.2 (Sitze, Flugzeuge, Abflüge, Slots) und
  für `yearOf`.
- **Einmal kappen.** Jede Skala aus 1.4 wird an genau einer Stelle auf ihren Bereich begrenzt: am Ende
  der Funktion, die sie festlegt. Leser kappen nicht noch einmal.
- **Geld ungerundet.** Auch die Kasse wird ungerundet gebucht.
- **Runden nur in der Anzeige**, über die Format-Funktionen (`src/lib/format.ts`):
  Geld auf ganze $ (bzw. k / M), Punkte-Skalen auf ganze Punkte, Anteile auf ganze %.
  Summen in Tabellen werden aus ungerundeten Werten gebildet; eine Abweichung von 1 zur Summe der
  gerundeten Zeilen ist erlaubt.
- Regeln (Tests):
  - Kleine Änderungen wirken: +0,3 Punkte in einem Teil der Satisfaction ändern das Ergebnis (heute
    oft 0, 1.1 W6).
  - Keine Modell-Funktion gibt für eine Skala einen Wert außerhalb ihres Bereichs zurück.

### 1.8 Schwierigkeit (E4)

**Schwierigkeit** (Code-Name: `difficulty`, Werte `Easy` · `Normal` · `Hard`)
- Bedeutung: Wie leicht der **Spieler** Fluggäste gewinnt.
- Formel: ein Faktor `difficultyFactor`: Normal = 1; Easy > 1; Hard < 1. Startwerte Easy 1,1 und
  Hard 0,9; endgültige Werte aus dem Balance-Skript (3.9).
- Wirkt auf: **nur die Anziehung der Spieler-Angebote** im gemeinsamen Markt (E53), an genau einer Stelle
  (Abschnitt 3), wie ein fester Zu- oder Abschlag. Die Marktgröße und die Rechnung der KI bleiben ohne
  Schwierigkeit. Ohne Rivalen wirkt der Faktor etwas schwächer als sein Wert (Wettbewerb nur gegen
  „Nicht fliegen“); die Stärke wird im Balance-Skript (3.9) eingestellt.
- Wirkt nicht auf: Preise, Marktpreis, Treibstoff, Kosten, Satisfaction, Ruf, Rang; nie auf die KI.
- Regeln (Tests):
  - Auf Normal ändert die Schwierigkeit keine Zahl im Modell.
  - KI-Ergebnisse auf einem Paar ohne Spieler sind auf Easy, Normal und Hard gleich.
  - Ein Wechsel der Schwierigkeit ändert keine Kosten und keinen Preis.

**KI-Stärke** (Code-Name: `rivalStrength`, Werte `Easy` · `Normal` · `Hard`; Oberfläche wie heute)
- Bedeutung: Wie geschickt die KI handelt. Getrennte Einstellung beim Spielstart (wie heute).
- Wirkt nur auf das **Verhalten** der KI: Startkasse, Startflotte, Suchbreite, Schätzfehler, Kaufneigung
  (heute: `bestand/6-konkurrenz.md`, Größen „Startkasse“ bis „Schätzfehler“). Werte in Abschnitt 7.
- Wirkt nie auf die Wirtschaft der KI (Nachfrage, Preise, Kosten, Treibstoff), E4, E44.

## 2. Zufriedenheit

Dieser Abschnitt legt fest, wie zufrieden die Fluggäste einer Klasse auf einer Strecke sind und wohin
diese Zufriedenheit wirkt. Grundlage: E9, E10, E14–E19, E33, E39, E44, R2–R5, R14, R16;
Bestand: `bestand/1-zufriedenheit.md` (W1–W15). Alle heutigen Fundstellen ohne Pfad liegen in
`src/lib/financeUtils.ts`.

### 2.0 Überblick

Je Klasse wird verglichen: **was geboten wird** gegen **was die Klasse bei dieser Flugzeit erwartet**.
100 heißt „genau wie erwartet“.

```
Type appeal ─┐
Interior score ─┼─► Cabin rating ──► Kabinen-Teil ─┐
Cabin condition ┘                                   │
Service points (Essen, Extras, Bordservice) ─► Service-Teil ─┤
Lounge, Stellplätze, Schalter-Art, Schalter-Last ─► Boden-Teil ─┼─► Satisfaction je Klasse (0 … 160)
Personalmoral ─► Personal-Teil ─┤
Forschung ─► Forschungs-Teil ─┘

Satisfaction je Klasse ─► Offer satisfaction ─► satisfactionFactor ─► Anziehung (Abschnitt 3)
Satisfaction je Klasse + Fluggäste ─► Route satisfaction (Anzeige)
                                   ─► Airline satisfaction ─► Ruf-Ziel (Abschnitt 6)
```

**Wirkungswege (W8, E13, E39).** Satisfaction wirkt genau auf zwei Wegen:
1. **Anziehung des Angebots** im Markt, über `satisfactionFactor` (2.10), einmal. Kein eigener
   „fairer Preis“ und keine zweite Qualitäts-Anziehung mehr.
2. **Ruf**, langsam, über `airlineSatisfaction` (2.9) im Ruf-Ziel (Abschnitt 6).

Satisfaction wirkt nicht auf: Marktgröße, Preise, Kosten, Rang direkt.

**Was entfällt** (gegenüber heute):
- Ausfall-Abzug −50 bei gestrichenen Flügen (`:1312`): gestrichene Flüge wirken nur auf den Ruf (E33).
- Schalter-Abzug für fehlende Schalter −15 (`:536`): ein Schalter ist Pflicht (E18, siehe 2.6.3).
- Selbstbedienungs-Abzug −1 (`:575-577`, R16).
- SAT-Faktor-Zweig über 200 (`:748-750`, R16) und die Qualitäts-Anziehung `(SAT/100)^0,8` (`:1122-1137`):
  beides ersetzt `satisfactionFactor`.
- Forschung über die Typ-Beliebtheit (`src/lib/research.ts:248`): wirkt direkt als Punkte (E19).

### 2.1 Flugzeit-Index (Code-Name: `flightTimeIndex`)
- Bedeutung: Wie lang ein Flug für die Erwartungen der Fluggäste zählt, als stufenloser Wert.
- Einheit und Bereich: Zahl 1 … 8, ohne Einheit.
- Formel: gerade Linie zwischen den Stützpunkten (Minuten → Index)
  30 → 1, 90 → 2, 150 → 3, 210 → 4, 300 → 5, 450 → 6, 630 → 7, 810 → 8;
  darunter 1, darüber 8 (wie heute, `:246-262`).
- Hängt ab von: `blockMinutes` der Strecke (eine Richtung).
- Wirkt auf: Kabinen-Gewicht, Service-Erwartung, Service-Höchstabzug, Mahlzeiten-Zahl, Boden-Gewicht
  (alle in diesem Abschnitt). Andere Abschnitte dürfen ihn lesen, rechnen ihn aber nicht nach.
- Konstanten: `FLIGHT_TIME_INDEX_ANCHORS` (Liste oben).
- Ersetzt: die Flugzeitklasse 1–8 in Stufen (`:222`) für alle Zwecke dieses Abschnitts (R5, W2).
- Regeln (Tests):
  - Steigt nie mit kürzerer Flugzeit; 1 Minute mehr ändert ihn um höchstens 1/60.
  - An den Stützpunkten genau die Werte der Liste.
- Anzeige: keine eigene; erklärt im Glossar (4.1).

### 2.2 Type appeal (Code-Name: `typeAppeal`)
- Bedeutung: Wie gern Fluggäste mit diesem Flugzeugtyp fliegen, abhängig vom Alter des einzelnen Flugzeugs.
- Einheit und Bereich: Punkte 0 … 100.
- Formel:
  `typeAppeal = kappen(catalogAppeal − ageDecay + launchBonus, 0, 100)`
  - `catalogAppeal`: Wert `popularity` des Typs in `src/data/aircraft.ts` (Daten, unverändert).
  - `ageDecay = kappen(age − TYPE_APPEAL_DECAY_FROM, 0, TYPE_APPEAL_DECAY_MAX)`, `age` = Alter in
    Jahren **mit Bruchteil** (Monate seit Bau / 12), keine Sprünge am Jahrestag (R5).
  - `launchBonus = LAUNCH_BONUS`, solange der Erstkunden-Zeitraum läuft (Vorbestellung, Abschnitt 8), sonst 0.
- Hängt ab von: Flugzeugtyp, Baumonat, Erstkunden-Zeitraum, `month`.
- Wirkt auf: `cabinRating` (2.4), nur dort.
- Konstanten: `TYPE_APPEAL_DECAY_FROM = 8` Jahre, `TYPE_APPEAL_DECAY_MAX = 15` Punkte
  (heute `src/lib/fleetCosts.ts:27-28`); `LAUNCH_BONUS = 5` Punkte, `LAUNCH_BONUS_MONTHS = 24`
  (heute `src/lib/preorders.ts:31-32`).
- Nicht mehr enthalten: Forschung (E19, siehe 2.6.5).
- Berechnet, nicht gespeichert: Der Wert wird bei Bedarf aus Typ, Baumonat und Monat berechnet.
  Das heutige Feld `popularity` am einzelnen Flugzeug (`src/lib/monthClose.ts:1528-1539`) entfällt (5.1).
- Regeln (Tests):
  - Ein älteres Flugzeug desselben Typs hat nie mehr Type appeal (ohne Erstkunden-Bonus).
  - Bis 8 Jahre kein Verlust; ab 23 Jahren genau −15.
  - Gleicher Typ, gleiches Alter: gleicher Wert für Spieler und KI.
- Anzeige: Flottenansicht und Kaufdialog als „Type appeal“ (Punkte von 100).

### 2.3 Interior score (Code-Name: `interiorScore`)
- Bedeutung: Wert der eingebauten Sitze und Ausstattung einer Klasse, wie im Kauf- oder Umbau-Dialog gewählt.
- Einheit und Bereich: Punkte ≥ 0, ohne Obergrenze (Zwischenwert; gekappt wird erst in `cabinRating`).
- Formel je Klasse `c` (heute nur in der Oberfläche, `src/components/ConfigurePurchaseView.tsx:402-484`;
  neu im Modell, `src/model/kabine.ts`, R3):
  ```
  interiorScore(c) = max(0,
      INTERIOR_BASE[c]
    + SEAT_TYPE_FACTOR × Sitztyp-Punkte (c)
    + (Sitzabstand(c) − PITCH_NORM[c]) × PITCH_FACTOR[c]
    + Summe der Punkte der eingebauten Ausstattung der Klasse (FEATURE_POINTS[c])
    + Summe der Punkte der kabinenweiten Extras (CABIN_EXTRA_POINTS))
  ```
  Ungerundet (R4). Ausstattung zählt nur, wenn sie im Einbaumonat lieferbar war (Lieferbarkeit = Daten,
  wie heute).
- Hängt ab von: Kabinen-Ausstattung des Flugzeugs (gespeichert beim Kauf oder Umbau).
- Wirkt auf: `cabinRating` (2.4), nur dort.
- Konstanten (Startwerte = heute):
  - `INTERIOR_BASE` Economy 50, Premium 55, Business 60, First 70.
  - `SEAT_TYPE_FACTOR = 2`.
  - `PITCH_NORM` 74 / 85 / 100 / 150, `PITCH_FACTOR` 4 / 3 / 2,4 / 1,6 (Economy / Premium / Business / First).
  - `FEATURE_POINTS` und `CABIN_EXTRA_POINTS` wie heute `FEATURE_POP`, `CABIN_EXTRA_POP`
    (`src/components/ConfigurePurchaseView.tsx:98-106`), z. B. WLAN +5, Dusche +10, „Minimal services“ −7,5.
- Gespeichert wird die **Ausstattung**, nicht die Punktzahl. Alte Flugzeuge mit nur einem Durchschnittswert
  (`baseInteriorPop`) bekommen in 5.1 diesen Wert als Punktzahl jeder Klasse.
- KI: Ausstattung je Klasse aus ihrer Strategie (Abschnitt 7), dieselbe Funktion. Bis dahin Startwert je
  Strategie wie heute 42 … 78 für jede Klasse (`src/lib/aiSimulation.ts:160-166`).
- Regeln (Tests):
  - Mehr Ausstattung oder mehr Sitzabstand senkt den Interior score nie.
  - Eine kabinenweite Extra-Ausstattung wirkt in jeder Klasse gleich stark.
  - Kaufdialog-Anzeige = Modellwert (keine zweite Formel in der Ansicht, R2).
- Anzeige: Kauf- und Umbau-Dialog, je Klasse, mit Aufschlüsselung.

### 2.4 Cabin rating (Code-Name: `cabinRating`)
- Bedeutung: Wie gut die Kabine einer Klasse eines bestimmten Flugzeugs heute ist (Typ, Ausstattung, Abnutzung).
- Einheit und Bereich: Punkte 0 … 100.
- Formel je Klasse `c`:
  `cabinRating(c) = kappen(TYPE_APPEAL_SHARE × typeAppeal + INTERIOR_SHARE × interiorScore(c) × wearFactor, 0, 100)`
  mit `wearFactor = WEAR_FLOOR + (1 − WEAR_FLOOR) × cabinCondition / 100`.
- Hängt ab von: `typeAppeal`, `interiorScore(c)`, `cabinCondition`.
- Wirkt auf: Kabinen-Teil (2.6.1), nur dort.
- Konstanten: `TYPE_APPEAL_SHARE = 0,33`, `INTERIOR_SHARE = 0,67` (heute `:523`);
  `WEAR_FLOOR = 0,4` (abgenutzte Kabine behält 40 %, heute `:499`).
- Neu: einmal gekappt, ungerundet (heute gerundet und nicht gekappt, W6); immer je Klasse.
- Regeln (Tests):
  - Besserer Kabinenzustand, höherer Type appeal oder höherer Interior score senken den Wert nie.
  - Wert liegt immer in 0 … 100.
- Anzeige: Flottenansicht, Flugzeug-Details, Planer: **je Klasse** als „Cabin rating“. Wo eine Zahl je
  Flugzeug nötig ist (Listen), das sitzgewichtete Mittel der Klassen, beschriftet „Cabin rating (avg.)“.
  Heute zwei Zahlen für dasselbe Flugzeug (Durchschnitt und je Klasse, `src/components/MyFleetView.tsx:127`).

### 2.5 Service points (Code-Name: `servicePoints`)
- Bedeutung: Was eine Klasse an Bord an Essen, Getränken und Extras bekommt, als Punkte.
- Einheit und Bereich: Punkte ≥ 0.
- Formel je Klasse:
  ```
  servicePoints = Σ_k mealWeight(k) × menuPoints(Menü k)  +  extrasPoints  +  onboardServicePoints
  ```
  - **Menü-Wert** `menuPoints` (E16, W1): Die gewählten Gerichte einer Mahlzeit nach Punkten absteigend
    sortiert, p1 ≥ p2 ≥ …:
    `menuPoints = p1 + MENU_COURSE_SHARE × p2 + MENU_COURSE_SHARE² × p3 + …`
    Das beste Gericht zählt voll, jedes weitere weniger, aber immer etwas.
  - **Mahlzeiten-Zahl** `mealCount` (R5, W2), stufenlos:
    `mealCount = 1 + (MEALS_MAX − 1) × kappen((flightTimeIndex − MEAL_RAMP_FROM) / (MEAL_RAMP_TO − MEAL_RAMP_FROM), 0, 1)`.
  - **Gewicht der Mahlzeit k** (k = 1, 2, 3): `mealWeight(k) = kappen(mealCount − (k − 1), 0, 1)`.
    Mahlzeit 1 zählt immer voll; Mahlzeit 2 und 3 wachsen mit der Flugzeit stufenlos hinein.
    Eine Mahlzeit ohne gewähltes Menü zählt 0 (keine Kopie von Mahlzeit 1, W15 löst 5.1).
  - **Extras und Bordservice:** Summe der Punkte; je Gruppe (WLAN, Kits, Alkohol …) zählt nur die beste
    gewählte Stufe (wie heute, `:432-469`). Was das Flugzeug oder der Flughafen nicht liefern kann, zählt
    nicht (heutige Prüfung `validateClassConfigs`, ins Modell).
- Hängt ab von: Auswahl je Klasse und Strecke, `flightTimeIndex`, Ausstattung von Flugzeug und Flughäfen.
- Wirkt auf: Service-Teil (2.6.2). Dieselben `mealWeight(k)` bestimmen die Catering-Kosten (Abschnitt 5);
  die Formel steht nur hier.
- Konstanten: `MENU_COURSE_SHARE = 0,5`; `MEALS_MAX = 3`; `MEAL_RAMP_FROM = 5` (300 min),
  `MEAL_RAMP_TO = 7,5` (720 min). Punkte und Kosten der Gerichte und Extras: `src/data/catering.ts`
  (Feld `sat` heißt dort künftig `points`).
- Beispiel: Wagyu (60) allein = 60; Wagyu + Butterkeks (5) = 62,5 (heute 34,9). 2 Schinkenbrote als
  Mahlzeit 1 und 2 bei 359 und 360 min: 8 × 1 + 8 × 0,31 ≈ 10,5 Punkte bei beiden (heute Sprung von 8 auf 16).
- Regeln (Tests):
  - Ein weiteres Gericht, Extra oder Bordservice senkt `servicePoints` nie.
  - Wagyu + Butterkeks > Wagyu allein.
  - 1 Minute mehr Flugzeit ändert `servicePoints` um weniger als 1 % (kein Sprung bei 360 oder 720 min).
  - Mahlzeiten-Gewichte für Satisfaction und Catering-Kosten sind dieselben Zahlen.
- Anzeige: Planer (Kabinen-Overlay) je Klasse „Service points: geliefert / erwartet“, mit Gewicht je Mahlzeit.

### 2.6 Teile der Satisfaction

Jeder Teil ist eine Zahl in Satisfaction-Punkten (positiv = besser als erwartet). Teile werden nicht
einzeln gerundet oder gekappt, außer wo eine Grenze ausdrücklich zur Form gehört (Kabine, Service-Gewinn).

#### 2.6.1 Kabinen-Teil (Code-Name: `cabinPart`)
- Formel: `cabinPart = CABIN_LIMIT × tanh((cabinRating(c) − CABIN_EXPECTATION[c]) × cabinWeight / CABIN_LIMIT)`,
  `cabinWeight = CABIN_WEIGHT_BASE + CABIN_WEIGHT_PER_INDEX × (flightTimeIndex − 1)`.
- Konstanten (heute `:779-783`): `CABIN_EXPECTATION` Economy 55, Premium 60, Business 68, First 80;
  `CABIN_WEIGHT_BASE = 0,5`, `CABIN_WEIGHT_PER_INDEX = 0,1` (0,5 bei 30 min, 1,2 ab 810 min);
  `CABIN_LIMIT = 30` (mehr als ±30 bewirkt die Kabine nie).
- Regeln: steigt mit `cabinRating`; 0 bei Erwartung; auf Langstrecke stärker als auf Kurzstrecke.

#### 2.6.2 Service-Teil (Code-Name: `servicePart`)
- Formel: `expected = SERVICE_EXPECTATION[c].base + SERVICE_EXPECTATION[c].perIndex × (flightTimeIndex − 1)`,
  `ratio = servicePoints / expected`.
  - unter Erwartung (`ratio < 1`): `servicePart = −maxShortfall × (1 − ratio)` mit
    `maxShortfall = (SHORTFALL_BASE + SHORTFALL_PER_INDEX × (flightTimeIndex − 1)) × SHORTFALL_CLASS[c]`;
  - ab Erwartung: `servicePart = SERVICE_DELIGHT × (1 − e^−(ratio − 1))`.
- Konstanten (heute `:788-799`): `SERVICE_EXPECTATION` (Grund / je Index) Economy 5 / 10, Premium 12 / 14,
  Business 25 / 21, First 40 / 33; `SHORTFALL_BASE = 6`, `SHORTFALL_PER_INDEX = 9`;
  `SHORTFALL_CLASS` 1 / 1,1 / 1,25 / 1,4; `SERVICE_DELIGHT = 25`.
- Stärke der Abzüge im Balance-Skript (3.9) prüfen, zusammen mit `satisfactionFactor` (E15, W9).
- Regeln: steigt mit `servicePoints`; 0 genau bei Erwartung; nie unter `−maxShortfall`, nie über 25.

#### 2.6.3 Boden-Teil (Code-Name: `groundPart`)
- Bedeutung: Erlebnis am Boden an beiden Enden der Strecke (beide sind Abflughäfen: Hin- und Rückflug).
- Formel (E17, W3): Jeder Bodenteil wird je Flughafen bestimmt, dann **Mittelwert beider Enden**, dann
  für alle Teile dasselbe Bodengewicht:
  ```
  groundPart = groundWeight × Σ_Teil (Teil(Start) + Teil(Ziel)) / 2
  groundWeight = GROUND_WEIGHT_BASE − GROUND_WEIGHT_PER_INDEX × (flightTimeIndex − 1)
  ```
  Teile je Flughafen (immer die eigenen Einrichtungen der Gesellschaft dort):
  - **Lounge** `loungePoints`: VIP-Lounge vorhanden → `LOUNGE_POINTS[c]`, sonst 0.
  - **Stellplätze** `standPoints`: `STAND_POINTS × min(1, Stellplätze / belegte Slots)` der Größenklasse
    des Flugzeugs; ohne belegte Slots 0.
  - **Schalter-Art** `deskTypePoints`: Premium, Business und First an einem Flughafen ohne **bedienten**
    Schalter (nur Selbstbedienung) → `DESK_TYPE_PENALTY`; Economy immer 0. *(vorläufig, O52)*
  - **Schalter-Last** `deskOverloadPoints`: aus der Auslastung der eigenen Schalter (unten), 0 … −20.
- **Schalter-Pflicht (E18):** Jede Strecke braucht an beiden Enden mindestens einen Schalter der
  Gesellschaft; der Planer legt sie sonst nicht an. Ein Abzug für „kein Schalter“ existiert nicht.
  *(Lesart „beide Enden“: O52.)*
- **Schalter-Auslastung** (Code-Name: `deskLoad`) je Gesellschaft und Flughafen:
  `deskLoad = Σ (Sitze × Abflüge je Woche) aller eigenen Strecken, die dort abfliegen / Kapazität`,
  `Kapazität = DESK_CAPACITY.normal × bediente Schalter + DESK_CAPACITY.self × Selbstbedienungs-Schalter`.
  Gezählt werden **Sitze**, nicht Fluggäste: so hängt die Satisfaction nicht von der Nachfrage ab, die
  sie selbst beeinflusst (kein Kreis). Die geplante Strecke zählt im Planer mit.
- **Überlast-Kurve** `deskOverloadPoints(deskLoad)` (heute `getDeskOverloadSat`, `:547-551`):
  bis 80 % → 0; 80 … 100 % → −0,2 je Prozentpunkt (−4 bei 100 %); darüber −4 − 1,6 je Prozentpunkt,
  höchstens −20.
- Konstanten: `GROUND_WEIGHT_BASE = 1,2`, `GROUND_WEIGHT_PER_INDEX = 0,1` (1,2 bei 30 min, 0,5 ab 810 min);
  `LOUNGE_POINTS` Economy 0, Premium 2, Business 8, First 8 (Mittel beider Enden: eine Lounge an einem
  Ende = 4 wie heute, an beiden Enden = 8 wie heute); `STAND_POINTS = 2`; `DESK_TYPE_PENALTY = −10`;
  `DESK_CAPACITY` 5 000 / 10 000 Sitze je Woche (heute `:141`); Überlast-Kurve wie oben.
- Neu gegenüber heute: Überlast als Mittel beider Enden und mit Bodengewicht (heute Summe ohne Gewicht,
  bis −40 auch auf 13-h-Flügen, W3).
- Regeln (Tests):
  - Lounge oder Stellplatz hinzufügen senkt `groundPart` nie; ein weiterer Schalter senkt ihn nie.
  - Gleiche Ausstattung an beiden Enden: Teil = Teil eines Endes × `groundWeight`.
  - `deskOverloadPoints` liegt in −20 … 0; `groundPart` aus Überlast ≥ −20 × `groundWeight`.
  - Economy hängt nicht von der Schalter-Art ab.

#### 2.6.4 Personal-Teil (Code-Name: `staffPart`)
- Formel: `staffPart = (morale − 50) × SAT_PER_MORALE_POINT`, gleich für alle Klassen.
- Konstanten: `SAT_PER_MORALE_POINT = 0,1` (−5 … +5; heute `src/lib/staff.ts:88`).
- KI: hat kein Personal-Modell (E44, Liste in Abschnitt 7), `staffPart = 0`.

#### 2.6.5 Forschungs-Teil (Code-Name: `researchPart`)
- Formel: Summe der Satisfaction-Punkte aller fertigen Forschungen, gleich für alle Klassen.
- Konstanten (E19): „Cabin design studio“ +2 (heute `src/lib/research.ts:142`); die sechs Stufen
  „Plane type satisfaction“ (`sat-1` … `sat-6`, `src/lib/research.ts:100-164`) je **+1 Punkt**
  (heute +1 Type appeal ≈ +0,2 … +0,4 Satisfaction, W12). Höchstens +8. Neue Texte aus den Konstanten
  (4.1), z. B. „Satisfaction +1 in every cabin class“.
- KI: forscht nicht (Abschnitt 7), `researchPart = 0`.

### 2.7 Satisfaction je Klasse (Code-Name: `satisfaction`)
- Bedeutung: Wie gut eine Klasse einer Strecke die Erwartung ihrer Fluggäste erfüllt.
- Einheit und Bereich: Punkte 0 … 160; 100 = wie erwartet, 160 = Spitze (E14).
- Formel:
  `satisfaction(c) = kappen(100 + cabinPart + servicePart + groundPart + staffPart + researchPart, 0, 160)`
  — **einmal gekappt, ungerundet** (R4, W6). Gilt nur für Klassen mit Sitzen.
- Hängt ab von: 2.1–2.6.
- Wirkt auf: `offerSatisfaction` (2.8), `routeSatisfaction`, `airlineSatisfaction` (2.9).
- Nicht enthalten (E33, E4): gestrichene Flüge, Schwierigkeit, Ereignisse.
- Eine Funktion für alle (R2, E44): `satisfactionBreakdown(route, airline, month)` liefert je Klasse alle
  Teile (`cabinPart`, `servicePart`, `groundPart` mit seinen vier Teilen, `staffPart`, `researchPart`),
  die Summe vor dem Kappen und `satisfaction`. Planer, Kabinen-Overlay, Streckenansicht, Bericht und
  Wirtschaft lesen nur diese Funktion (heute zwei Quellen, W5).
- Neutralpunkt (Test): Kabine genau auf Erwartung, Service genau auf Erwartung, keine Lounge, keine
  Stellplätze, Schalter ohne Überlast, Moral 50, keine Forschung → genau 100.
- Regeln (Tests):
  - Wert immer in 0 … 160.
  - Mehr bieten (Kabine, Service, Lounge, Stellplatz, Schalter, Moral, Forschung) senkt sie nie.
  - +0,3 Punkte in einem Teil ändern das Ergebnis (unterhalb der Kappe).
  - Gleiche Eingaben → gleiche Satisfaction für Spieler und KI.
  - Planer-Wert = Wert im Monatsabschluss bei gleichem Stand (W5).
  - Schwierigkeit und gestrichene Flüge ändern sie nicht.
  - Kein Sprung in der Flugzeit: 1 Minute mehr ändert sie um weniger als 0,5 Punkte.
- Anzeige: „Satisfaction“ je Klasse in %, z. B. „112%“ (Punkte = Prozent der Erwartung), mit
  Aufschlüsselung aus dem Modell.

### 2.8 Offer satisfaction (Code-Name: `offerSatisfaction`)
- Bedeutung: Satisfaction einer Klasse im **Angebot** einer Gesellschaft auf einem Städtepaar (R1).
- Formel:
  - Direktangebot: Mittel der `satisfaction(c)` aller Strecken der Gesellschaft auf dem Paar mit Sitzen
    in Klasse `c`, gewichtet nach Sitzen je Woche dieser Klasse. Da sich die Fluggäste eines Angebots
    nach Sitzen auf seine Strecken verteilen (Abschnitt 3 muss das so festlegen), ist das zugleich die
    Gewichtung nach Fluggästen (E10).
  - Umsteige-Verbindung: Mittel der `offerSatisfaction(c)` der Teilstrecken, gewichtet nach `blockMinutes`.
    Welche Klassen eine Verbindung anbietet, regelt Abschnitt 3.
- Wirkt auf: `satisfactionFactor` des Angebots (2.10).
- KI-Angebote haben ihre eigene `offerSatisfaction` (heute immer 100, W10, E44).
- Regeln (Tests): liegt zwischen kleinster und größter Satisfaction der beteiligten Strecken; eine Strecke
  allein → ihre Satisfaction.

### 2.9 Route satisfaction und Airline satisfaction
**Route satisfaction** (Code-Name: `routeSatisfaction`)
- Bedeutung: Eine Zahl für die Zufriedenheit einer Strecke.
- Einheit und Bereich: Punkte 0 … 160.
- Formel: Mittel der `satisfaction(c)` der Klassen, **gewichtet nach Fluggästen je Woche** der Klasse auf
  dieser Strecke (E10). Hat die Strecke (noch) keine Fluggäste, nach Sitzen gewichtet.
- Wirkt auf: nichts im Modell (nur Anzeige). Der Markt nutzt je Klasse `offerSatisfaction`.
- Kein Kreis: Fluggäste hängen von der Satisfaction je Klasse ab, nicht von `routeSatisfaction`.
- Anzeige: Planer, Streckenliste, Streckendetails, Live-Karte; heute sitzgewichtet (`:965-975`).

**Airline satisfaction** (Code-Name: `airlineSatisfaction`)
- Bedeutung: Wie zufrieden die Fluggäste einer Gesellschaft im Monat insgesamt waren.
- Einheit und Bereich: Punkte 0 … 160.
- Formel: Mittel der `satisfaction(c)` über alle Strecken und Klassen, gewichtet nach den **beförderten
  Fluggästen des Monats** (E10, E39). Ohne Fluggäste: 100.
- Wirkt auf: Ruf-Ziel (Abschnitt 6), über die ganze Skala 0 … 160 (E14; heute nur bis 130,
  `src/lib/monthClose.ts:153`). Gestrichene Flüge senken sie nicht (sie wirken im Ruf getrennt, E33).
- Gilt für Spieler und KI (E44).
- Anzeige: Ruf-Aufschlüsselung (Abschnitt 6), Monatsbericht.

### 2.10 Satisfaction factor (Code-Name: `satisfactionFactor`)
- Bedeutung: Wie viel mehr (oder weniger) Fluggäste für ein Angebot zu zahlen bereit sind als für ein
  Angebot mit Satisfaction 100. Das ist die einzige Wirkung der Satisfaction im Markt (E13).
- Einheit und Bereich: Faktor; 1 bei Satisfaction 100, Startwerte 0,5 bei 0, 0,75 bei 50, ≈ 1,35 bei 160.
- Formel (Startwerte; endgültige Kurve aus dem Balance-Skript 3.9, E15):
  - `s ≤ 100`: `satisfactionFactor = 1 − SAT_FACTOR_LOW_SLOPE × (100 − s)` (gerade, flacher als heute s/100);
  - `s > 100`: `satisfactionFactor = 1 + SAT_FACTOR_HIGH_A × (s − 100) − SAT_FACTOR_HIGH_B × (s − 100)²`
    (wie heute, `:740-747`).
- Hängt ab von: `offerSatisfaction(c)`.
- Wirkt auf: die **Anziehung** des Angebots in Klasse `c` (Abschnitt 3), genau einmal, und zwar als
  Zahlungsbereitschaft: Ein Angebot mit Satisfaction `s` und Preis `p` ist so anziehend wie ein sonst
  gleiches Angebot mit Satisfaction 100 und Preis `p / satisfactionFactor(s)`. Abschnitt 3 baut die
  Anziehung so; Abschnitt 4 leitet daraus ab: ohne Rivalen liegt der erlösbeste Preis bei etwa
  `marketFare × satisfactionFactor` (bei 100 also beim Marktpreis, E24).
- Wirkt nicht auf: Marktgröße, Marktpreis, Kosten.
- Ersetzt: `getSatMultiplier` mit fairem Preis `satBase` (`:740-750`, `:1410-1414`) und die
  Qualitäts-Anziehung (`:1122-1137`, `:1425-1429`), die heute beide wirken (W8).
- Konstanten: `SAT_FACTOR_LOW_SLOPE = 0,005`; `SAT_FACTOR_HIGH_A = 0,008`, `SAT_FACTOR_HIGH_B = 0,000035`.
- Regeln (Tests):
  - `satisfactionFactor(100) = 1`; steigt mit `s` auf 0 … 160 (nie fallend); stetig bei 100.
  - `satisfactionFactor(50)` liegt bei 0,75 (± Balance-Spielraum, E15).
  - Ein Angebot mit höherer Satisfaction ist bei gleichem Preis nie weniger anziehend.
- Anzeige: Planer-Preisschritt erklärt „Passengers pay up to x% more/less for this satisfaction“; Wert aus
  dem Modell, Text aus den Konstanten (E52).

### 2.11 Zuordnung der Bestandsfunde

| Fund (1.1) | Lösung in diesem Abschnitt |
|---|---|
| W1 Weiteres Gericht senkt SAT | 2.5 Menü-Wert mit abnehmendem Nutzen (E16) |
| W2 Sprung bei 6 h | 2.5 stufenlose Mahlzeiten-Gewichte (R5) |
| W3 Zwei Flughäfen verschieden | 2.6.3 Mittel beider Enden, ein Bodengewicht für alle Teile (E17) |
| W4 Selbstbedienung kostet Economy | entfällt (R16); Schalter-Art nur für Premium-Klassen (2.6.3) |
| W5 Planer ≠ Wirtschaft | 2.7 eine Funktion `satisfactionBreakdown` (R2) |
| W6 Mehrfach kappen und runden | 2.4, 2.7 einmal kappen, ungerundet (R4) |
| W7 Drei Obergrenzen | 2.7 Skala 0 … 160; 2.9 Ruf über die ganze Skala; Zweig über 200 entfällt (E14, R16) |
| W8 SAT wirkt dreifach | 2.0, 2.10 zwei Wege: Anziehung (einmal) und Ruf (E13, E39) |
| W9 Harter Preis-Hebel unter 100 | 2.10 flachere Kurve, 50 → 0,75 (E15) |
| W10 Rivalen immer SAT 100 | 2.8 eigene `offerSatisfaction` je Angebot (E44, R1) |
| W11 KI-Langstrecke eine Mahlzeit | 2.5 gilt für alle; KI füllt jede Mahlzeit (R14, Abschnitt 7) |
| W12 Forschung kaum spürbar | 2.6.5 +1 Punkt je Stufe (E19) |
| W13 Fünf Dinge heißen SAT | Namen 2.2–2.9 (E9) |
| W14 Kein Schalter = harter Abzug | 2.6.3 Schalter-Pflicht, kein Abzug (E18) |
| W15 Altes Mahlzeiten-Format | 2.5 keine Kopie; Umwandlung in 5.1 (R16) |

## 3. Nachfrage und Marktanteil

_(offen)_

## 4. Preis und Erlös

_(offen)_

## 5. Kosten

_(offen)_

## 6. Ruf, Rang, Fortschritt

_(offen)_

## 7. Konkurrenz

_(offen)_

## 8. Monatsabschluss und Ereignisse

_(offen)_
