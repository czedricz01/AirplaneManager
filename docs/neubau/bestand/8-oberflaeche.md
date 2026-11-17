# Bestand: Doppelrechnungen in der Oberfläche

Paket 1.8 · Stand 17.11.2026 · Commit cbdc2e0

App = `src/App.tsx`. Planer = `src/components/RoutePlannerView.tsx`. Andere Dateien mit Pfad
unter `src/components/`.
Gesucht wurde in `src/App.tsx` und `src/components/` nach Rechnungen, die die Ansicht selbst
macht, statt `src/lib/` aufzurufen (Suche nach `Math.*`, Faktoren, festen Beträgen, Klick-Handlern
mit `spend`/`setReputation`). Reine Darstellung (Pixel, Uhrzeiten, Rundung zum Anzeigen,
Durchschnitte über die Flotte) ist nicht aufgeführt.
Beispielzahlen sind mit dem echten Code nachgerechnet (Hilfsskript, nicht im Projekt).
Funde, die frühere Pakete schon nennen, stehen hier nur kurz mit Verweis, damit die Liste für
Phase 4 vollständig ist.

## Überblick

Die meisten Ansichten rufen heute das Modell auf (`calculateRouteFinancials`,
`getRouteClassSatisfaction`, `getAirportUpkeep`, `getAircraftResaleValue`, Konstanten aus
`staff.ts`, `marketing.ts`, `research.ts`). Viele frühere Kopien wurden schon entfernt (laut
Code-Kommentaren, z. B. Planer:938-941, Planer:1016-1019, `AirportDetailView.tsx:113-115`).

Es bleiben vier Arten von Rechnungen in der Oberfläche:

```
A  Spielregel nur in der Oberfläche   gibt es in src/lib/ gar nicht (Preis, Wirkung, Grenze)
B  Kopie einer Modell-Formel          gibt es in src/lib/, die Ansicht rechnet sie nach
C  Feste Zahl im Text                 Erklärtext nennt einen Wert, statt die Konstante zu lesen
D  Zweite Quelle für denselben Wert   gleiche Größe, zwei Wege (meist gleiches Ergebnis)
```

Ergebnis: 13 Regeln der Art A, 12 Kopien der Art B, 9 Text-Stellen der Art C, 5 Fälle der Art D.
Die schwersten Folgen: Planer zeigt Schalter- und Standmieten in Preisen von 1960 (W1),
Slot-Grenze „300 je Stufe“ und KI-Slot-Zählung stehen sechsmal in Ansichten und nie im Modell
(W2), Hub-Einrichtungen und Generalüberholung haben ihren Preis nur im Klick-Handler (W3).

## Größen

