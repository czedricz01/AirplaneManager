# SAT-System: Analyse, Logikfehler, Vorschläge

Stand 2026-09-29 · Branch `claude/kind-lovelace-e2eml3`

> **Lesehinweis.** Datei:Zeile-Angaben und Beispielzahlen beschreiben den Stand **vor** den Korrekturen (Commit `309c1ba`). Was in diesem Branch behoben wurde, ist mit „behoben“ markiert und in Abschnitt 8 aufgelistet.

## Ziel

„SAT“ (Satisfaction) ist die Zufriedenheit der Passagiere pro Kabinenklasse. Sie bestimmt, welchen Preis Passagiere akzeptieren, wie viele buchen und wie der Marktanteil gegen Rivalen ausfällt (`src/lib/financeUtils.ts:1005-1043`). Sie speist außerdem den Ruf (`src/App.tsx:163-174`).

Das Ziel dieser Analyse: die Berechnung beim Flugzeugkauf und bei der Routenerstellung verständlich darstellen, Logikfehler finden, Korrekturen und allgemeine Verbesserungen vorschlagen.

Vorgehen: Alle Angaben stammen aus dem Code (Datei:Zeile). Die Rechenbeispiele wurden mit den 1:1 kopierten Formeln aus `financeUtils.ts` in Node nachgerechnet.

---

## 1. Der Weg von SAT in einem Bild

```
FLUGZEUGKAUF (einmalig)                     ROUTENERSTELLUNG, Schritt 3 (pro Route und Klasse)
──────────────────────                      ──────────────────────────────────────────────
Sitztyp, Pitch, Features je Klasse ─┐
        gewichtet nach Sitzzahl     ├─► Interior-SAT ─┐
Kabinen-Extras (WLAN, Bar …) ───────┘                 │   Typ-Beliebtheit (Datensatz)
                                                      ▼            │
Verschleiß (Zustand 0–100) ──────────► PLANE SAT = (Typ·0,33 + Interior·0,67) · (0,4 + 0,6·Zustand)
                                                      │
   Extras (WLAN, Kits …) · m(Zeitklasse) ─┐           ▼
   Stand-Bonus (+2) ──────────────────────┴─► HARDWARE = 20 + PlaneSat + Extras′·m + Stand
   Catering + Service · m(Zeitklasse) ────┐
   Lounge, Check-in-Strafe ───────────────┴─► SOFTWARE = 20 + (Catering+Service)′·m + Lounge + Check-in
                                                      │
                     QUALITÄT = √(HARDWARE · SOFTWARE)│
                     ERWARTUNG = Basis(Klasse) · (1 + 0,15·(Zeitklasse−1))
                     SAT % = Qualität / Erwartung · 100 · Schwierigkeit
                     Route-SAT = SAT % + Check-in-Überlast (beide Flughäfen) ± Personal-Moral
                                                      │
        ┌─────────────────────────────────────────────┼─────────────────────────────┐
        ▼                                             ▼                             ▼
 fairer Preis = Basispreis · satMult(SAT)   Preis-Elastizität (hohe SAT = träger)   Marktanteil vs. Rivalen
```
′ = „abnehmender Ertrag“ (`applyDiminishingReturns`). m = Zeitklassen-Faktor.

Quellen: `financeUtils.ts:371-381` (PlaneSat), `:567-643` (Klassen-SAT), `:667-719` (Route-SAT), `:538-548` und `:737-744` (Preiswirkung), `:810-838` (Marktanteil).

---

## 2. Flugzeugkauf: die Berechnung einfach erklärt

Die Konfiguration steht in `src/components/ConfigurePurchaseView.tsx`. Jede Kabinenklasse bekommt einen eigenen Komfort-Score (Zeilen 397-447):

