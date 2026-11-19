# Balance-Skript: Auswertung

Das Balance-Skript rechnet mit den Funktionen aus `src/model/` Beispielwerte für typische Strecken und Jahre und prüft
die Balance-Regeln der Spezifikation. Es ändert keine Konstante. Ob eine Stellschraube geändert wird, entscheidet der
Mensch (Fragen in `ENTSCHEIDUNGEN.md`, Abschnitt „Offen“).

## Aufruf und Aufbau

```bash
npm run balance
```

```bash
npm run balance -- --out docs/neubau/balance/3.9a-bericht.md
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
| `docs/neubau/balance/3.9a-bericht.md` | Ausgabe des Skripts (Stand 3.9a) |

Der Code liegt in `src/balance/`, damit `npm run lint` ihn prüft (`scripts/` ist davon ausgenommen). Die Oberfläche
importiert nichts von dort.

**Urteile:** **ok** = Regel der Spezifikation gilt · **Abweichung** = Regel gilt nicht, Entscheidung nötig ·
**Info** = die Spezifikation nennt keine feste Grenze; der Wert wird hier bewertet.

**Rahmen der Beispiele (F44):** Monat Mai (Saison 1,03, nahe am Jahresmittel), neue Flugzeuge, Kabine und Service nach
der Persönlichkeit (`rivalAircraft`, `rivalService`, 7.5; meist „Flag“), Ruf 50, Lohn 100 %, keine Forschung, Strecke
24 Monate alt (Anlauf vorbei), Preis = gewinnbester Preis je Klasse (4.10). „Heute“ ist 2019, weil 2020 die Pandemie
(Faktor 0,2) läuft.

## Ergebnis Paket 3.9a (Abschnitte 1–5)

5 ok · 2 Abweichung · 12 Info. Alle Zahlen: `docs/neubau/balance/3.9a-bericht.md`.

### Fund 1: Ein Flugzeug ist fast überall bei jedem Preis voll (B4.1, B4.5, B5.4) → Frage O60

Die Marktgröße eines typischen Paars ist viel größer als das, was ein Flugzeug anbietet: FRA–MAD 1990 hat
8 371 Fluggäste je Woche, ein A320ceo mit 14 Abflügen 1 876 Sitze. Ohne Rivalen hebt die Knappheit den besten Preis
(4.4, 4.10) weit über den Marktpreis:

| Strecke (allein) | Bester Preis Y | Auslastung | Marge | Kaufpreis zurück nach |
|---|---|---|---|---|
| ATR 72-200 HAM–NUE 1990 | 4,00 (Obergrenze) | 100 % | 77 % | 1,2 Jahren |
| A320ceo FRA–MAD 1990 | 3,46 | 97 % | 74 % | 1,3 Jahren |
| A330-300 FRA–JFK 1995 | 1,28 | 88 % | 71 % | 1,0 Jahren |
| 787-9 FRA–SIN 2019 | 1,36 | 98 % | 72 % | 1,3 Jahren |

- Alle 11 Strecken bringen Gewinn (E7 erfüllt, B5.5), aber mit Margen von 59–77 %; ein neues Flugzeug ist nach
  0,4–2 Jahren bezahlt. Zwei kurze Strecken bleiben sogar beim höchsten Preisniveau 4 voll.
- E24 („ohne Rivalen ist der Marktpreis etwa der erlösbeste Preis“) gilt nur, wenn die Sitze reichen. Das ist bei einem
  Flugzeug fast nie der Fall.
- Ursache ist nicht der Preis und nicht die Kosten: Die Gewinnschwelle liegt bei voller Maschine beim 0,3- bis
  1,2-Fachen des Marktpreises (1,2: Caravelle 1962); bei Auslastung 75 % und Marktpreis deckt eine Mittelstrecke ihre Kosten knapp. Das ist
  vernünftig. Zu groß ist der Markt je Flugzeug.
- Empfindlichkeit (B4.5, Marktgröße × Faktor, wie ein kleineres `DEMAND_SCALE`):

  | Strecke allein | × 1 | × 0,5 | × 0,25 | × 0,1 |
  |---|---|---|---|---|
  | ATR 72-200 HAM–NUE 1990: Preis / Marge | 4,00 / 77 % | 2,92 / 68 % | 2,01 / 54 % | 1,29 / 13 % |
  | A320ceo FRA–MAD 1990: Preis / Marge | 3,46 / 74 % | 2,40 / 61 % | 1,54 / 39 % | 1,31 / −31 % |
  | A330-300 FRA–JFK 1995: Preis / Marge | 1,28 / 71 % | 1,10 / 48 % | 1,10 / 2 % | 1,10 / −136 % |

  Eine einzelne Zahl passt nicht für alle Längen: Bei × 0,25 ist die Kurzstrecke noch sehr einträglich, die
  Langstrecke kaum noch. Kurze Paare sind im Verhältnis zu groß (HAM–NUE mit 11 100 Fluggästen fast so groß wie
  FRA–CDG mit 14 146; `LINK_EXP` und `distanceFactor` bestimmen das).
- Offen ist, wie stark Rivalen die Preise drücken. Zwei gleiche Gesellschaften mit je einem Flugzeug bleiben bei
  3,29 (beide voll, B4.2); mit je vier Flugzeugen fallen die Preise auf 1,45–1,74. Wie viele Angebote ein Paar im
  laufenden Spiel hat, zeigt erst der Langlauf mit KI (Paket 3.9b).

### Fund 2: Die Marktgröße wächst im Mittel stärker als × 2,5 (B3.1) → Frage O61

`demandGrowth` 2019 = 2,5 (wie festgelegt). Über alle 115 440 Paare wächst die Marktgröße 1960 → 2019 aber im Mittel der
Verhältnisse um × 3,36, im Median um × 2,79 und in der Summe um × 2,78. Grund: Die Weltanteile der Städte (`relativeSize`)
verschieben sich; die Summe der Stadtgrößen bleibt gleich, aber die Verflechtung ist ein Produkt zweier Städte. Wachsen
einzelne Städte stark (vor allem in Asien), wächst die Summe über alle Paare mit. Das Mittel der Verhältnisse wird von
kleinen Paaren mit großem Zuwachs gezogen und ist als Maß wenig aussagekräftig; die Summe misst, „wie viel mehr Menschen
fliegen“.

### Fund 3: Beste Antworten zweier gleicher Gesellschaften springen hin und her (B4.3) → Frage O62

Mit je vier A320ceo auf FRA–MAD 1990 antworten zwei Optimizer abwechselnd mit 1,74 und 1,45 (Zyklus); einen festen
Punkt, wie 7.6 ihn erwartet, gibt es nicht. Die Preise bleiben weit über den Kosten (Gewinnschwelle voll 0,62; B4.2 ok).
Grund: Der beste Preis springt, wenn eine Gesellschaft gerade voll wird und der Überlauf (3.11) zur anderen geht. Eine
Dämpfung (jeden Monat nur der halbe Weg zum besten Preis) beendet den Zyklus nicht; im Versuch wechselten die Preise dann
zwischen 1,44, 1,59 und 1,49 (Hilfsrechnung in dieser Sitzung, nicht im Projekt).

### Weitere Werte (Info)

| Nr. | Wert | Bewertung |
|---|---|---|
| B1.1 | Treibstoff ÷ Kostenindex: 1980 2,19; 1990 0,80; 2020 1,24 (1960 = 1) | Die Krisen-Jahre treffen Treibstoff-lastige Strecken (Langstrecke 45–68 % Treibstoff); kein Handlungsbedarf. |
| B2.2 | LCC Economy FRA–CDG Satisfaction 89 (Faktor 0,95); auf FRA–JFK 48 (0,74) | Kurz passt der Ausgleich über die Preis-Lage 0,90 (7.4); auf Langstrecke ist der Abzug ohne Service groß. Prüfung im Langlauf (3.9b, „ähnlicher Erfolg“). |
| B3.3 | Entfernungs-Faktor kurz : lang = 5,16 | wie Startwert. Zusammen mit Fund 1 (kurze Paare im Verhältnis groß) ein möglicher Hebel. |
| B3.4 | Turboprop ÷ Jet: Anziehung 0,72 (FRA–CDG), 0,65 (FRA–MAD) | „spürbar“ nach E20; passend. |
| B3.5 | Hard gegen gleichen Rivalen −5,7 %, allein −1,6 % (Easy +5,2 % / +1,4 %) | Allein wirkt die Schwierigkeit kaum, weil „Nicht fliegen“ bei vielen Abflügen schwach ist. Bei knappen Sitzen (Fund 1) wirkt sie gar nicht. Erst nach O60 einstellen. |
| B4.4 | Bester Preis gegen gleichen Rivalen beim Marktpreis: 3,29 (je ein Flugzeug), 1,74 (je vier) | Der Hinweis aus 4.10 (70 %) gilt nur ohne Sitz-Grenze; bei den Startwerten bestimmen die Sitze. |
| B5.1 | Landegebühr Kurzstrecke 28–31 % der Kosten | im Rahmen 26–40 % (ok). |
| B5.2 | Marge Langstrecke Ø 68 %, kurz/mittel Ø 71 % | Langstrecke ist nicht mehr besonders einträglich; alle sind es (Fund 1). |
| B5.3 | Check-in und Abfertigung 3–17 % der Kosten | ohne Bodenpersonal-Aufschlag vertretbar; kein Handlungsbedarf. |
| B5.4 | Kaufpreis nach 0,4–2,0 Jahren eingespielt | Folge von Fund 1. |
| B5.6 | LCC ÷ Flag mit gleichem A320ceo allein auf FRA–MAD 1990: 0,65 | Die Flag-Kabine hat weniger Sitze und verkauft sie bei Knappheit teurer. Hängt an O60; „ähnlicher Erfolg“ prüft 3.9b. |

## Noch offene Prüfregeln

**Paket 3.9b – Langläufe mit `closeMonth` (Abschnitt 7, 3.13):** „ähnlicher Erfolg“ der Persönlichkeiten (7.4, 10 Läufe
je Persönlichkeit ohne Spieler, Median des Unternehmenswerts nach 20 und 40 Jahren innerhalb Faktor 2), Abschaffung des
Zuschusses (7.14), Preise und Preiskampf im laufenden Spiel (7.6, Nachweis zu O60 und O62), Umsteiger-Anteil unter 25 % in
Märkten mit Direktangebot (3.13), Slot-Anteile (7.10), Dividenden-Grenze und `NEW_HUB_MIN_SEATS` (7.13), KI-Stärke-Werte
(7.3), Zahl der Eröffnungen und Käufe je Jahr, `RIVAL_TURN_MINUTES`, Rechenzeit der KI-Planung mit allen Flughäfen.

**Paket 3.9c – Abschnitte 6 und 8 ohne Langlauf:** Ruf-Steigungen (6.1), `CANCELLED_REPUTATION_WEIGHT`, Werbe-Beitrag,
Ruf-Schwellen der Ränge, Klassen-Forschung aus höchstens 12 Monatsergebnissen (6.8), Ziel-, Prämien- und Straf-Anteile
(6.11), Szenario-Ziele (Ruf 55, 8.15); `HEDGE_PRICE_SHARE`, `RECOVERY_PRICE_SHARE`, `CHARTER_MARKUP`, Händler-Spanne,
Vorbestell-Rabatt, `OVERHAUL_PRICE_SHARE`, Verschleiß mit `WEEKS_PER_MONTH`, `CREDIT_LIMIT_SHARE`, `CREDIT_RATE` (8.5–8.14).