### Art A · Spielregel nur in der Oberfläche

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Slot-Grenze eines Flughafens | Stufe × 300 | `AirportDetailView.tsx:128`, `AirportsView.tsx:220`, Planer:1346, :1711, :1750, :2074, :2143 | Flughafen-Stufe | Slot-Kauf (über `availableSlots`), Anzeige |
| Freie Slots | max(0, Grenze − gemietete Slots − KI-Abflüge je Woche) | `AirportDetailView.tsx:149`, `AirportsView.tsx:226`, Planer:1349, :1715, :2078 | Grenze, KI-Strecken | Slot-Kauf |
| Hub-Einrichtungen Kaufpreis | Hangar 250 000 $, VIP-Lounge 1 000 000 $, Catering 250 000 $; nominal | `AirportDetailView.tsx:443-454`, `:513-524`, `:542-553` | – | Kasse |
| Generalüberholung | 200 000 $; Zustand + 50/50/40/30, ab der 5. nichts | App:218-231, App:2787-2810 | Zahl der Überholungen | Kasse, Zustand (Paket 1.7 W3) |
| Treibstoff-Absicherung | Preis = Marktpreis des Monats vor Ereignis-Beginn | App:639-650 | Ereignis-Wahl | Treibstoffpreis Spieler (Paket 1.7) |
| Treibstoff-Trend | (Preis − Vormonat) / Vormonat | App:655-664 | Preis | Anzeige oben |
| Kabinenwert | Grundwert + Sitztyp + Sitzabstand + Ausstattung | `ConfigurePurchaseView.tsx:401-484` | Kabine, Datum | SAT (Paket 1.1) |
| Ausstattung verfügbar ab | Monat 120/180/240/…/720; Bar ab 200 Sitzen, Dusche ab 300 | `ConfigurePurchaseView.tsx:385-388`, je Ausstattung in `:403-452` und nochmals in `:494-535` | Datum, Größe | Kabinenwert, Preis |
| Kabinen-Extras und Ausstattung Preis | WLAN 150 000 $, Licht 100 000 $, Catering 300 000 $, Bar 500 000 $, Dusche 1 000 000 $, −25 000 $/−50 000 $; je Sitz 20–4 000 $; nominal | `ConfigurePurchaseView.tsx:390-396`, `:494-535` | Auswahl | Kaufpreis |
| Umrüstung | Sitze × 1 000 $ + Extras; Innenzustand auf max(jetzt, 90 − 10 × Umrüstungen, mind. 30) | `ConfigurePurchaseView.tsx:539`, App:1957-1968 | Sitze, Umrüstungen | Kasse, Zustand (Paket 1.7) |
| Ruf nach Übernahme | Ruf + 2 | App:1867 | – | Ruf (fehlt in Paket 1.5) |
| Startwerte neues Spiel | Kasse 25/50/100/200 Mio. $, Ruf 50, Heimat Stufe 2 mit 1 Schalter | App:1595-1598, App:1645-1662 | Auswahl | Spielbeginn |
| Saison- und Ereignis-Anzeige „Demand“ | eigene Saisontabelle × Ereignis-Faktor | App:877-900 | Monat, Ereignisse | Anzeige oben (Paket 1.7) |

### Art B · Kopie einer Modell-Formel

| Größe | Kopie | Fundstelle Kopie | Original | Unterschied |
|---|---|---|---|---|
| Schalter-Miete im Planer | 2 500 / 1 500 $ × 0,95 am Hub | Planer:1311-1316 | `src/lib/financeUtils.ts:38-41` | ohne Kostenindex, ohne Stufe-3-Nachlass 0,85, ohne Auslastungs-Anteil, ohne Forschung (W1) |
| Stand-Miete im Planer | 150 / 300 / 600 $ | Planer:1319-1326 | `src/lib/financeUtils.ts:31-35` | ohne Kostenindex (W1) |
| KI-Abflüge je Flughafen | Summe `departures` der KI-Strecken | Planer:257-268, `AirportDetailView.tsx:130-140`, `AirportsView.tsx:83-96` | `rivalLandingsPerWeek` (`src/lib/hubOwnership.ts:45-53`) | drei Kopien in Ansichten (Paket 1.6) |
| Fluggast- und Landegebühr | eigene Formel | `AirportDetailView.tsx:283-287` | `src/lib/financeUtils.ts` (Paket 1.4) | 0,95 auch auf Stufe 3, ohne Forschung (Paket 1.4) |
| Umlaufzeit (Block) | 30 + Flug + Wende + Flug + 30, auf 5 aufrunden | Planer:568, :1531-1533, :2661 | `blockMinutes` (`src/lib/scheduleUtils.ts:47-58`) | gleiches Ergebnis; Einweg-Flüge fehlen in der Kopie |
| Aufrunden auf 5 Minuten | `ceil(x / 5) × 5` nach `rawBlockMinutes` | Planer:1416, :1422, :2435, :2883 | `blockMinutes` | gleiches Ergebnis |
| Flüge je Tag (Mehrfach-Umläufe) | Planer: freie Tageszeit / Umlauf, 1 ab 720 min | Planer:1527-1537 | Editor: 1 440 / Umlauf, 1 ab 720 min (`RouteScheduleEditView.tsx:214`) | zwei Regeln (W6) |
| Startpreise und Klassen-Faktoren | 1 / 1,6 / 3 / 5 × Wert der Economy | Planer:1039-1042, :3662, :3710 | Marktpreisleiter im Modell (Paket 1.3) | drei Stellen in einer Datei (Paket 1.3, O2) |
| Klassen-Gewinnschwelle | BE75 × Klassen-Faktor | Planer:3711-3713 | `basePriceBE75` im Modell | Schwelle je Klasse nur geschätzt (W5) |
| Ereignis-Abschwächung | Faktor + (1 − Faktor) × Anteil | `app/GameTopBar.tsx:220-223` | `eventReliefFactor` (`src/lib/gameState.ts:440`) | je Ereignis statt gesamt; heute gleich |
| Monatswert = Woche × 4 | Gewinn, Fluggäste, Crew-Kosten × 4 | App:724, :734, :741 | Monatsabschluss (Paket 1.7) | eigene Stellen statt einer Funktion |
| Auslastung | Fluggäste / Sitze | `LiveTraffic.tsx:231-238` (Kabine × Flüge) | `paxByClass.max` (`src/lib/financeUtils.ts:1473`) | eigener Nenner ohne Streichungen (W7) |