| Klasse | Startwert | + Sitztyp (×2) | + Sitzabstand | + Features (nur wenn im Spieljahr verfügbar) |
|---|---|---|---|---|
| Economy | 50 | 0…25 | (Pitch−74)·4 | IFE 5, Strom 5, Haken 1, Armlehnen 2,5, Kopfstützen 2,5, Schale 5, Tablet 4 |
| Premium | 55 | 0…35 | (Pitch−85)·3 | IFE 5, Strom 5, Tisch 2,5, Wade 5, Fuß 4, Licht 2,5, USB-C 4 |
| Business | 60 | 0…50 | (Pitch−100)·2,4 | IFE 7,5, Strom 5, Lordose 4, Steuerung 7,5, Massage 10, Trennwand 12,5, Laden 5 |
| First | 70 | 0…80 | (Pitch−150)·1,6 | IFE 10, Strom 7,5, Schrank 7,5, Holz 12,5, Spiegel 5, Minibar 15, Klima 17,5 |

Dann folgt (Zeilen 449-472, Konstanten 96-107):
1. **Mittelwert nach Sitzzahl:** `Σ(Sitze·Score) / Sitze gesamt`.
2. **Kabinen-Extras addieren:** WLAN +5, Ambient +2,5, Cateringküche +2,5, Bar +7,5, Dusche +10, Reduced Galley −2,5, Minimal Services −7,5. Das Ergebnis wird gerundet und heißt `baseInteriorPop` („Interior SAT“).
3. **Plane SAT** = `Typ-Beliebtheit·0,33 + Interior·0,67`, danach `× (0,4 + 0,6·Zustand/100)` (`financeUtils.ts:378-379`). Beim Kauf ist der Zustand 100 %, deshalb fehlt der Faktor in der Vorschau (`ConfigurePurchaseView.tsx:472`).

Verschleiß: `Flugstunden·0,0012 + 0,1` Prozentpunkte pro Monat (`src/App.tsx:2122-2131`). Eine Renovierung stellt nur auf `90 − 10·bisherige Refits` (mindestens 30) wieder her (`App.tsx:2750-2757`).

---

## 3. Routenerstellung: die Berechnung einfach erklärt

Schritt 3 „Cabin Services“ (`RoutePlannerView.tsx:2894-3187`) ruft `getRouteClassSatisfaction` (`financeUtils.ts:667`) auf. Für jede Klasse passiert Folgendes:

| Schritt | Regel | Quelle |
|---|---|---|
| Zeitklasse tc | Flugdauer <60/120/180/240/360/540/720 min → 1…8 | `financeUtils.ts:156-168` |
| Zeitfaktor m | 3,0 / 2,2 / 1,8 / 1,4 / 1,1 / 0,9 / 0,8 / 0,8 | `:170-179` |
| Mahlzeiten | 1 (tc≤5), 2 (tc≤7), sonst 3 | `:570` |
| Abnehmender Ertrag f(x) | x ≤ 60 unverändert, darüber `60 + √((x−60)·20)` | `:559-565` |
| HARDWARE | `max(1, 20 + PlaneSat + f(Extras)·m + Stand)`; Stand = +2, wenn am **Abflughafen** Stands ≥ Slots | `:581-602` |
| SOFTWARE | `max(1, 20 + f(Catering+Service)·m + Lounge + Check-in)` | `:603` |
| Lounge | Business/First +4, Premium +1, je Flughafen mit VIP-Lounge | `:361-369` |
| Check-in | keine Schalter −15; Premium-Klassen ohne normalen Schalter −25; Economy nur mit Self-Service +5 (nur Abflughafen) | `:590-598` |
| Qualität | `√(HARDWARE·SOFTWARE)` | `:605` |
| Erwartung | Basis Economy 42, Premium 48, Business 64, First 70, mal `1+0,15·(tc−1)` | `:623-626` |
| SAT % | `Qualität/Erwartung·100`, Easy ×1,15, Hard ×0,85 | `:628-629`, `:348-359` |
| Route-SAT | `max(0, SAT % + Überlast_Start + Überlast_Ziel)`, dann ± Moral (−5…+5) | `:696-708`, `:929-932`, `staff.ts:117` |
| Überlast | Schalter-Auslastung >80 % −2, >90 % −4, >100 % −20; dazu −(Self-Service-Anteil)·1 | `:412-421` |

