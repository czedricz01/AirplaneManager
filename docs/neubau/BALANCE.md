# Balance-Skript: Auswertung

Das Balance-Skript rechnet mit den Funktionen aus `src/model/` Beispielwerte für typische Strecken und Jahre und prüft
die Balance-Regeln der Spezifikation. Es ändert keine Konstante. Ob eine Stellschraube geändert wird, entscheidet der
Mensch (Fragen in `ENTSCHEIDUNGEN.md`, Abschnitt „Offen“).

## Aufruf und Aufbau

```bash
npm run balance
```

```bash
npm run balance -- --out docs/neubau/balance/O61-O62-bericht.md
```

| Datei | Inhalt |
|---|---|
| `scripts/balance.ts` | Aufruf (Konsole oder Datei mit `--out`) |
| `src/balance/index.ts` | alle Abschnitte zu einem Bericht |
| `src/balance/report.ts` | Aufbau (Prüfregel mit Urteil, Tabelle, Abschnitt), Zahlen-Format, Markdown |
| `src/balance/world.ts` | Beispiel-Welten: kleiner `ModelState` mit einer oder zwei Gesellschaften, gerechnet mit `monthOperations` (dieselbe Rechnung wie Planer und Abschluss, R2) |
| `src/balance/market.ts` | Abschnitte 1–3: Zeit und Geld, Zufriedenheit, Nachfrage (alle 115 440 Städtepaare) |
| `src/balance/routes.ts` | Abschnitte 4–5: typische Strecken beim gewinnbesten Preis, Empfindlichkeit der Marktgröße, Preiskampf |
| `src/balance/balance.test.ts` | Tests des Skripts (Format, Beispiel-Welten) |
| `docs/neubau/balance/3.9a-bericht.md` | Ausgabe des Skripts (Stand 3.9a, vor E64 und E65) |
| `docs/neubau/balance/O61-O62-bericht.md` | Ausgabe des Skripts nach E64 (`DEMAND_GROWTH_1960_2019` = 2,25) und E65 (aktueller Stand) |

Der Code liegt in `src/balance/`, damit `npm run lint` ihn prüft (`scripts/` ist davon ausgenommen). Die Oberfläche
importiert nichts von dort.

**Urteile:** **ok** = Regel der Spezifikation gilt · **Abweichung** = Regel gilt nicht, Entscheidung nötig ·
**Info** = die Spezifikation nennt keine feste Grenze; der Wert wird hier bewertet.

**Rahmen der Beispiele (F44):** Monat Mai (Saison 1,03, nahe am Jahresmittel), neue Flugzeuge, Kabine und Service nach
der Persönlichkeit (`rivalAircraft`, `rivalService`, 7.5; meist „Flag“), Ruf 50, Lohn 100 %, keine Forschung, Strecke
24 Monate alt (Anlauf vorbei), Preis = gewinnbester Preis je Klasse (4.10). „Heute“ ist 2019, weil 2020 die Pandemie
(Faktor 0,2) läuft.

## Ergebnis Paket 3.9a (Abschnitte 1–5)

Stand 3.9a: 5 ok · 2 Abweichung · 12 Info (`balance/3.9a-bericht.md`).
**Nach E64 und E65 (19.11.2026): 6 ok · 0 Abweichung · 13 Info.** Alle Zahlen: `docs/neubau/balance/O61-O62-bericht.md`.
Die Zahlen in Fund 1 und in der Tabelle „Weitere Werte“ stammen aus diesem neuen Bericht; durch die etwas kleinere
Marktgröße (E64, im Jahr 1990 −5 %) sinken beste Preise und Margen leicht.

### Fund 1: Ein Flugzeug ist fast überall bei jedem Preis voll (B4.1, B4.5, B5.4) → Frage O60

Die Marktgröße eines typischen Paars ist viel größer als das, was ein Flugzeug anbietet: FRA–MAD 1990 hat
7 930 Fluggäste je Woche, ein A320ceo mit 14 Abflügen 1 876 Sitze. Ohne Rivalen hebt die Knappheit den besten Preis
(4.4, 4.10) weit über den Marktpreis:

| Strecke (allein) | Bester Preis Y | Auslastung | Marge | Kaufpreis zurück nach |
|---|---|---|---|---|
| ATR 72-200 HAM–NUE 1990 | 4,00 (Obergrenze) | 100 % | 77 % | 1,2 Jahren |
| A320ceo FRA–MAD 1990 | 3,37 | 97 % | 73 % | 1,4 Jahren |
| A330-300 FRA–JFK 1995 | 1,21 | 87 % | 70 % | 1,1 Jahren |
| 787-9 FRA–SIN 2019 | 1,26 | 97 % | 70 % | 1,4 Jahren |