Weitere Auslastungs-Stellen mit dem Modell-Nenner (keine Kopie, nur dieselbe Division an
mehreren Orten): `RoutesView.tsx:145`, `RouteDetailView.tsx:491`, `:524`, Planer:3726,
`MyCompanyView.tsx:412`, `app/MonthlyReportScreen.tsx:60`.

### Art C · Feste Zahl im Text

| Text | Wert im Text | Fundstelle | Quelle des Werts |
|---|---|---|---|
| SAT-Faktor-Formel (Debug) | 0,008 / 0,000035 / 1,45 / 0,001, Grenze 200 | Planer:3615 | `getSatMultiplier` (Paket 1.1) |
| Nachfrage-Formel (Debug) | „min(1.5, …)“, Elastizität × 3 | Planer:3625 | `getPriceDemandMultiplier` |
| Generalüberholung | „(200k)“, „Checks x/4“ | `AirportDetailView.tsx:461`, `:474`, `:480` | `GENERAL_CHECK_COST`, App:218 |
| VIP-Lounge | „+4 SAT pts (Bus/First), +1 (PE)“ | `AirportDetailView.tsx:499` | `src/lib/financeUtils.ts:489-491` |
| Schalter | „about -15 SAT“, „-10 quality pts“, „-1 SAT“ | `AirportDetailView.tsx:378`, `:383` | Schalter-Simulation (Paket 1.1) |
| Dusche | „+$1,000,000“, „300+ Cap“, „2008+“ | `ConfigurePurchaseView.tsx:1315` | `:388`, `:394` |
| Glossar Flughafen | „300 per level“ | `InfoTooltip.tsx:131`, `:145` | W2 |
| Glossar Stände, Schalter, Warteschlange | „2 points“, „15“, „10“, „80 %“, „2 / 4 / 20 points“ | `InfoTooltip.tsx:151`, `:157`, `:163` | SAT-Modell (Paket 1.1) |
| Glossar Kabine, Auslastung | „keeps 40 %“, „30 minutes“ | `InfoTooltip.tsx:175`, `:199` | `getPlaneSat`, `BOARDING_MIN` |

Gut gelöst (Text aus Konstanten): `StaffPanel.tsx:240-245`, `MarketingPanel.tsx:150-179`,
`:251-252`, `CareerPanel.tsx:91`, `:241-252`, Planer:3619 (`MAX_SCARCITY_PREMIUM`).

### Art D · Zweite Quelle für denselben Wert