**Wirkung auf Geld** (`financeUtils.ts:1009-1043`):
- **Fairer Preis** = `Basispreis · satMult(SAT)`. Unter 100 % ist satMult linear, bei 150 % ×1,31, bei 200 % ×1,45, dann +0,001 pro Punkt (`:538-548`).
- **Nachfrage** = `(fairer Preis / Preis)^Elastizität`, Elastizität = `max(0,5; 1,5 − SAT/200)`, bei zu hohem Preis ×3, gedeckelt bei 1,5 (`:737-744`).
- **Marktanteil** gegen Rivalen: `√Abflüge · Preisreiz^1,2 · SAT-Reiz^0,8` (`:822-824`).
- **Ruf** (0,5·SAT-Score + 0,3·Zustand + 0,2·Auslastung, SAT 130 % = Maximum) wirkt zurück auf die Nachfrage (`App.tsx:163-174`, `gameState.ts:375-377`).

### Rechenbeispiele (nachgerechnet)

Ausgangslage: Typ-Beliebtheit 70, Interior 55, Zustand 100, also Plane SAT 60. Strecke 2,5 h (tc 3, m = 1,8), Snack mit 9 SAT, keine Extras, Normal.

| Fall | Ergebnis |
|---|---|
| Gleiche Kabine, Economy / Business / First | **99 % / 65 % / 59 %** (höhere Erwartung bei Business/First) |
| Dazu Check-in-Strafe −15 Qualitätspunkte | Economy **99 → 75 %** (−24 SAT-Punkte) |
| Dieselben 4 Extras (WLAN unlimited, Kit, Kissen, Kopfhörer, zusammen 62 Rohpunkte) bei 45 min / 2,5 h / 6,7 h / 13,3 h | **272 % / 155 % / 97 % / 86 %** |
| Interior-Zustand 100 / 80 / 50 / 0 % | Plane SAT **60 / 53 / 42 / 24** |
| 150 Economy (Score 50) + 8 First bei Pitch 150 cm: First Standard (70) → Closed Suite (70 + 2·50 = 170) | Interior-Mittel **51 → 56** |
| `applyDiminishingReturns` Eingabe 61 / 65 / 70 / 80 / 100 | Ausgabe **64 / 70 / 74 / 80 / 88** |

---

## 4. Bestätigte Logikfehler mit Korrektur

Sortiert nach Auswirkung.

### L1 · (offen) Ein Sitzsuite-Upgrade hilft der First Class kaum (Plane SAT ist für alle Klassen gleich)
- **Befund:** Der Kauf berechnet den Komfort je Klasse (`ConfigurePurchaseView.tsx:397-447`), mittelt ihn aber nach Sitzzahl zu **einer** Zahl (`:451-456`). `calculateClassSatisfaction` nimmt diese Zahl für jede Klasse (`financeUtils.ts:600, 602`). Die Oberfläche zeigt sogar dieselbe Zahl je Klasse (`RoutePlannerView.tsx:3064-3072`).
- **Folge:** Ein Suite-Sitz für 8000 $ hebt den Mittelwert nur von 51 auf 56. Die Economy-Passagiere profitieren mit, obwohl sie ihn nicht nutzen.
- **Korrektur:**
  - `interiorByClass` (Kauf berechnet die Werte schon) am Flugzeug speichern.
  - `getPlaneSat(aircraft, klasse)` nutzt den Klassenwert.
  - Alte Spielstände fallen auf `baseInteriorPop` zurück (`saveMigration.ts:75-77`).
  - KI: der Personality-Wert gilt für alle Klassen (`aiSimulation.ts:141`).
  - Voraussetzung: Der Klassenwert ist nach oben offen (Residence: 70 + 160 + …). Dafür braucht es eine Obergrenze oder `applyDiminishingReturns`, sonst explodiert die First-SAT.