- Alle 11 Strecken bringen Gewinn (E7 erfüllt, B5.5), aber mit Margen von 58–77 %; ein neues Flugzeug ist nach
  0,4–2,1 Jahren bezahlt. Zwei kurze Strecken bleiben sogar beim höchsten Preisniveau 4 voll.
- E24 („ohne Rivalen ist der Marktpreis etwa der erlösbeste Preis“) gilt nur, wenn die Sitze reichen. Das ist bei einem
  Flugzeug fast nie der Fall.
- Ursache ist nicht der Preis und nicht die Kosten: Die Gewinnschwelle liegt bei voller Maschine beim 0,3- bis
  1,2-Fachen des Marktpreises (1,2: Caravelle 1962); bei Auslastung 75 % und Marktpreis deckt eine Mittelstrecke ihre Kosten knapp. Das ist
  vernünftig. Zu groß ist der Markt je Flugzeug.
- Empfindlichkeit (B4.5, Marktgröße × Faktor, wie ein kleineres `DEMAND_SCALE`):

  | Strecke allein | × 1 | × 0,5 | × 0,25 | × 0,1 |
  |---|---|---|---|---|
  | ATR 72-200 HAM–NUE 1990: Preis / Marge | 4,00 / 77 % | 2,84 / 67 % | 1,95 / 52 % | 1,29 / 9 % |
  | A320ceo FRA–MAD 1990: Preis / Marge | 3,37 / 73 % | 2,33 / 60 % | 1,48 / 37 % | 1,31 / −38 % |
  | A330-300 FRA–JFK 1995: Preis / Marge | 1,21 / 70 % | 1,10 / 45 % | 1,10 / −4 % | 1,10 / −151 % |

  Eine einzelne Zahl passt nicht für alle Längen: Bei × 0,25 ist die Kurzstrecke noch sehr einträglich, die
  Langstrecke kaum noch. Kurze Paare sind im Verhältnis zu groß (HAM–NUE mit 10 514 Fluggästen fast so groß wie
  FRA–CDG mit 13 400; `LINK_EXP` und `distanceFactor` bestimmen das).
- Offen ist, wie stark Rivalen die Preise drücken. Zwei gleiche Gesellschaften mit je einem Flugzeug bleiben bei
  3,19 (beide voll, B4.2); mit je vier Flugzeugen fallen die Preise auf 1,36–1,74. Wie viele Angebote ein Paar im
  laufenden Spiel hat, zeigt erst der Langlauf mit KI (Paket 3.9b).

### Fund 2: Die Marktgröße wächst im Mittel stärker als × 2,5 (B3.1) → entschieden: E64 (O61 = A)

`demandGrowth` 2019 = 2,5 (wie festgelegt). Über alle 115 440 Paare wächst die Marktgröße 1960 → 2019 aber im Mittel der
Verhältnisse um × 3,36, im Median um × 2,79 und in der Summe um × 2,78. Grund: Die Weltanteile der Städte (`relativeSize`)
verschieben sich; die Summe der Stadtgrößen bleibt gleich, aber die Verflechtung ist ein Produkt zweier Städte. Wachsen
einzelne Städte stark (vor allem in Asien), wächst die Summe über alle Paare mit. Das Mittel der Verhältnisse wird von
kleinen Paaren mit großem Zuwachs gezogen und ist als Maß wenig aussagekräftig; die Summe misst, „wie viel mehr Menschen
fliegen“.

**Entscheidung E64:** Regel 3.3 gilt für die Summe; `DEMAND_GROWTH_1960_2019` = 2,25. Ergebnis: Summe × 2,51, Median
× 2,51, Mittel der Verhältnisse × 3,02 → B3.1 **ok**. Die Marktgröße typischer Paare sinkt dadurch 1990 um etwa 5 %,
2019 um etwa 10 % (FRA–MAD 2019: 9 966 → 8 948).

### Fund 3: Beste Antworten zweier gleicher Gesellschaften springen hin und her (B4.3) → entschieden: E65 (O62 = A)

Mit je vier A320ceo auf FRA–MAD 1990 antworten zwei Optimizer abwechselnd mit 1,74 und 1,36 (Zyklus; Stand 3.9a: 1,45); einen festen
Punkt, wie 7.6 ihn erwartet, gibt es nicht. Die Preise bleiben weit über den Kosten (Gewinnschwelle voll 0,62; B4.2 ok).
Grund: Der beste Preis springt, wenn eine Gesellschaft gerade voll wird und der Überlauf (3.11) zur anderen geht. Eine
Dämpfung (jeden Monat nur der halbe Weg zum besten Preis) beendet den Zyklus nicht; im Versuch wechselten die Preise dann
zwischen 1,44, 1,59 und 1,49 (Hilfsrechnung in Sitzung 3.9a, nicht im Projekt).