| Wert | Quelle 1 | Quelle 2 |
|---|---|---|
| Treibstoffpreis im Planer | Preis aus App (mit Absicherung) | eigener Aufruf `getJetFuelPrice`, falls keiner übergeben (Planer:873-877; Paket 1.4) |
| Forschungs-Bonus Wiederverkauf | `researchFx.resaleBonus` (App:509, App:1701) | globaler Wert `getResaleBonus()` (`AircraftDetailsModal.tsx:253`) |
| Flugzeug-Alter | `ageYears` (`src/lib/fleetCosts.ts:31`) | eigene Rechnung (`AircraftDetailsModal.tsx:51-54`) |
| Jahre im Geschäft | App:794 | App:848, App:859 (gleiche Formel dreimal) |
| Monat aus Jahr | `CALENDAR_START_YEAR` (`MyCompanyView.tsx:147`, `ChronicleView.tsx:185`) | feste Zahl 1960 (`RouteDetailView.tsx:550`) |

## Konstanten

Nur Werte, die ausschließlich in der Oberfläche stehen.

| Wert | Bedeutung | Fundstelle |
|---|---|---|
| 300 | Slots je Flughafen-Stufe | `AirportDetailView.tsx:128` u. a. (W2) |
| 250 000 $ / 1 000 000 $ / 250 000 $ | Hangar / VIP-Lounge / Catering | `AirportDetailView.tsx:443`, `:513`, `:542` |
| 200 000 $ | Generalüberholung (in App, aber außerhalb `src/lib/`) | App:218 |
| 50 / 50 / 40 / 30 | Zustand je Generalüberholung | App:226-230 |
| 2 | Ruf-Plus bei Übernahme | App:1867 |
| 90 / 10 / 30 | Innenzustand nach Umrüstung | App:1960-1961 |
| 1 000 $ | Umrüstung je Sitz | `ConfigurePurchaseView.tsx:539` |
| 150 000 … 1 000 000 $ | Kabinen-Extras | `ConfigurePurchaseView.tsx:390-396` |
| 20 … 4 000 $ | Ausstattung je Sitz | `ConfigurePurchaseView.tsx:494-531` |
| 120 … 720 | Monat, ab dem eine Ausstattung verfügbar ist | `ConfigurePurchaseView.tsx:385-388`, `:403-452`, `:497-532` |
| 200 / 300 Sitze | Mindestgröße Bar / Dusche | `ConfigurePurchaseView.tsx:387-388` |
| 25 / 50 / 100 / 200 Mio. $ | Startkapital | App:1595-1598 |
| 50 | Start-Ruf | App:1662 |
| 2, 1 | Stufe der Heimat und Schalter zu Beginn | App:1647-1652 |
| 2 500 / 1 500 / 0,95 | Schalter im Planer (Kopie) | Planer:1313-1314 |
| 150 / 300 / 600 | Stände im Planer (Kopie) | Planer:1321-1323 |
| 0,5 / 1,5 | Preisregler reicht bis halber / anderthalbfacher Marktpreis | Planer:3388 |
| 7 | Höchstens 7 Flüge bei der automatischen Planung | Planer:1434 |
| 800 km/h | Geschwindigkeit, wenn kein Flugzeug gewählt ist | Planer:945 (Paket 1.2) |
| 0,89 … 1,15 | Saisontabelle (Kopie) | App:878 (Paket 1.7) |

## Widersprüche und Auffälligkeiten

### W1 · Planer zeigt Schalter- und Standmieten in Preisen von 1960
- Befund: Der Planer rechnet die Miete für Schalter und Stände selbst, ohne Kostenindex, ohne
  Nachlass der Stufe 3 (0,85), ohne Auslastungs-Anteil und ohne Forschung. Die Flughafen-Ansicht
  und die Abrechnung nutzen `getAirportUpkeep`.
- Fundstelle: Planer:1311-1326, angezeigt in Planer:1787-1798 und :2259-2270; Original
  `src/lib/financeUtils.ts:31-42`.
- Folge im Spiel: Im Jahr 2022 zeigt der Planer einen Schalter auf Stufe 2 mit 2 375 $/Woche;
  die Abrechnung bucht bei voller Nutzung 4 975 $ (Index 2,10). Ein Stand für Schmalrumpf: Planer
  300 $, Abrechnung 629 $. Auf Stufe 3: Planer 2 375 $, Abrechnung 4 451 $.