### L2 · (behoben) „Abnehmender Ertrag“ verstärkt im Bereich 60–80
- **Befund:** `60 + √((x−60)·20)` liegt bei einem Überschuss unter 20 **über** dem Eingang (`financeUtils.ts:559-565`). Beispiel: 65 → 70, 70 → 74. Ein Punkt über der Schwelle bringt +4,5 statt +1.
- **Korrektur (eine Zeile, bestehende Tests 88/102/115 bleiben gültig, `financeUtils.test.ts:50-55`):**
  ```ts
  return Math.round(THRESHOLD + Math.min(excess, Math.sqrt(excess * SCALE)));
  ```
  Bis 20 Punkte über der Schwelle gilt 1:1, danach die Wurzel. Die Kurve wächst durchgehend und wird nie über dem Eingang liegen.

### L3 · (behoben) Check-in: „gar kein Schalter“ ist besser als „nur Self-Service“
- **Befund:** Die Prüfung `!self && !normal → −15` steht vor `premium && !normal → −25` (`financeUtils.ts:596-598`). Premium/Business/First: keine Schalter −15, nur Self-Service −25. Wer einen Self-Service-Schalter baut, verschlechtert die Premium-Klassen. Economy: nur Self-Service +5, aber Self-Service plus normale Schalter 0.
- **Korrektur:** Ein zusätzlicher Schalter darf nie schaden. Vorschlag:

  | | keine | nur Self | normal (mit/ohne Self) |
  |---|---|---|---|
  | Economy | −15 | 0 | 0 |
  | Premium/Business/First | −15 | −10 | 0 |

  Den +5-Bonus streichen (oder auch bei „beide Typen“ geben). Tooltip `InfoTooltip.tsx:153-158` und Anzeige `AirportDetailView.tsx:365` anpassen.

### L4 · (behoben) Der Check-in-Effekt zählt nur am Abflughafen, die Überlast an beiden
- **Befund:** `deskPenalty` nutzt `airportManagement[routeOrigin]` (`financeUtils.ts:590-598`). Die Überlast summiert Start und Ziel (`:696`). Eine Route zu einem Ziel ohne Schalter bleibt straffrei, obwohl die Passagiere dort zurückfliegen.
- **Korrektur:** Strafe je Flughafen berechnen und das Mittel (oder Minimum) nehmen.

### L5 · (offen) Zwei Einheiten werden vermischt
- **Befund:** `deskPenalty` (−15/−25/+5) sind Qualitätspunkte **vor** der Wurzel und der Division durch die Erwartung (`:603`). `overloadPenalty` und `satDelta` sind SAT-Prozentpunkte **danach** (`:708`, `:932`). Im Beispiel kosten −15 Qualitätspunkte 24 SAT-Punkte, während „−20 Überlast“ immer genau 20 kostet, egal wie die Kabine aussieht. Die Flughafenansicht mischt beides im selben Satz (`AirportDetailView.tsx:365`).
- **Korrektur:** Eine Einheit wählen. Empfehlung: die Überlast in Qualitätspunkten in SOFTWARE verrechnen (wie die Schalter selbst), die Moral als ±Punkte lassen und beides im UI mit gleicher Einheit beschriften.

### L6 · (behoben) Zustand wertet auch die Typ-Beliebtheit ab
- **Befund:** `(Typ·0,33 + Interior·0,67) · (0,4 + 0,6·Zustand)` (`financeUtils.ts:378-379`). Das Glossar verspricht „skaliert den **Interior**-Anteil“ (`InfoTooltip.tsx:175`). Ein abgenutztes Interieur senkt so auch die Beliebtheit des Flugzeugmodells.
- **Korrektur:** `Typ·0,33 + Interior·0,67·(0,4 + 0,6·Zustand/100)`. Bei Zustand 50 ergibt das Plane SAT 49 statt 42.