**Entscheidung E65:** Ein fester Punkt ist nicht nötig; 7.6 verlangt nur, dass die Preise über den Kosten bleiben (B4.2
ok). B4.3 ist jetzt **Info**. Ob die KI-Preise im laufenden Spiel störend springen, misst 3.9b; nur dann bekommt der
Optimizer eine Schrittgrenze `FARE_STEP`.

### Weitere Werte (Info)

| Nr. | Wert | Bewertung |
|---|---|---|
| B1.1 | Treibstoff ÷ Kostenindex: 1980 2,19; 1990 0,80; 2020 1,24 (1960 = 1) | Die Krisen-Jahre treffen Treibstoff-lastige Strecken (Langstrecke 45–68 % Treibstoff); kein Handlungsbedarf. |
| B2.2 | LCC Economy FRA–CDG Satisfaction 89 (Faktor 0,95); auf FRA–JFK 48 (0,74) | Kurz passt der Ausgleich über die Preis-Lage 0,90 (7.4); auf Langstrecke ist der Abzug ohne Service groß. Prüfung im Langlauf (3.9b, „ähnlicher Erfolg“). |
| B3.3 | Entfernungs-Faktor kurz : lang = 5,16 | wie Startwert. Zusammen mit Fund 1 (kurze Paare im Verhältnis groß) ein möglicher Hebel. |
| B3.4 | Turboprop ÷ Jet: Anziehung 0,72 (FRA–CDG), 0,65 (FRA–MAD) | „spürbar“ nach E20; passend. |
| B3.5 | Hard gegen gleichen Rivalen −5,7 %, allein −1,6 % (Easy +5,2 % / +1,4 %) | Allein wirkt die Schwierigkeit kaum, weil „Nicht fliegen“ bei vielen Abflügen schwach ist. Bei knappen Sitzen (Fund 1) wirkt sie gar nicht. Erst nach O60 einstellen. |
| B4.4 | Bester Preis gegen gleichen Rivalen beim Marktpreis: 3,19 (je ein Flugzeug), 1,74 (je vier) | Der Hinweis aus 4.10 (70 %) gilt nur ohne Sitz-Grenze; bei den Startwerten bestimmen die Sitze. |
| B5.1 | Landegebühr Kurzstrecke 28–31 % der Kosten | im Rahmen 26–40 % (ok). |
| B5.2 | Marge Langstrecke Ø 66 %, kurz/mittel Ø 70 % | Langstrecke ist nicht mehr besonders einträglich; alle sind es (Fund 1). |
| B5.3 | Check-in und Abfertigung 3–17 % der Kosten | ohne Bodenpersonal-Aufschlag vertretbar; kein Handlungsbedarf. |
| B5.4 | Kaufpreis nach 0,4–2,1 Jahren eingespielt | Folge von Fund 1. |
| B5.6 | LCC ÷ Flag mit gleichem A320ceo allein auf FRA–MAD 1990: 0,65 | Die Flag-Kabine hat weniger Sitze und verkauft sie bei Knappheit teurer. Hängt an O60; „ähnlicher Erfolg“ prüft 3.9b. |

## Noch offene Prüfregeln

**Paket 3.9b – Langläufe mit `closeMonth` (Abschnitt 7, 3.13):** „ähnlicher Erfolg“ der Persönlichkeiten (7.4, 10 Läufe
je Persönlichkeit ohne Spieler, Median des Unternehmenswerts nach 20 und 40 Jahren innerhalb Faktor 2), Abschaffung des
Zuschusses (7.14), Preise und Preiskampf im laufenden Spiel (7.6, Nachweis zu O60; störende Sprünge der Optimizer-Preise nach E65), Umsteiger-Anteil unter 25 % in
Märkten mit Direktangebot (3.13), Slot-Anteile (7.10), Dividenden-Grenze und `NEW_HUB_MIN_SEATS` (7.13), KI-Stärke-Werte
(7.3), Zahl der Eröffnungen und Käufe je Jahr, `RIVAL_TURN_MINUTES`, Rechenzeit der KI-Planung mit allen Flughäfen.

**Paket 3.9c – Abschnitte 6 und 8 ohne Langlauf:** Ruf-Steigungen (6.1), `CANCELLED_REPUTATION_WEIGHT`, Werbe-Beitrag,
Ruf-Schwellen der Ränge, Klassen-Forschung aus höchstens 12 Monatsergebnissen (6.8), Ziel-, Prämien- und Straf-Anteile
(6.11), Szenario-Ziele (Ruf 55, 8.15); `HEDGE_PRICE_SHARE`, `RECOVERY_PRICE_SHARE`, `CHARTER_MARKUP`, Händler-Spanne,
Vorbestell-Rabatt, `OVERHAUL_PRICE_SHARE`, Verschleiß mit `WEEKS_PER_MONTH`, `CREDIT_LIMIT_SHARE`, `CREDIT_RATE` (8.5–8.14).