- Vorschlag: Planer liest `getAirportUpkeep(...).deskCostsNow` und `standUpgradeCosts`, wie die
  Flughafen-Ansicht. Im Neubau: eine Funktion „Mietpreis je Einheit“.
- Braucht Entscheidung: nein

### W2 · Slot-Grenze und KI-Slots nur in Ansichten
- Befund: Die Zahl der Slots eines Flughafens (Stufe × 300) und die von der KI belegten Slots
  stehen sieben- bzw. dreimal in Ansichten, aber nirgends in `src/lib/`. Die Grenze wirkt aber
  auf das Spiel: Sie geht als `availableSlots` in `applyInfrastructureChange` ein.
  Gemietete Slots (Anzahl Rechte) und KI-Abflüge je Woche werden dabei voneinander abgezogen,
  als wären sie dieselbe Einheit.
- Fundstelle: `AirportDetailView.tsx:128-149`, `AirportsView.tsx:83-96`, `:220-226`,
  Planer:257-268, :1346-1349, :1711-1715, :1750, :2074-2078, :2143; Glossar
  `InfoTooltip.tsx:131`, `:145`.
- Folge im Spiel: Die KI prüft die Grenze nicht (KI hat keine Slots, Paket 1.6). Eine Änderung
  der Grenze muss an neun Stellen nachgezogen werden.
- Vorschlag: Funktion `freeSlots(airport, infra, aiAirlines)` im Modell; Einheit festlegen
  (Slot = ein Abflug je Woche?).
- Braucht Entscheidung: ja (Einheit eines Slots; soll die KI Slots belegen?)

### W3 · Preise im Klick-Handler
- Befund: Hub-Einrichtungen (Hangar, VIP-Lounge, Catering) und die Generalüberholung haben ihren
  Kaufpreis nur im Klick-Handler der Oberfläche. Die Preise sind nominal (1960 = 2020), die
  laufende Miete der Einrichtungen dagegen wächst mit dem Kostenindex
  (`src/lib/financeUtils.ts:112`). Gebucht werden die Einrichtungen unter „Airport
  Infrastructure“, ohne eigene Zeile.
- Fundstelle: `AirportDetailView.tsx:443-553`; App:218-231, App:2787-2810.
- Folge im Spiel: Eine VIP-Lounge kostet 1960 wie 2020 einmalig 1 Mio. $; 1960 ist das viel, 2020
  wenig. Die Kasse-Prüfung steht doppelt (Knopf gesperrt und Handler).
- Vorschlag: Preise als Konstanten im Modell, mit Kostenindex (Paket 1.4, Frage „Kostenindex
  für Einmalpreise“).
- Braucht Entscheidung: ja (gehört zur offenen Frage aus 1.4)

### W4 · Kauf- und Kabinenmodell in der Kauf-Ansicht
- Befund: Die ganze Kabine wird in `ConfigurePurchaseView.tsx` bewertet und bepreist:
  Kabinenwert, Verfügbarkeit nach Datum, Preise je Ausstattung, Umrüstungspreis. Jede Ausstattung
  hat ihr Datum zweimal (für den Kabinenwert und für den Preis).
- Fundstelle: `ConfigurePurchaseView.tsx:385-541`, Text `:1315`.
- Folge im Spiel: Die KI und der Gebrauchtmarkt können diese Regeln nicht nutzen; ein Datum kann
  beim Ändern an einer der zwei Stellen auseinanderlaufen. Preise nominal (Paket 1.7 W10).
- Vorschlag: Datei `src/model/kabine.ts` mit einer Tabelle je Ausstattung (Datum, Wert, Preis).
- Braucht Entscheidung: nein (Preisfrage wie W3)

### W5 · Gewinnschwelle je Klasse geschätzt
- Befund: Der Planer zeigt für jede Klasse eine Gewinnschwelle = Economy-Schwelle × 1,6 / 3 / 5.
  Das Modell rechnet die Schwelle nur für die ganze Kabine.