### L7 · (behoben) Zwei getrennte Schalter-Lastformeln, eine davon tot
- **Befund:** `getAirportUpkeep` berechnet `deskLoad` und `satDeduction` (`financeUtils.ts:95-99`) mit der Sitzkapazität der Flugzeuge, getrennt nach Abflügen und Ankünften. Nichts liest sie. Die Oberfläche nutzt `getDeskSim` (`AirportDetailView.tsx:99-103`), das ganz anders zählt (`:383-423`): Sitze statt Passagiere, Einweg-Flüge zählen wie Hin- und Rückflug, harte Stufen 80/90/100 % mit −2/−4/−20, unerklärter Abzug `−Self-Anteil·1`. Das Glossar nennt „ab 90 %“ (`InfoTooltip.tsx:163`), der Code straft schon ab 80 %.
- **Korrektur:** Totes Stück in `getAirportUpkeep` löschen. Für `getDeskSim` eine stetige Kurve durch die alten Eckwerte verwenden, damit es keine Klippe zwischen 100 % und 101 % gibt: bis 80 % kein Abzug, 80–100 % linear bis −4 (`−(Last−80)·0,2`), 100–110 % linear bis −20 (`−min(20, 4 + (Last−100)·1,6)`). Text angleichen (Glossar „ab 80 %“).

### L8 · (behoben) Doppelte, ungenutzte Stand-Formel
- **Befund:** `getStandBonus` (`:425-443`, stetig, beide Flughäfen) wird nirgends benutzt. Live gilt ein Alles-oder-nichts-Bonus nur am Abflughafen (`:581-587`).
- **Korrektur:** Entweder `getStandBonus` einbauen (stetig, beide Enden) oder löschen. Empfehlung: einbauen.

### L9 · (offen) Preisvorgabe passt nicht zur Marktpreisleiter
- **Befund:** Der Standardpreis und der „General“-Regler nutzen feste Faktoren 1,6 / 3,0 / 5,0 auf den Break-even-Preis (`RoutePlannerView.tsx:1022-1031`, `:3551`, `:3589`). Der Markt rechnet mit Zeitklassen-abhängigen Faktoren: Premium 1,3…2,35, Business 2,0…3,75, First 3,0…6,5 (`financeUtils.ts:526-528`). Auf Kurzstrecken liegen die Vorgaben zu hoch, auf Langstrecken zu niedrig. Zu hohe Preise bestraft die Nachfrage ×3 (`:735`).
- **Weiterer Befund:** Der „faire Preis“ (`satBase`) ist der wichtigste Wert, erscheint aber nur im Debug-Panel (`RoutePlannerView.tsx:3478-3520`). Der Spieler sieht nur Break-even-Marken (`:3635-3648`).
- **Korrektur:** Klassenfaktoren aus `calculateBasePrices` ableiten (auch für die Break-even-Gewichte `financeUtils.ts:1081-1090`). Eine Marke „Marktpreis bei SAT x %“ auf dem Regler anzeigen. Startpreis = Marktpreis; liegt er unter Break-even 75 %, einen Hinweis anzeigen.

### L10 · (offen) Ruf-Anzeige und Ruf-Wirkung stimmen nicht überein
- **Befund:** Die Karte zeigt `(Ruf−50)·0,2 %` (`MyCompanyView.tsx:230`). Der Code rechnet `0,85 + Ruf/100·0,2`, also −15 % … +5 %, neutral erst bei Ruf 75 (`gameState.ts:375-377`). Der Kommentar verspricht „a tenth either way“ (`:371-374`). Bei Ruf 50 zeigt die Karte 0 %, tatsächlich wirken −5 %.
- **Korrektur:** Entscheidung nötig: Formel auf `0,90 + Ruf/100·0,2` ändern (neutral bei 50, wie der Kommentar) oder nur die Anzeige an die Formel anpassen. Die Formel-Änderung erhöht die Nachfrage bei Ruf 50 um ca. 5 %.

### L11 · (teilweise behoben) Kleinere Punkte
- `adjustSatForDifficulty`, Zweig `baseSat <= -10` für Easy ist unerreichbar, `baseSat` ist nie negativ (`:350-352`).
- Schwierigkeit wirkt doppelt: SAT ×1,15/×0,85 (`:348-359`) und Nachfrage `S` = 1,2/1,1/1,0 (`:464`). „Normal“ ist also nicht neutral.
- Preis 0 oder fehlende Klasse im Preisfeld ergibt `NaN` (`getPriceDemandMultiplier`, `:737-744`, Aufruf `:1012-1013`).
- Der Kauf-Preview dupliziert die Formel `0,33/0,67` statt `getPlaneSat` zu nutzen (`ConfigurePurchaseView.tsx:472`) und beschriftet sie „×1/3, ×2/3“ (`:1348`).
- `basePricePoints` im Planer dupliziert die Break-even-Preise der Engine (`RoutePlannerView.tsx:1006-1020` vs. `financeUtils.ts:1081-1095`). Der Kommentar `:997-1001` ist veraltet, die Engine liefert `basePriceBE*` inzwischen.
- Der Verschleiß-Deckel ist wirkungslos: `IC_MONTHLY_CAP = 1` wird nie erreicht, ein Monat hat höchstens 720 Stunden (`App.tsx:2125`). Bei 60 Flugstunden pro Woche verliert das Interieur etwa 0,4 Punkte pro Monat, der Zustand spielt daher kaum eine Rolle.
- Die Route-Überschrift „Yield Performance Index“ (`RoutePlannerView.tsx:3008`) bezeichnet SAT falsch.

---

## 5. Ungereimtheiten mit Designentscheidung

### D1 · Zeitfaktor verzerrt Extras und Service stark
Die gleichen vier Extras bringen 272 % bei 45 min und 86 % bei 13,3 h (Beispieltabelle). Die Kosten pro Passagier sind bei jeder Dauer gleich (`cateringPerPax`, `financeUtils.ts:994-1001`). Extras sind also auf Kurzstrecken bis zu 3,75× wirksamer pro Dollar. Das Glossar sagt das Gegenteil: „Expectations rise with flight length“ (`InfoTooltip.tsx:98-100`). Essen wird über `mealCount` ausgeglichen, Extras und Service nicht.
- **Vorschlag:** Extras/Service bekommen einen eigenen flachen Faktor (Vorschlag 1,5). Nur Essen behält `m(tc)`. Danach Sollwerte über `scripts/` prüfen.

### D2 · SAT wirkt viermal auf den Ertrag
1. fairer Preis (`:1011`), 2. Elastizität (`:739`), 3. Preisreiz nutzt schon den SAT-Preis (`:1019`), 4. SAT-Reiz im Marktanteil (`:1020`, `:824`). Dazu nimmt das Modell für Rivalen SAT 100 % und Marktpreis an (`:807-808`).
- **Vorschlag:** Nicht sofort ändern. In der Oberfläche ausweisen (siehe Abschnitt 6) und beim nächsten Balancing auf zwei Kanäle reduzieren.

### D3 · Drei Gewichtungen für „die“ Route-SAT
Die Überschrift nutzt Sitzgewichte (`financeUtils.ts:722-732`), der Ruf Passagiergewichte (`App.tsx:1383-1391`), der Erlös liegt bei First und Business viel höher. Vorschlag: Beschriftung „Ø nach Sitzen“ oder Erlösgewichte (1/1,6/3/5, wie `:1081-1086`).

### D4 · Fünf Bedeutungen von „SAT“
Typ-SAT (`aircraft.popularity`), Interior-SAT (`baseInteriorPop`), Plane SAT, Cabin SAT (vor Check-in) und Route-SAT. Dazu Qualitätspunkte und Prozentpunkte. Vorschlag: eigene Namen in der Oberfläche (Type Appeal, Cabin Comfort, Aircraft Quality, Service SAT, Route SAT) und ein Glossar.

---

## 6. Vorschläge für die Verständlichkeit