- Fundstelle: Planer:3707-3713, :3760-3772.
- Folge im Spiel: Die Marken „Break-Even“ einer Klasse stimmen nur, wenn die Preise genau im
  Verhältnis 1 : 1,6 : 3 : 5 stehen. Hängt an der offenen Frage O2.
- Vorschlag: Schwelle je Klasse vom Modell liefern oder nur eine Schwelle für die Strecke zeigen.
- Braucht Entscheidung: ja (mit O2)

### W6 · Zwei Regeln für Flüge je Tag
- Befund: Der Planer erlaubt so viele Umläufe am Tag, wie in die freie Tageszeit des Flugzeugs
  passen; der Zeitplan-Editor teilt den ganzen Tag (1 440 min) durch den Umlauf.
- Fundstelle: Planer:1527-1537; `RouteScheduleEditView.tsx:213-220`.
- Folge im Spiel: Dieselbe Strecke kann im Editor mehr Umläufe je Tag anbieten als im Planer.
  Die Kollisionsprüfung fängt das später ab, der Regler zeigt aber eine falsche Höchstzahl.
- Vorschlag: eine Funktion im Modell (`scheduleUtils`).
- Braucht Entscheidung: nein

### W7 · Auslastung in der Live-Karte mit eigenem Nenner
- Befund: Die Live-Karte rechnet Sitze × Flüge selbst. Das Modell nutzt `paxByClass.max`, das
  Streichungen (Streik, Störung) schon abzieht.
- Fundstelle: `LiveTraffic.tsx:231-238`; `src/lib/financeUtils.ts:1473`.
- Folge im Spiel: In einem Streik-Monat zeigt die Karte eine niedrigere Auslastung als die
  Streckenliste.
- Vorschlag: `loadFactor` einmal im Modell je Strecke liefern; alle Ansichten lesen ihn.
- Braucht Entscheidung: nein

### W8 · Spielregeln in `App.tsx`
- Befund: `App.tsx` enthält Regeln, die in `src/lib/` gehören: Treibstoff-Absicherung,
  Generalüberholung, Umrüstung, Ruf + 2 bei Übernahme, Startwerte, eigene Saisontabelle,
  Monatswerte × 4. Paket 1.5 kennt den Ruf-Bonus bei Übernahme nicht.
- Fundstelle: App:218-231, :639-664, :724-741, :877-900, :1595-1662, :1867, :1957-1968,
  :2787-2810.
- Folge im Spiel: Regeltests für `src/lib/` erfassen diese Regeln nicht.
- Vorschlag: Im Neubau je Regel eine Funktion im Modell; App ruft nur auf.
- Braucht Entscheidung: nein

### W9 · Erklärtexte mit festen Zahlen
- Befund: Neun Text-Stellen nennen Werte, die im Modell als Konstante stehen (Tabelle Art C).
  Die Debug-Anzeige im Planer schreibt die SAT-Formel als Text ab.
- Fundstelle: siehe Tabelle Art C.
- Folge im Spiel: Ändert die Spezifikation einen Wert, bleiben die Texte falsch (wie schon bei
  „0-0.2“ in der Konkurrenz-Ansicht, Paket 1.6).
- Vorschlag: Paket 4.1 erzeugt die Texte aus den Konstanten.
- Braucht Entscheidung: nein

## Doppelte Rechnungen

Diese ganze Datei ist die Liste. Zusammengefasst nach Größe:

- Slot-Grenze: 7 Stellen (W2). KI-Slots: 3 Ansichten + `src/lib/hubOwnership.ts:45`.
- Klassen-Faktoren 1 / 1,6 / 3 / 5: 3 Stellen im Planer.
- Umlaufzeit: Modell + 3 Kopien im Planer + 4 Rundungen.
- Schalter- und Standmiete: Modell + Planer-Kopie (W1).
- Gebühren je Fluggast und Landung: Modell + Flughafen-Ansicht.
- Woche × 4: App (3) + Monatsabschluss (Paket 1.7).
- Auslastung: Modell-Nenner an 6 Stellen geteilt, eigener Nenner in der Live-Karte (W7).
- Jahre im Geschäft: 3 Stellen in App.
- Ereignis-Abschwächung: Modell + Kopie in der oberen Leiste.