### Flugzeugkauf (`ConfigurePurchaseView.tsx:1327-1351`, Block „Quality Estimate“)
1. **Rechenweg-Tabelle** statt drei Einzelzeilen: pro Klasse Startwert, Sitztyp, Pitch, Features, Summe. Darunter Mittelwert, Extras, dann `Typ·0,33 + Interior·0,67` mit Ergebnis.
2. **Wirkung je Option** in echten Zahlen: „+5 Interior → +3,3 Plane SAT“ statt nur „+5 interior SAT pts“ (`signedPts`, `:109`).
3. **Vorschau auf einer Referenzstrecke** (2 h, Standard-Snack): SAT je Klasse und „fairer Preis ±x %“, berechnet mit `calculateClassSatisfaction`.
4. Warnhinweis, wenn eine Konfiguration die Plane SAT senkt (Reduced Galley/Minimal Services) und was sie dafür einspart.
5. Bei Refit: Zustand vorher/nachher und die Restwert-Regel (90 − 10·Refits) anzeigen.

### Routenerstellung
1. **Schritt 3, Rechenweg je Klasse:** Balken/Liste „HARDWARE: Flugzeug +60, Extras +…, Stand +2 · SOFTWARE: Catering …, Service …, Lounge …, Check-in … · Qualität → Erwartung → SAT“. Die Engine liefert `hardProduct`, `softProduct`, `providedQuality`, `expectationTarget` schon (`financeUtils.ts:631-642`), es fehlt die Aufschlüsselung der Beiträge. Dafür eine Liste `contributions` im Rückgabewert ergänzen, damit keine Ansicht selbst rechnet (Grundsatz laut `README.md`, „Die Finanzsimulation liegt vollständig in `financeUtils.ts`“).
2. **Optionen mit echtem Effekt:** Die Optionskarten zeigen heute `opt.sat × Zeitfaktor` (`RouteConfigOverlay.tsx:278, 361, 418`). Das sind Rohpunkte, die durch Wurzel und Erwartung verwässert werden. Besser: „≈ +N SAT-Punkte · +x $/Passagier · Δ Wochenprofit“, berechnet durch Differenz von zwei Engine-Läufen (gemerkt per `useMemo`).
3. **„Bis 100 % fehlen …“** mit dem wirksamsten nächsten Hebel.
4. **Schritt 4, Preis:** Marktpreis-Marke, Nachfrage-Multiplikator und Auslastung live neben dem Regler. Debug-Werte (`:3478-3520`) als „So wirkt SAT auf den Preis“ (vier Kanäle, D2) für alle sichtbar machen.
5. **Flughafenansicht:** Schalter-Effekt in derselben Einheit wie in der Route (L5).

Die Oberflächentexte bleiben Englisch (Entscheidung in `ANALYSE.md:34`).

---

## 7. Generelle Verbesserungen

1. **Magische Zahlen benennen:** ein `SAT_CONFIG` mit 20, 42/48/64/70, 0,15, 60/20, 0,33/0,67, 1,15/0,85 usw. (heute verstreut in `financeUtils.ts:378, 602-626, 348-359, 559-565`).
2. **`financeUtils.ts` (1383 Zeilen) aufteilen:** `satisfaction.ts`, `demand.ts`, `pricing.ts`. Die Typen von `any` (z. B. `getPlaneSat(aircraft?: any)`, `:371`) auf `Aircraft`/`OwnedAircraft` ändern.
3. **Eigenschaftstests:** mehr Ausgaben pro Option darf SAT nie senken; Diminishing-Returns monoton; Schalter hinzufügen darf nie schaden; Plane SAT je Klasse. Muster: `financeUtils.test.ts:7-60`.
4. **Balance-Skript in `scripts/`:** gibt SAT für Referenzkabinen und Strecken (45 min … 14 h) aus, damit Ausreißer wie 272 % auffallen.
5. **SAT über 100 % sichtbar machen:** Der Balken wird bei 100 gekappt (`RouteDetailView.tsx:436`), obwohl bis ~150 % noch Preisvorteil entsteht.
6. **Rundungskette verkürzen:** Plane SAT 2×, Interior, Extras, SAT und `satBase` werden einzeln gerundet (`:378-379`, `:468`, `:564`, `:629`, `:1011`). Erst am Ende runden.
7. **Spielstand-Kompatibilität:** Formeländerungen ändern Bestandsrouten. `saveMigration.ts` um eine Version ergänzen und Änderung im Changelog nennen.
8. **`ANALYSE.md` und Glossar pflegen:** Texte an die Formeln koppeln (Glossar aus denselben Konstanten erzeugen), damit sie nicht abweichen (siehe L3, L6, L7, L10).

---

---

## 8. Status der Korrekturen

In diesem Branch behoben (mit Tests in `src/lib/financeUtils.test.ts`):

| Nr. | Änderung |
|---|---|
| L2 | `applyDiminishingReturns` zahlt nie mehr als es bekommt: `60 + min(Überschuss, √(Überschuss·20))`. 65 bleibt 65 (vorher 70). |
| L3 | Neue Funktion `getDeskPenalty`: kein Schalter −15; nur Self-Service −10 für Premium/Business/First (vorher −25) und 0 für Economy (vorher +5). Ein Schalter macht nie schlechter. |
| L4 | Die Check-in-Strafe gilt für Abflug- **und** Zielflughafen (Mittelwert). |
| L6 | `getPlaneSat`: Der Verschleiß betrifft nur den Interior-Anteil. Zustand 0 ergibt bei Typ 70 / Interior 55 jetzt 38 statt 24. |
| L7 | Totes `deskLoad`/`satDeduction` aus `getAirportUpkeep` entfernt. Die Überlast in `getDeskSim` läuft stetig (`getDeskOverloadSat`): 0 bis 80 %, −2 bei 90 %, −4 bei 100 %, −20 ab 110 %. Glossar sagt „ab 80 %“. |
| L8 | `getStandBonus(originId, destId, slotType, mgt)` ist jetzt in Gebrauch: bis +2, anteilig, Mittel über beide Flughäfen. Der Alles-oder-nichts-Block nur am Abflughafen ist entfernt. |
| L11 | Tote Easy-Bedingung entfernt. Fehlender Klassenpreis fällt auf den Marktpreis zurück (vorher `NaN` im Routenergebnis); `getPriceDemandMultiplier` fängt Preis ≤ 0 und Marktpreis ≤ 0 ab. Kaufvorschau nutzt `getPlaneSat`. Break-even-Preise im Planer kommen aus der Engine (bitgleich zur entfernten Kopie geprüft). Überschrift „Yield Performance Index“ → „Average over all seats“. |
| Texte | Glossar (`desks`, `deskLoad`, `stands`, `conditionInterior`) und Flughafenansicht (Check-in, Stands, Lounge) an die neuen Regeln und die Einheit „quality pts“ angepasst. |

Vorher/nachher (echte Funktionen):

| Größe | vorher | nachher |
|---|---|---|
| `applyDiminishingReturns` 61 / 65 / 70 / 80 / 100 / 150 | 64 / 70 / 74 / 80 / 88 / 102 | 61 / 65 / 70 / 80 / 88 / 102 |
| Plane SAT (Typ 70, Interior 55) bei Zustand 100 / 80 / 50 / 0 | 60 / 53 / 42 / 24 | 60 / 56 / 49 / 38 |
| Economy: kein Schalter / nur Self / normal | −15 / +5 / 0 | −15 / 0 / 0 |
| Premium: kein Schalter / nur Self / normal | −15 / −25 / 0 | −15 / −10 / 0 |
| Überlast bei 80 / 90 / 100 / 100,5 / 105 / 110 % | 0 / −2 / −4 / −20 / −20 / −20 | 0 / −2 / −4 / −4,8 / −12 / −20 |

Bewusst **nicht** umgesetzt (Datenmodell, Balancing oder Designentscheidung nötig): L1, L5, L9, L10, D1–D4 sowie die Erklär-Oberflächen aus Abschnitt 6 und die Verbesserungen aus Abschnitt 7.

Auswirkung auf bestehende Spielstände: Kein Migrationsschritt. Routenwerte werden beim nächsten Monatsabschluss neu berechnet. Bei abgenutzter Kabine, Zielflughäfen ohne Schalter und Überlast zwischen 80 und 110 % ändern sich die SAT-Werte.