## Vorschlag: Aufteilung für Phase 4

Phase 4.2+ stellt die Ansichten auf `src/model/` um. Vorschlag für die Pakete, nach Bereich
geordnet, damit jedes Paket wenige Dateien liest:

| Paket | Inhalt | Dateien | Funde |
|---|---|---|---|
| 4.2 | Regeln aus `App.tsx` ins Modell | `src/App.tsx` | W8, Art D (Jahre) |
| 4.3 | Flughafen und Infrastruktur | `AirportDetailView.tsx`, `AirportsView.tsx`, Infrastruktur-Teil im Planer | W1, W2, W3, Gebühren |
| 4.4 | Zeitplan | Planer Schritt 2, `RouteScheduleEditView.tsx` | W6, Umlaufzeit |
| 4.5 | Preis und SAT der Strecke | Planer Schritt 3/4, `RouteConfigOverlay.tsx`, `RouteDetailView.tsx`, `RoutesView.tsx` | W5, Klassen-Faktoren, Debug |
| 4.6 | Kauf, Kabine, Flotte | `ConfigurePurchaseView.tsx`, `AircraftDetailsModal.tsx`, `MyFleetView.tsx`, `AircraftMarketPanel.tsx` | W4, Art D (Alter, Wiederverkauf) |
| 4.7 | Kennzahlen und Anzeigen | `app/GameTopBar.tsx`, `MyCompanyView.tsx`, `app/MonthlyReportScreen.tsx`, `LiveTraffic.tsx`, `CompetitorsView.tsx` | W7, Ereignis-Abschwächung |

Die Erklärtexte (W9) gehören zu 4.1. Der Planer ist mit 3 899 Zeilen zu groß für ein Paket; er
ist deshalb auf 4.3–4.5 verteilt.

## Bezug zu bisherigen offenen Fragen

- 1.3 „Klassen-Faktoren im Planer“ und O2: W5, drei Stellen.
- 1.4 „Kostenindex für Einmalpreise“: W3, W4 (Einrichtungen, Kabine, Überholung).
- 1.5 Ruf: Ruf + 2 bei Übernahme (App:1867) fehlte in der Liste.
- 1.6 „KI-Abflüge an mehreren Stellen“: W2.
- 1.7 „Grundüberholung“, „Treibstoff-Absicherung“, „Saisontabelle“: W8.

## Offene Fragen an den Menschen

1. Slots: Was ist ein Slot? Ein Abflug je Woche (wie heute bei der Nutzung) oder ein Recht, das
   man zählt? Soll die KI Slots belegen und die Grenze einhalten? (W2)
2. Einmalpreise der Hub-Einrichtungen, Generalüberholung und Kabinen-Ausstattung: mit dem
   Kostenindex wachsen wie die Mieten? (W3, W4; gleiche Frage wie 1.4)
3. Gewinnschwelle im Planer: je Klasse (dann muss das Modell sie liefern) oder nur eine für die
   ganze Strecke? (W5, hängt an O2)
4. Ruf + 2 bei Übernahme: behalten, und wenn ja, als Konstante beim Ruf-Modell? (W8)
5. Startwerte (Startkapital-Stufen, Ruf 50, Heimat mit Stufe 2): Teil der Spezifikation oder
   Einstellungen? (W8)
6. Erklärtexte: Sollen alle Zahlen in Texten aus Konstanten kommen, auch in der Debug-Anzeige,
   oder darf die Debug-Anzeige wegfallen? (W9)
7. Flüge je Tag: Soll die Höchstzahl die übrigen Strecken desselben Flugzeugs berücksichtigen
   (Planer) oder den ganzen Tag (Editor)? (W6)
