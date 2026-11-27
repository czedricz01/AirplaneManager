# Balance-Skript: Auswertung

Das Balance-Skript rechnet mit den Funktionen aus `src/model/` Beispielwerte für typische Strecken und Jahre und prüft
die Balance-Regeln der Spezifikation. Es ändert keine Konstante. Ob eine Stellschraube geändert wird, entscheidet der
Mensch (Fragen in `ENTSCHEIDUNGEN.md`, Abschnitt „Offen“).

## Aufruf und Aufbau

```bash
npm run balance
```

```bash
npm run balance -- --out docs/neubau/balance/3.9c-bericht.md
```

Mit den Langläufen der KI (seit E68 16 Läufe, je 3–6 min Rechenzeit; mit 4 Prozessen je nach Rechner 30–90 min):

```bash
npm run balance -- --long --jobs 4 --out docs/neubau/balance/5.3a-bericht.md
```

Weitere Optionen: `--runs`, `--years`, `--strength-runs`, `--cache`, `--reuse` (siehe `scripts/balance.ts`).

| Datei | Inhalt |
|---|---|
| `scripts/balance.ts` | Aufruf (Konsole oder Datei mit `--out`) |
| `src/balance/index.ts` | alle Abschnitte zu einem Bericht |
| `src/balance/report.ts` | Aufbau (Prüfregel mit Urteil, Tabelle, Abschnitt), Zahlen-Format, Markdown |
| `src/balance/world.ts` | Beispiel-Welten: kleiner `ModelState` mit einer oder zwei Gesellschaften, gerechnet mit `monthOperations` (dieselbe Rechnung wie Planer und Abschluss, R2) |
| `src/balance/market.ts` | Abschnitte 1–3: Zeit und Geld, Zufriedenheit, Nachfrage (alle 115 440 Städtepaare) |
| `src/balance/routes.ts` | Abschnitte 4–5: typische Strecken beim gewinnbesten Preis, Empfindlichkeit der Marktgröße, Preiskampf |
| `src/balance/career.ts` | Abschnitt 6: Ruf je Ausstattung, Ausfälle, Werbung, Ruf-Schwellen, Klassen-Forschung und Jahresziel an der Rang-Schwelle (3.9c) |
| `src/balance/events.ts` | Abschnitt 8: Krisen-Antworten, Charter, Händler-Spanne, Vorbestellung, Überholung, Verschleiß, Kreditlinie, Szenario-Ziele (3.9c) |
| `src/balance/longRun.ts` | Langlauf ohne Spieler: Gründer je Persönlichkeit, `closeMonth` Monat für Monat, Messwerte je Jahr (3.9b) |
| `src/balance/competition.ts` | Auswertung der Langläufe: Prüfregeln B7.x und B3.13, Tabellen (3.9b) |
| `scripts/balance-run.ts` | ein Langlauf in eigenem Prozess (für `--jobs`) |
| `src/balance/balance.test.ts` | Tests des Skripts (Format, Beispiel-Welten, kurze Langläufe) |
| `docs/neubau/balance/3.9a-bericht.md` | Ausgabe des Skripts (Stand 3.9a, vor E64 und E65) |
| `docs/neubau/balance/O61-O62-bericht.md` | Ausgabe des Skripts nach E64 (`DEMAND_GROWTH_1960_2019` = 2,25) und E65 |
| `docs/neubau/balance/3.9b-bericht.md` | Ausgabe mit Langläufen (Abschnitte 1–5, 7: 10 ok · 0 Abweichung · 20 Info) |
| `docs/neubau/balance/3.9c-bericht.md` | Ausgabe ohne Langläufe (Stand 3.9c, Abschnitte 1–6 und 8: 15 ok · 0 Abweichung · 21 Info) |
| `docs/neubau/balance/3.9d-bericht.md` | Ausgabe ohne Langläufe nach E66 und `HEDGE_PRICE_SHARE` 0,35 |
| `docs/neubau/balance/3.9e-bericht.md` | Ausgabe mit Langläufen nach E71 (20 ok · 0 Abweichung · 28 Info) |
| `docs/neubau/balance/5.3a-bericht.md` | Ausgabe mit Langläufen nach Phase 5, ohne Zuschuss (aktueller Stand: 18 ok · 0 Abweichung · 32 Info) |

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

### Fund 1: Ein Flugzeug ist fast überall bei jedem Preis voll (B4.1, B4.5, B5.4) → entschieden: E67 (O60 = A)

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

## Ergebnis Paket 3.9b (Langläufe, Abschnitt 7 und 3.13)

**Ergebnis: 10 ok · 0 Abweichung · 20 Info** (alle Abschnitte; neu: B7.1–B7.9, B3.13). Zahlen:
`docs/neubau/balance/3.9b-bericht.md`. Rahmen (F46): 26 Läufe ab Januar 1960 ohne Spieler, je Persönlichkeit ein
Gründer, Drehkreuze in fester Rotation über JFK, LHR, FRA, ORD, CDG, LAX, HND, SIN, ATL, SYD; alle 628 Flughäfen;
10 × Normal mit Zuschuss, 10 × Normal ohne Zuschuss (60 Jahre), je 3 × Easy und Hard (40 Jahre).

### Vorarbeit: Rechenzeit und ein Fehler

- **Rechenzeit:** Mit der alten Planer-Rechnung dauerte ein Monat mit 5 KI um 1965 schon über 4 s (jedes der ~400
  Preisniveaus der Optimizer-Preissuche rechnete alle Märkte aller Gesellschaften). Jetzt rechnen die Planer-Rechnungen
  nur die gebrauchten Märkte: gleiches Ergebnis, etwa 135-mal schneller (F46). Ein Lauf über 60 Jahre dauert 6–8 min,
  um 2010 etwa 0,9 s je Monat bei ~560 KI-Strecken (B7.9). Für das Spiel (Phase 4) reicht das; mehr KI kosten
  entsprechend mehr.
- **Fehler F45:** Die KI erneuerte verbrauchte Kabinen jeden Monat zum vollen Preis (bis 2 000 Erneuerungen je Jahr).
  Behoben vor den Läufen.

### Fund 4: Ähnlicher Erfolg gilt (B7.1, 7.4) → ok

Median des Unternehmenswerts (Preise 1960) nach 40 Jahren: Expansionist 4 146, Flag 3 680, LCC 2 393, Optimizer 2 318,
Boutique 1 674 Mio. $; Median aller 2 496 Mio. $. Größtes Verhältnis 1,44 nach 20 und 1,66 nach 40 Jahren (Grenze 2).
Ordnung über die ganze Zeit: Expansionist und Flag vorn, Boutique hinten (0,65–0,73). Die Rotation der Drehkreuze
zeigt: Das Drehkreuz macht viel aus (Expansionist 4 716 in ATL bis 7 225 in LAX), aber nicht mehr als die Persönlichkeit.

### Fund 5: Der Zuschuss kann weg (B7.2, 7.14) → entschieden: E68 (O63 = B)

Ohne Zuschuss wird kein Gründer wegen Geldmangels aufgelöst (Median „nie“ bei allen); ähnlicher Erfolg gilt auch ohne
(Faktor 1,46 / 1,77). Der Zuschuss ist mit 2–5 Mio. $ je Jahr (1960) gegenüber 300–2 500 Mio. $ Ergebnis je KI ohne
Bedeutung. Die Bedingung aus 7.14 ist erfüllt. Einzige Auflösung in allen Läufen: LCC in SIN (Lauf 5, mit und ohne
Zuschuss) findet 1960 keine Strecke mit Gewinn, verkauft nach 5 Monaten Leerlauf alle Flugzeuge und wird aufgelöst;
das folgt den Regeln (Leerlauf-Verkauf 7.11, Auflösung ohne Flugzeuge) und hat mit dem Zuschuss nichts zu tun.

### Fund 6: Die KI hat keine Konkurrenz; alles ist voll (B7.3) → entschieden: E66 (O64 = B), E67 (O60 = A)

- **Jedes Paar hat genau eine Gesellschaft** (1,00 je Paar, 0 % geteilte Paare, nie ein Preiskampf in 10 Läufen über
  60 Jahre). Ursache ist die Bauart: Jede KI fliegt nur von ihren Drehkreuzen; zwei KI teilen ein Paar nur, wenn eine
  zum Drehkreuz der anderen fliegt. Das kommt nicht vor. Auch der Spieler trifft eine KI nur auf Strecken, die an einem
  KI-Drehkreuz enden.
- **Auslastung 100 %** im Median in jedem Jahrzehnt; Marge im Median 22 % (1970er, Ölkrisen) bis 54 % (1990er), über alles
  40 %. Das bestätigt Fund 1 im laufenden Spiel: Der Markt ist für die Sitze einer KI zu groß.
- **Preise:** Median Preisniveau Economy 0,94–0,98; die KI nimmt die Knappheit nicht mit (Flag ≈ 1,07, LCC 0,85,
  Expansionist 0,88, Boutique 1,03). Nur der Optimizer (bester Preis) liegt bei 1,3–1,75.
- **Folge für O60:** Die Empfehlung in O60 sagte „A, wenn die Marge typischer Strecken über 40 % liegt“; das ist der
  Fall. Dass Rivalen die Preise drücken (O60 B), findet ohne geteilte Paare nicht statt.

### Fund 7: Optimizer-Preise springen selten (B7.4, E65) → kein `FARE_STEP` nötig

Monatliche Änderung im Median 0,02, p90 0,08–0,10; Schritte ≥ 0,25 in 0,5–2,6 % der Strecken-Monate (andere
Persönlichkeiten 0–0,1 %). Ohne geteilte Paare gibt es keinen Zyklus wie in Fund 3. Nach E65 bekommt der Optimizer
damit keine Schrittgrenze. Neu zu prüfen, wenn O64 Konkurrenz unter der KI bringt.

### Fund 8: Umsteiger-Regel erfüllt, aber nur, weil kein Sitz frei ist (B3.13) → ok, Hinweis

Platzierte Umsteiger in Märkten mit Direktangebot: Median 0 %, p90 unter 2 %. Grund: Alle Flugzeuge sind voll, die
Umsteiger finden keinen freien Sitz (3.13: Direktgäste zuerst). Vor der Sitz-Verteilung („Wunsch“) läge der Anteil bei
15–34 %, ab 1995 über 25 %. Ändert O60 die Marktgröße, wird diese Regel wieder wichtig; dann `CONNECTION_APPEAL` prüfen.

### Fund 9: Wachstum endet um 1995; das Geld geht in Dividenden (B7.5–B7.7) → Teil von O64, entschieden: E66 (B, keine zusätzlichen Drehkreuze)

- Eröffnungen je KI und Jahr: 4,6 (1960er) → 3,6 (1980er) → 0,2 (2010er); Flugzeuge je KI 27 → 110.
- Ursache: Jede KI erreicht die Höchstzahl ihrer Drehkreuze (`maxHubs` der Persönlichkeit: 1–4) und dort ihren
  Slot-Anteil (25 %). Neue Drehkreuze: 8 je Lauf über 60 Jahre, fast alle bis 1990.
- Fast das ganze Ergebnis geht in die Dividende (ab den 1980ern 1,5–2,4 Mrd. $ je KI und Jahr in Preisen von 1960); die Kasse
  bleibt bei 1–2,6 Mrd. $. Slot-Haltungen an der eigenen Grenze nur 2–3 % (die Grenze bindet nur an den Drehkreuzen);
  größter Anteil aller KI an einem Flughafen 30 %.
- Nachrücker gibt es fast nie (nur nach der einen Auflösung), weil keine KI pleitegeht.

### Fund 10: KI-Stärke wirkt nur zwischen Easy und Normal (B7.8)

Median Unternehmenswert der Gründer nach 40 Jahren: Easy 1 535, Normal 2 496, Hard 2 379 Mio. $ (3 / 10 / 3 Läufe).
Hard kauft mehr (120 statt 106 Flugzeuge je Gründer), verdient aber nicht mehr: Wachstum endet an Drehkreuzen und Slots
(Fund 9), nicht am Geschick. Mit nur 3 Läufen je Stärke ist das ein Hinweis, kein Beweis; erst nach O60 / O64 neu messen.

## Ergebnis Paket 3.9c (Abschnitte 6 und 8 ohne Langlauf)

**Ergebnis: 15 ok · 0 Abweichung · 21 Info** (Abschnitte 1–6 und 8; neu: B6.1–B6.8, B8.1–B8.9). Zahlen:
`docs/neubau/balance/3.9c-bericht.md`. Die Langläufe (Abschnitt 7) stehen weiter in `3.9b-bericht.md`.

**Vorsicht:** Alle Ergebnisse und Margen stammen aus dem heutigen, zu großen Markt (Fund 1, E67). Wo sie zählen
(Klassen-Forschung, Jahresziel, Rückgewinnung, Kreditlinie), zeigt der Bericht daneben einen Fall mit 10 % Marge oder
Marktgröße × 0,25. Nach E67 (Paket 3.9d) den Bericht neu erzeugen.

### Fund 11: Die Ruf-Skala passt; die Spanne kommt aus der Ausstattung (B6.1, B6.2, B6.5, B6.6) → ok

- Median der Ruf-Ziele über 5 Ausstattungen × 2 Strecken (A320ceo FRA–MAD 1990, A330-300 FRA–JFK 1995): **46,7**, also
  „um 50“ (E36). Die Spanne ist groß: LCC auf Langstrecke 24,1 (Satisfaction 48), Flag auf Mittelstrecke 69,6 (124).
  Mit allen Satisfaction-Projekten (+8 Punkte) bis 76,3.
- Ruf-Schwellen der Ränge (B6.5 ok): Rang 5 (Ruf 50) erreicht Flag auf beiden Strecken; Rang 9 (65) Flag und Boutique
  auf Mittelstrecke schon ohne Forschung.
- Ruf-Meilensteine: Silber (70, Satisfaction 124) nur mit Forschung, **Gold (80, Satisfaction 136) mit keiner
  KI-Ausstattung** (bestes Ziel 76,3). Der Spieler hat mehr Hebel als die KI-Ausstattungen (Lounge, Stellplätze,
  Schalter, Personal). Hinweis, kein Handlungsbedarf: Gold soll selten sein.

### Fund 12: Gestrichene Flüge kosten im Mittel 1 Punkt; ein Defekt trifft kleine Gesellschaften hart (B6.3) → Info

Erwarteter Abzug im Ruf-Ziel 0,7 (neues Flugzeug) bis 1,6 Punkte (20 Jahre alt). Ein Defekt streicht 50 % der Flüge
eines Flugzeugs: Bei einer Gesellschaft mit **einem** Flugzeug fällt der Ruf im Monat um 7,5 Punkte und braucht 13
Monate, bis der Abstand unter 1 Punkt liegt; bei 10 Flugzeugen −0,75. Ein Defekt je Flugzeug kommt bei neuen Flugzeugen
etwa alle 25 Jahre vor; mit Charter zählt er nicht. Kein Handlungsbedarf.

### Fund 13: Werbung hebt den Ruf um höchstens 3 Punkte und klingt ab (B6.4) → ok

Alle drei Kampagnen zusammen: Gleichgewicht 53,0, nach 12 Monaten 52,6, 6 Monate nach dem Ende 51,0. Über den Ruf wirkt
das auf die Nachfrage nur mit +0,6 %; die Hauptwirkung der Werbung ist die Anziehung (3.9.5).

### Fund 14: Klassen-Forschung ist bezahlbar – heute (B6.7) → ok, nach E67 neu prüfen

Eine Gesellschaft genau an der Fluggast-Schwelle des Rangs bezahlt die Klassen-Forschung dieses Rangs aus 1,0–2,8
Monatsergebnissen (Grenze 12). Mit 10 % Marge (Ziel nach E67: 10–25 %) wären es 17,3 (Rang 1), 19,8 (Rang 2), 6,4
(Rang 4) und 12,5 (Rang 5, Jumbo + Überschall). **Nach E67 kann B6.7 für Rang 1, 2 und 5 kippen;** dann die Preise in
`CLASS_RESEARCH` senken (Spezifikation 6.8).

### Fund 15: Jahresziel: kleine Prämien, hohes Ziel lohnt ab 60 % Chance (B6.8) → Info

Ohne Mindestbetrag ist die Prämie 0,24 (sicher), 0,36 (andere Art) und 0,60 (hoch) Monatsergebnisse. Das hohe Ziel
bringt im Mittel mehr als ein sicher erreichtes sicheres Ziel, wenn es mit mindestens **60 %** Chance erreicht wird
(Strafe = halbe Prämie, E58); das sichere Ziel lohnt ab 33 %. Die Mindestprämie bindet in keinem Beispiel (Ergebnisse
groß, Fund 1); wo sie bindet, sind beide Prämien gleich und das hohe Ziel lohnt nie. Erst nach E67 bewerten.

### Fund 16: Krisen-Antworten lohnen sich mehrfach (B8.1, B8.2) → entschieden: E69 (O65 = C)

| Antwort | Ersparnis bzw. Mehr-Ergebnis ÷ Preis |
|---|---|
| Preis-Absicherung 1973 / 1979 / 1990 | 4,62 / 2,49 / 1,84 |
| Rückgewinnung 2001 / 2008 / 2020 (heutiger Markt) | 5,14 / 5,08 / 4,69 |
| Rückgewinnung 2001 / 2008 / 2020 (Markt × 0,25) | 3,41 / 3,49 / 2,51 |

- Die Absicherung hängt nur an der Treibstoff-Tabelle (gleiche Menge wie vor der Krise), nicht an der Marktgröße.
- Die Rückgewinnung holt 15–32 % des Ergebnis-Verlusts zurück; mit kleinerem Markt weniger (volle Flugzeuge verlieren
  zuerst nur „Knappheit“).
- Beide Antworten sind damit keine Abwägung, sondern immer richtig. Entschieden (E69): Absicherung 0,2 → 0,35;
  Rückgewinnung nach E67 neu messen und festlegen (Paket 3.9d).

### Fund 17: Charter lohnt auf jeder Strecke mit Gewinn (B8.3) → ok

Auf allen 13 Strecken mit Gewinn (11 typische, 2 mit Markt × 0,25) bringt Charter mehr als Streichen, mindestens
6 572 $ je Flug. Auf der einzigen Strecke mit Verlust (A330-300 FRA–JFK 1995 bei Markt × 0,25) ist Streichen besser
(−13 020 $), weil die Gebühr 115 % des Erlöses je Flug ist. So soll es sein (8.9).

### Fund 18: Flottenmarkt ohne Schlupfloch (B8.4, B8.5, B8.6) → ok, Hinweise

- **Händler-Spanne:** Gebraucht kaufen und sofort verkaufen bringt 83,0 % zurück (mit größter Forschung). Der Verlust
  entspricht 0,6 (Alter 20) bis 3,2 (neu) Monatsergebnissen einer A320ceo-Strecke.
- **Vorbestellung:** Sofort verkauft immer Verlust (−0,9 bis −7,9 % des Werts). Der Rabatt ist aber ein guter Ertrag
  der gebundenen Anzahlung: 23–42 % je Jahr gegen 8 % Kreditzins. Das belohnt Planung; kein Handlungsbedarf.
- **Überholung:** Preis = Wertgewinn in allen 5 Fällen; der Mindestpreis (4 % des Neupreises) bindet nie. Mit Hangar
  kostet die Überholung netto also nichts und senkt die Defekt-Chance (2,4–8 % weniger gestrichene Flüge je Jahr);
  ohne Hangar 25 % mehr. Der Mindestpreis greift nur bei kleinem Wertgewinn (fast neue Zelle).

### Fund 19: Verschleiß passt zur Nutzung (B8.7) → Info

Bei typischem Flugplan 45–452 Blockstunden je Monat. Langstrecke: Kabine −7,7, Zelle −5,3 Punkte je Jahr (Kabine 50
nach 6,5 Jahren, also etwa ein Umbau je 6–7 Jahre); Kurz- und Mittelstrecke −1,8 bis −2,9 bzw. −1,6 bis −2,3. Der
Gebrauchtmarkt nimmt −2,8 / −2,2 an, passend zur Mittelstrecke. Kein Handlungsbedarf.

### Fund 20: Kreditlinie großzügig für Kurzstrecke, knapp für frühe Langstrecke (B8.8) → Info

Die Grenze (50 % des Werts eines neuen Flugzeugs) deckt 4,5 (707 FRA–JFK 1965) bis 33,7 Monate feste Strecken-Kosten.
Der Zins bei voller Nutzung ist 2–28 % des Monatsergebnisses. Nach E67 neu ansehen.

### Fund 21: Szenario „Oil Shock“: Ruf 55 passt (B8.9) → ok

Nach 39 Monaten (Okt. 1973 bis Dez. 1976, Start 50): LCC-Kabine 30,9; Flag-Kabine im Zustand 60 ohne Umbau 52,3; nach
einem Umbau (Zustand 90) Flag 58,2 und Boutique 57,6. Das Ziel braucht also einen Kabinen-Umbau, wie der Kommentar im
Szenario sagt. Die Dollar-Beträge aller Szenarien als Wert von 1960 stehen im Bericht (für Phase 5.1).

## Ergebnis Paket 3.9d, Teil 1 (E66, Absicherung, Messung zu E67)

Umgesetzt: E66 (Vorauswahl, `PRESELECT_RIVAL_HUB_WEIGHT` = 2, `src/model/rivalMonth.ts:319`) und der erste Teil von
E69 (`HEDGE_PRICE_SHARE` 0,35, `src/model/constants.ts`). Neu im Langlauf: Auslastung und Marge je Streckenlänge und
Prüfregel B7.10 (F48). Kurzbericht ohne Langläufe: `balance/3.9d-bericht.md` (15 ok · 0 Abweichung · 21 Info).
Die Marktgröße (E67) ist **nicht** geändert: Ihr Ziel ist so nicht erreichbar (Fund 23) → Frage O66.

### Fund 22: E66 bringt die KI an fremde Drehkreuze, aber kaum auf dieselben Paare → Teil von O66

Mit E66 fliegen KI zu fremden Drehkreuzen (Lauf 0, 1965: JFK–ATL, ATL–FRA, CDG–JFK, SEA–JFK). Geteilte Paare bleiben
aber selten: 1 % (1960er) bis 3 % (1990er) statt 0 %. Grund: Die zweite KI fliegt dasselbe Paar fast nie zurück, und am
Drehkreuz hält der Besitzer fast alle Slots (JFK 1965: Flag 511, alle anderen 13). Eine Hilfsrechnung je Jahr
(Drehkreuze und Slots, Sitzung 3.9d, nicht im Projekt) zeigt das.

### Fund 23: Eine kleinere Marktgröße senkt die Marge der KI kaum; die Auslastung bleibt 100 % → O66

Kalibrier-Läufe (Hilfsrechnung in Kopien des Codes, F48): je Variante 4 Läufe × 40 Jahre (1960–1999), Normal, mit
Zuschuss, mit E66. Median je Strecke und Monat (Juli), Mittel über die Jahrzehnte:

| Marktgröße | Auslastung | Marge | Marge 1970er (Ölkrisen) | Marge kurz / mittel / lang (1990er) | Preis Y | Strecken (1990er, je Lauf und Monat) | aufgelöste Gründer |
|---|---|---|---|---|---|---|---|
| × 1 | 100 % | 47 % | 26 % | 41 / 49 / 66 % | 0,96–0,99 | 501 | 0 von 20 |
| × 0,5 | 100 % | 37 % | 20 % | 37 / 45 / 57 % | 0,99–1,04 | 471 | 2 |
| × 0,3 | 100 % | 31 % | 18 % | 33 / 37 / 53 % | 1,01–1,10 | 389 | 2 |
| × 0,3, `DISTANCE_EXP` 0,3 | 100 % | 29 % | 15 % | 30 / 36 / 51 % | 1,09–1,14 | 391 | 6 |

- Jede KI fliegt ihre Paare allein (Fund 22) und wählt so wenige Flüge (100 / 60 / 30 % der Umläufe), dass sie voll ist.
  Die Auslastung bleibt deshalb bei 100 %, gleich wie klein der Markt ist; nur Langstrecken fallen auf 84–99 %.
- Die Marge hängt dann am Preis gegen die Kosten. Eine volle Mittelstrecke deckt ihre Kosten beim 0,6-Fachen des
  Marktpreises, eine Langstrecke beim 0,3-Fachen (A330-300 FRA–JFK 1995, Fund 1, Spezifikation 5.18).
- Eine kleinere Marktgröße verschiebt die KI auf Kurzstrecken (bei × 0,3 die Hälfte der Strecken), macht sie ärmer
  (Kasse der Gründer nach 40 Jahren im Median 2 707 → 1 450 → 746 Mio. $) und löst mehr Gründer auf.
- Für die Ziele aus E67 (Auslastung 75–90 %, Marge 10–25 %) bräuchte es eine Marktgröße unter × 0,2; dann würde die KI in
  den 1970ern im Median Verlust machen.
- Typische Strecken allein (Abschnitt 4, Hilfsrechnung mit `runCase`): Ohne Rivalen hebt der beste Preis die Marge über
  die Knappheit. Für Kurz- und Mittelstrecke passt × 0,25 bis × 0,3 mit `DISTANCE_EXP` 0,3 (A320ceo FRA–MAD 1990: 70–80 %
  Auslastung, Marge 22–32 %); Langstrecken mit 14 Abflügen sind dann halb leer (A330-300 FRA–JFK 24–29 %).

### Fund 24: Preis-Absicherung ist jetzt eine Abwägung (B8.1) → E69 umgesetzt

Mit `HEDGE_PRICE_SHARE` 0,35 spart die Absicherung das 2,64- (1973), 1,42- (1979) und 1,05-Fache (1990) ihres Preises
(vorher 4,62 / 2,49 / 1,84). Die Rückgewinnung (B8.2, heute 2,5–5,1) wird erst nach O66 festgelegt.

## Ergebnis Paket 3.9d, Rest (E70, E67, E68, E69)

Umgesetzt (F49): Marktgröße `DEMAND_SCALE` 29 → 14,5 und `DISTANCE_EXP` 0,5 → 0,3 (`src/model/constants.ts:554`, `:564`);
Preis-Faktor je Flugzeit-Index `FARE_TIME_FACTOR` 1,04 … 0,50 (`src/model/constants.ts:723`, früher `SHORT_HAUL_FARE_FACTOR`
1,15 … 1); `RECOVERY_PRICE_SHARE` 0,15 → 0,25. Bericht mit Langläufen: `balance/3.9d-bericht.md` (16 ok · 4 Abweichung ·
28 Info; ohne Langlauf 15 ok · 0 Abweichung). Der Zuschuss bleibt an (E68, Fund 28). Neue Frage **O67** (Fund 26, 27).

### Fund 25: Kalibrierung – die Marge kommt aus dem Preis, die Marktgröße stellt die Auslastung des Spielers ein → E70 umgesetzt

Hilfsrechnung in Kopien des Codes (nicht im Projekt), je Variante 2 Läufe (Normal, mit Zuschuss). „Preis“ = Faktor auf den
Marktpreis gegenüber vorher, kurz / mittel / lang (Index 1–2 / 3–4 / 6–8). Marge und Auslastung der KI: Median je Strecke
und Monat, Median über die Jahre; „aufgelöst“ = Gründer, die bis zum Ende aufgelöst sind.

| Variante | Marktgröße | Preis kurz / mittel / lang | Jahre | Auslastung KI | Marge KI | aufgelöst | Spieler A320ceo FRA–MAD 1990 (bester Preis, beste Abflugzahl) |
|---|---|---|---|---|---|---|---|
| vorher (3.9d Teil 1) | × 1 | 1 / 1 / 1 | 40 | 100 % | 47 % | 0 von 20 | 97 % / 73 % |
| A | × 0,5 | 1 / 0,9 / 0,6 | 40 | 100 % | 26 % | 1 von 10 | 87 % / 51 % |
| B | × 0,3 | 1 / 0,9 / 0,6 | 40 | 100 % | 20 % | 4 von 10 | 81 % / 32 % |
| E | × 0,5 | 0,92 / 0,82 / 0,55 | 60 | 100 % | 26 % | 1 von 10 | 86 % / 47 % |
| F | × 0,4 | 0,95 / 0,85 / 0,57 | 60 | 100 % | 25 % | 2 von 10 | 83 % / 40 % |
| G | × 0,4 | 0,88 / 0,79 / 0,53 | 60 | 100 % | 21 % | 3 von 10 | 82 % / 35 % |
| H | × 0,3 | 0,92 / 0,82 / 0,55 | 60 | 100 % | 19 % | 5 von 10 | 81 % / 26 % |
| K = gewählt | × 0,5 | 0,9 / 0,8 / 0,55 | 60 | 100 % | 23 % | 2 von 10 | 86 % / 46 % |

- Eine kleinere Marktgröße senkt die Marge der KI nur mit vielen Auflösungen (E → H, × 0,5 → × 0,3: 26 → 19 %, 1 → 5
  Gründer aufgelöst); der Preis senkt sie fast eins zu eins (F → G, × 0,95 → × 0,88: 25 → 21 %).
- Gewählt: Marktgröße × 0,5, Preis wie K. Damit liegt die KI im Langlauf (10 Läufe) bei 23 % Marge, kurz / mittel /
  lang ähnlich (Fund 26), und ein Spieler allein ist beim besten Preis auf Mittelstrecke zu 86–88 % ausgelastet
  (Langstrecke mit wenigen Flügen 89–99 %, Bericht Abschnitt 4), nicht mehr überall voll (B4.1: keine Strecke bleibt
  beim höchsten Preis voll).
- Schwankung: Über die Jahrzehnte folgt die Marge dem Treibstoff (1970er 9 %, 1990er 30 %, 2000er 22 %, 2010er 32 %).

### Fund 26: Marge der KI im Ziel, Auslastung bleibt 100 % (B7.10) → O67

Langlauf (10 Läufe × 60 Jahre, Normal, mit Zuschuss): Marge im Mittel der Jahre **23 %** (Ziel E67: 10–25 %), kurz /
mittel / lang 1990er 29 / 31 / 29 %, 2010er 32 / 33 / 31 % (vorher 41 / 49 / 66 %). Die Auslastung bleibt **100 %**:
Die KI wählt die Flugzahl nach der Planer-Hauptzahl, und auf einem Paar ohne Konkurrenz (99 % der Paare, Fund 22) ist der
gewinnbeste Plan einer, der voll ist. Unter 100 % fällt die Auslastung nur mit Konkurrenz auf demselben Paar (Weg B aus
O66). B7.10 ist deshalb „Abweichung“, nur wegen der Auslastung.

### Fund 27: „Ähnlicher Erfolg“ gilt nicht mehr (B7.1, B7.2a); Gründer an SIN, SYD, HND lösen sich 1960 auf → O67

Unternehmenswert der Gründer (Median, Preise von 1960), Faktor zum Median aller: nach 20 Jahren **2,69** (Optimizer 2,69,
Flag 2,59), nach 40 Jahren **2,50** (Boutique 0,40, Expansionist 1,77); Ziel ≤ 2 (7.4). Vorher (3.9b) 1,44 / 1,66.

- **Boutique** ist dauerhaft schwach (0,4 des Medians ab 1990). Sie hat die teuerste Kabine und die wenigsten Sitze; bei
  kleinerem Markt und tieferem Preis bleibt davon weniger übrig.
- **Flag und Optimizer** sind in den ersten 20 Jahren stark (Preis Y 1,2 bzw. 1,4–1,9), weil sie allein auf ihren Paaren
  über dem Marktpreis verkaufen; Expansionist holt bis 2000 auf.
- **Frühe Auflösung:** 7 von 50 Gründern (Normal, mit Zuschuss) sind im Mai 1960 aufgelöst, 6 davon mit Drehkreuz SIN,
  einer SYD bzw. HND. Ohne Zuschuss dieselben 7. Bei der kleineren Marktgröße finden sie 1960 dort keine Strecke mit
  Gewinn, verkaufen die leeren Flugzeuge und werden aufgelöst (7.11, 7.15). Ein Spieler mit Start an diesen Drehkreuzen
  1960 hätte dasselbe Problem.
- KI-Stärke (B7.8): Easy 553 < Normal 921 < Hard 971 Mio. $ nach 40 Jahren; Reihenfolge stimmt, Normal und Hard liegen
  nahe beieinander (vorher Hard knapp unter Normal).

### Fund 28: Zuschuss bleibt an (E68), hat aber keine messbare Wirkung (B7.2)

Prüfregel 7.14 ist **nicht** erfüllt, weil „ähnlicher Erfolg“ auch ohne Zuschuss nicht gilt (Faktor 4,56 / 2,77). Die
Zahl der Auflösungen ist ohne Zuschuss gleich (7 von 50, alle im Mai 1960), Median der Jahre bis zur Auflösung je
Persönlichkeit „nie“. Der Zuschuss beträgt 2–5 Mio. $ (1960) je KI und Jahr gegen ein Ergebnis von 21–346 Mio. $. Nach
E68 bleibt `RIVAL_SUBSIDY_ENABLED = true`, bis 7.14 erfüllt ist; der Zuschuss ist aber nicht der Grund für das
Ergebnis. Das klärt O67.

### Fund 29: Typische Strecken mit gewinnbester Abflugzahl; B4.2, B5.5, B6.7, B8.2, B8.3 → umgesetzt

- Mit fester Abflugzahl 14 waren alle Langstrecken bei der kleineren Marktgröße halb leer (A330-300 FRA–JFK 46–48 %) und
  B5.5 und B8.3 fielen. Eine gut geführte Strecke wählt auch die Flugzahl: Der Bericht nimmt jetzt die gewinnbeste gerade
  Zahl bis 14 (F49). Ergebnis: B5.5 **ok** (11 von 11 mit Gewinn), Marge kurz/mittel Ø 42 %, lang Ø 27 % (B5.2,
  vorher 70 / 66 %), Auslastung beim besten Preis 86–100 %.
- B6.7 **ok**: Klassen-Forschung aus 3,3–9,1 Monatsergebnissen (Rang 5: 7,1; bei Marge 10 %: 20). `CLASS_RESEARCH`
  bleibt unverändert.
- B4.2 **ok** nach angepasstem Fall: Zwei gleiche Gesellschaften mit je einem A320ceo antworten mit 1,61 (Gewinn
  125 515 $ je Woche); mit je zwei Flugzeugen bleibt der Preis bei 0,92 über der Schwelle 0,76, aber 62 % Auslastung
  bringen Verlust (Überkapazität, nicht Unterbieten).
- B8.2 (E69): Rückgewinnung mit `RECOVERY_PRICE_SHARE` 0,25 lohnt sich 1,9- bis 2,4-fach (kleiner Markt 1,2- bis 1,7-fach),
  vorher 3,2- bis 4,0-fach. Ziel 1- bis 2,5-fach erfüllt.
- B8.3 **ok**: Charter lohnt auf jeder Strecke mit Gewinn. B8.8: Kreditlinie = 14–38 Monate fester Kosten, Zins bei voller
  Nutzung 13–87 % des Monatsergebnisses (vorher 2–28 %), weil das Ergebnis kleiner ist.

### Fund 30: Umsteiger, Optimizer-Sprünge → keine Änderung nötig

- Umsteiger (3.13, B3.13 ok): Der Wunsch-Anteil vor der Sitz-Verteilung liegt jetzt bei 10–16 % (vorher 15–34 %), also
  auch ohne Sitz-Grenze unter 25 %. `CONNECTION_APPEAL` bleibt 0,5.
- Optimizer-Sprünge (E65, B7.4): 0,6–2,7 % der Strecken-Monate mit Schritt ≥ 0,25, p90 0,08–0,12. Nicht störend; keine
  Schrittgrenze `FARE_STEP`.
- Geteilte Paare bleiben bei 0–1 % (Fund 22); Preiskampf 0,0–0,1 % der Strecken.

## Noch offene Prüfregeln

Keine Prüfregel der Abschnitte 1–8 ist mehr ohne Skript. Bericht 3.9e: keine Abweichung (20 ok · 0 Abweichung ·
28 Info); die Abweichungen aus 3.9d (B7.1, B7.2a, B7.2, B7.10) sind mit E71 behoben (Fund 31–33).

## Ergebnis Paket 3.9e (E71: Persönlichkeiten, Gründung, Zuschuss)

Umgesetzt (F50, F51): Gründung nur an Drehkreuzen mit möglicher Gewinn-Strecke (`rivalHubViable`, Spezifikation 7.7),
nie Überschall als Startflugzeug, Persönlichkeiten nachgestellt (Spezifikation 7.4, 7.7), B7.10 urteilt nur über die
Marge. Bericht mit Langläufen: `balance/3.9e-bericht.md`.

### Fund 31: Kalibrierung – LCC und Boutique scheiterten am Startflugzeug und an der Preis-Lage → umgesetzt

Hilfsrechnung in Kopien der Werte (nicht im Projekt): je Variante 10 Läufe × 40 Jahre (1960–1999), Normal, mit
Zuschuss, mit Gründungs-Regel E71. Zahlen: Unternehmenswert der Gründer (Median, Preise von 1960) ÷ Median aller;
„Faktor“ = größtes Verhältnis in beide Richtungen (Ziel ≤ 2, 7.4).

| Variante | Faktor 20 / 40 Jahre | nach 20 Jahren: Flag · LCC · Expansionist · Optimizer · Boutique | nach 40 Jahren: dieselben | Marge KI |
|---|---|---|---|---|
| Stand 3.9d + Gründungs-Regel | 2,06 / 2,67 | 1,73 · 0,58 · 1,27 · 2,06 · 0,78 | 1,44 · 1,10 · 1,78 · 0,76 · **0,37** | 21 % |
| V1: Startflugzeuge (LCC Sitze 0,05, Boutique Reichweite 0,001), Boutique Kaufneigung 0,9, 2 Drehkreuze | 2,86 / 1,93 | 1,30 · **0,35** · 0,97 · 1,42 · 1,17 | 1,20 · 0,99 · 1,93 · 0,74 · 0,79 | 22 % |
| **V2a = gewählt:** V1 + LCC Preis-Lage 0,95 | **1,36 / 1,60** | 1,01 · 0,82 · 0,74 · 1,27 · 0,92 | 1,16 · 0,96 · 1,60 · 0,81 · 0,78 | 22 % |
| V2b: V2a + LCC vorsichtiger beim Kauf (45 % der Kasse, Reserve 10 Mio. $) | 1,40 / 1,75 | 1,24 · 0,97 · 0,72 · 1,29 · 1,06 | 1,15 · 0,97 · 1,75 · 0,70 · 0,76 | 22 % |

- **Gründungs-Regel allein** beendet die frühen Auflösungen (0 statt 7 von 50), ändert den Faktor aber kaum. Die LCC
  fand in 2 von 10 Läufen an keinem der 10 Drehkreuze eine Strecke mit Gewinn: Ihr erstes Startflugzeug war eine DC-8
  (Gewicht Sitze 0,15), und mit einem Versuch je Monat (Normal) plant sie nur dieses.
- **Startflugzeuge:** Mit Sitze 0,05 (LCC) und Reichweite 0,001 (Boutique) nehmen beide 1960 meist eine Caravelle; an
  den 10 Drehkreuzen ist dann 1960 in 85–90 % der Fälle eine Strecke mit Gewinn möglich (vorher 50 %). Damit holt
  Boutique auf (0,37 → 0,79 nach 40 Jahren).
- **LCC in der Ölkrise:** In V1 schrumpft die LCC 1974–1980 von 45 auf 8 Strecken (Ergebnis je Strecke 1970 etwa die
  Hälfte der Flag). Die Preis-Lage 0,95 statt 0,90 gibt ihr genug Marge, um die Krise zu überstehen (0,35 → 0,82).
- Flag und Optimizer (stark in den ersten 20 Jahren) brauchten keine eigene Dämpfung: Mit stärkeren LCC und Boutique
  liegen sie nach 20 Jahren bei 1,0 bzw. 1,3 des Medians. Die Marge der KI bleibt im Ziel (22 %).
- Fehler gefunden (F50): Die Concorde steht in den Daten als „Narrowbody“ und wäre ab 1976 das Startflugzeug jeder
  neuen KI; im Januar 1980 (Ölkrise) ist an keinem großen Drehkreuz eine Strecke mit Gewinn möglich, sonst an 9 von 10.

### Fund 32: „Ähnlicher Erfolg“ gilt mit und ohne Zuschuss; keine Auflösung (B7.1, B7.2a, B7.2) → ok

Langläufe 10 × 60 Jahre, Normal (`balance/3.9e-bericht.md`, Abschnitt 7):

| | Faktor nach 20 / 40 Jahren | schwächste / stärkste nach 40 Jahren | aufgelöste Gründer |
|---|---|---|---|
| mit Zuschuss (B7.1) | **1,36 / 1,60** (vorher 2,69 / 2,50) | Boutique 0,78 / Expansionist 1,60 | 0 von 50 (vorher 7) |
| ohne Zuschuss (B7.2a) | **1,81 / 1,70** (vorher 4,56 / 2,77) | Boutique 0,78 / Expansionist 1,70 | 0 von 50 |

- Nach 50 und 60 Jahren (nicht Teil der Regel) liegt der Faktor bei 1,63 / 1,71 (mit) bzw. 1,59 / 1,88 (ohne
  Zuschuss); der Optimizer fällt nach 2000 auf 0,6–0,7 zurück (wenig Käufe, 2 Drehkreuze), der Expansionist steigt auf
  1,7–1,9. Das ist Stil, kein Fehler; in Phase 5.3 beobachten.
- Ohne Zuschuss ist der Optimizer in den ersten 20 Jahren am stärksten (1,73–1,81): Er verkauft allein auf seinen Paaren
  zum besten Preis (Preisniveau Y 1,4–1,9).
- Gründer, die an ihrem festen Drehkreuz keine Strecke mit Gewinn fanden, wichen auf das nächste freie aus: in jedem
  Lauf mit SIN als festem Drehkreuz (Lauf 1, 3, 5, 7, 9 → ATL) und einmal SYD (Boutique, Lauf 1 → JFK). Von SIN ist
  1960 keine Strecke mit Gewinn möglich. Schwächster Einzelfall: LCC in SYD (Lauf 7) mit 92 Mio. $ nach 60 Jahren.
- KI-Stärke (B7.8, 3 Läufe × 40 Jahre): Easy 592 < Normal 1 045 ≈ Hard 1 025 Mio. $; Normal und Hard bleiben nahe
  (Phase 5.3, wie in 3.9a vermerkt).
- Marge der KI 23 % (B7.10 **ok**), Auslastung 100 % (Info, E71). Geteilte Paare bleiben selten (1,00 Gesellschaften je
  Paar); Weg B aus O66 (mehr Konkurrenz unter der KI) bleibt offen für Phase 5.3.

### Fund 33: Zuschuss abgeschaltet (E68, B7.2) → umgesetzt

Prüfregel 7.14 ist erfüllt: Ohne Zuschuss ist der Median der Jahre bis zur Auflösung je Persönlichkeit „nie“, und
„ähnlicher Erfolg“ gilt (Fund 32). Nach E68 ist `RIVAL_SUBSIDY_ENABLED = false` (`src/model/constants.ts`). Die Zeile
„Subsidy“ bleibt im Monatsergebnis (immer 0). Das Balance-Skript rechnet „ohne Zuschuss“ nur noch, solange der Schalter
an ist; B7.1 heißt dann „Zuschuss abgeschafft“, B7.2 steht als Info im Bericht.

## Ergebnis Paket 5.3a (Balance-Bericht nach Phase 5, gesammelte 5.3-Punkte)

Bericht mit Langläufen: `balance/5.3a-bericht.md` (**18 ok · 0 Abweichung · 32 Info**; 10 Läufe × 60 Jahre Normal, je 3 × 40 Jahre
Easy und Hard, ohne Zuschuss). Abschnitte 1–6 und 8 rechnen dieselben Zahlen
wie 3.9e (Phase 4 und 5 haben das Modell der Beispiele nicht verändert); neu sind drei Info-Prüfungen (F79).

### Fund 34: Die Charter-Schätzung empfiehlt richtig, überschätzt aber den Betrag (B8.10) → O71

Flughafen-Streik (60 %) am Start-Flughafen, Monat mit gestrichenen und mit gecharterten Flügen gerechnet
(`monthOperations`), gegen die Schätzung der Frage aus dem Monat ohne Störung (`disruptionCharterEstimate`):

| Strecke | Auslastung | echter Erlösverlust ÷ Schätzung | Vorteil Charter geschätzt | echt |
|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 100 % | 100 % | 141 025 $ | 140 958 $ |
| A320ceo FRA–MAD 1990 | 86 % | 85 % | 641 643 $ | 486 402 $ |
| A330-300 FRA–JFK 1995 | 89 % | 79 % | 777 188 $ | 393 840 $ |
| 787-9 FRA–SIN 2019 | 97 % | 93 % | 876 583 $ | 685 712 $ |
| A330-300 FRA–JFK 1995 × 0,25 | 12 % | 24 % | −200 388 $ | −2 044 795 $ |

- Die Empfehlung (Charter besser oder schlechter als Streichen) stimmt in allen 14 Fällen; die Gebühr ist genau die
  gebuchte.
- Beim Streichen verteilt das Modell die Fluggäste auf die übrigen Sitze. Je mehr Sitze frei sind, desto kleiner der
  echte Verlust: Bei 86–89 % Auslastung überschätzt die Frage den Vorteil um 30–100 %.
- Preise von X statt X+1 („Offen aus 5.2e“ (2)): Der Kostenindex ändert sich je Monat um höchstens 0,1 %; der
  Treibstoff aber in 33 Krisen-Monaten um mehr als 5 % (größter Schritt +26 %, 09/1973). Dann liegt auch die Gebühr daneben.
- Beides löst Weg B von O71 (die Frage rechnet den Monat X+1 mit dem Modell).

### Fund 35: Werbung trägt sich ab 11–24 Strecken (B6.9) → Info, kein Handlungsbedarf

Kampagnen kosten mit dem Kostenindex weniger als früher (4.8 (5): 2015 national 770 882 $ statt 2 032 859 $). Eine
Kampagne hebt die Fluggäste einer A320ceo-Strecke beim festen besten Preis um 0,6 % (local), 1,3 % (national), 2,2 %
(global); das Mehr-Ergebnis deckt die Kosten ab 12 / 17 / 24 gleich großen Strecken (1990) bzw. 11 / 15 / 21 (2019).
Werbung ist damit ein Werkzeug für mittlere und große Netze, nicht für den Start. Mit Rivalen auf denselben Paaren
wirkt sie stärker (Anziehung gegen andere Angebote statt gegen „Nicht fliegen“).

### Fund 36: Kabinen-Umbau kostet 0,4–2,3 Monatsergebnisse (B8.11) → Info, kein Handlungsbedarf

Umbau auf dieselbe Kabine: A320ceo 1990 0,39 Mio. $ (Lohn 0,19), 2019 1,29 Mio. $ (Lohn 0,27); A330-300 2019
2,36 Mio. $ (Lohn 0,65); ATR 72-200 1990 0,14 Mio. $ (Lohn 0,10). Das sind 0,4 (Kurz- und Mittelstrecke) bis 2,3
(Langstrecke) Monatsergebnisse der Strecke, etwa alle 6–7 Jahre (B8.7). Der Lohn mit Kostenindex (4.6a (3)) ist
höchstens ein Drittel des Preises; spürbar, aber klein.

### Fund 37: Szenario-Ziele rechneten anders als die Anzeige (8.15) → behoben bzw. O72

- `minWeeklyFlights` („30 city pairs with daily service“, Deregulation): Der Abschluss zählte die Zahl der Strecken,
  die Anzeige tägliche Städtepaare. 30 Strecken mit beliebiger Frequenz (auch mehrere auf einem Paar) hätten gewonnen.
  Behoben (F79): `servedCityPairs` im Modell, die Anzeige ruft sie.
- „Oil Shock“ verlangte in den Daten Ruf 60, 8.15 sagt 55; mit 60 erreicht keine Ausstattung das Ziel (beste 58,1).
  Behoben (F79).
- Eigene Kassen-Untergrenze (−5 Mio. $, 0 $): Daten und Anzeige rechnen damit, der Abschluss mit −Kreditlinie → O72.

### Fund 38: Spielstart mit 12 KI ist schnell („Offen aus 5.2b“ (4)) → kein Handlungsbedarf

`foundStartRivals` (Node, je 3 Startwerte): 6 KI 0,06–0,17 s, 10 KI 0,05–0,25 s, 12 KI 0,06–0,23 s (1960 AAL und FRA,
1995 FRA, 2010 JFK); immer alle gegründet. Die ersten vier Abschlüsse mit 12 KI 0,10–0,32 s. Die etwa 3 s beim
Spielstart im Browser (5.2b) kommen also nicht aus der Gründung; was sie kostet, misst 5.3b im Browser.

### Fund 39: KI darf Widebody-Slots an Flughäfen der Größe 2 kaufen, der Spieler nicht → O73

`WIDEBODY_SLOTS_FROM_SIZE` (3) gilt nur in der Oberfläche; die KI prüft nur die Bahn. Nach der Bahn sind alle
176 Flughäfen der Größe 2 für Widebodies offen (Codes D–F), die 36 der Größe 1 nicht.

### Fund 40: Langläufe unverändert seit 3.9e; KI-Stärke Normal ≈ Hard (B7.1–B7.10, B3.13) → kein neuer Handlungsbedarf

- Die 10 Haupt-Läufe (ohne Zuschuss, E68) ergeben **dieselben Zahlen** wie die Läufe „ohne Zuschuss“ in 3.9e:
  „ähnlicher Erfolg“ Faktor 1,81 nach 20 und 1,70 nach 40 Jahren (B7.1 ok), Boutique 0,78 schwächste, Expansionist 1,70
  stärkste; nach 60 Jahren 1,88 (Expansionist), Optimizer 0,67. Phase 4 und 5 haben die Rechnung der KI also nicht
  verändert.
- Marge der KI 24 % (B7.10 ok), Auslastung 100 %, Preisniveau Y Median 1,09; geteilte Paare 1,00 je Paar, Preiskampf
  0,1 % der Strecken. Weg B aus O66 (mehr Konkurrenz unter der KI) bleibt offen; ohne geteilte Paare ist die
  Auslastung der KI kein Maß für die Marktgröße (E71).
- Optimizer-Sprünge 1,7 % der Strecken-Monate (p90 0,10, B7.4): nicht störend, keine Schrittgrenze.
- KI-Stärke (B7.8, 3 Läufe je Stärke × 40 Jahre): Easy 579 < Normal 1 003 ≈ Hard 1 010 Mio. $. Hard kauft mehr, verdient
  aber nicht mehr, weil Wachstum an Drehkreuzen und Slots endet (Fund 10). Ob Hard spürbar stärker sein soll, ist eine
  Stellschraube für 5.3c (Wert `RIVAL_STRENGTH`), keine Abweichung.
- Rechenzeit (B7.9): 734 ms je Monat in den 2010ern, 5,9 min je Lauf (3.9e: 555 ms, 4,2 min). Während der Läufe liefen
  auf demselben Rechner Tests und Berichte; der Unterschied ist darum kein sicherer Hinweis auf langsameren Code.
- Bericht: „NaN %“ in Jahrzehnten ohne Langstrecke heißt jetzt „–“ (`pct`, `src/balance/report.ts`).

## Ergebnis Paket 5.3c (O71–O73 umgesetzt, KI-Umläufe nach der Planer-Regel)

Bericht mit Langläufen: `balance/5.3c-bericht.md` (**19 ok · 1 Abweichung · 31 Info**; 10 Läufe × 60 Jahre Normal, je
3 × 40 Jahre Easy und Hard). Zum Vergleich lief derselbe Langlauf einmal nur mit E78, ohne die neuen Umläufe (nicht
abgelegt): 20 ok · 0 Abweichung · 31 Info, KI-Zahlen gleich 5.3a.

### Fund 41: Die Störungs-Frage nennt die gebuchten Beträge (B8.10, E76) → ok

`charterQuestionFigures` rechnet den Monat der Störung gestrichen und gechartert. In 14 von 14 Fällen sind
Erlösverlust, Gebühr und Vorteil gleich der getrennten Rechnung. Die alte Schätzung (Erlös im Mittel × Anteil) lag
24–100 % daneben.

### Fund 42: Die KI fliegt fast keine Widebodies und kaum Langstrecke; E78 ändert darum nichts → O76

- Mit E78 (Widebody-Slots erst ab Größe 3, B7.11 ok) sind alle KI-Zahlen gleich wie in 5.3a.
- Grund: In allen Läufen fliegen 0–3 von 150–520 KI-Strecken mit einem Widebody (Januar, je Lauf). Langstrecken
  (über 3 500 km) gibt es 0–24 je Lauf und Monat, gegen 180–250 kurze und mittlere (Tabelle „Auslastung / Marge je
  Streckenlänge“); geflogen werden sie mit Narrowbodies großer Reichweite.
- Ursache im Code: Die KI kauft den Typ mit der besten Planer-Hauptzahl **je Kaufpreis** (`pickPurchaseType`,
  `src/model/rivalMonth.ts:624`); das ist fast immer ein günstiger Narrowbody. Ziele sucht sie mit der Reichweite des
  jüngsten Flugzeugs (`referenceTypeIndex`), so kommen Langstrecken-Ziele kaum in die Vorauswahl.
- Folge: Auf Langstrecken hat der Spieler praktisch keine Konkurrenz; Widebody-Regeln der KI (Slots, Wende) wirken nicht.

### Fund 43: KI-Umläufe nach der Planer-Regel: Optimizer nach 20 Jahren zu stark (B7.1) → O77

- Neu (7.9, „Offen aus 4.4“ (2)): höchste Umläufe = Woche ÷ Umlaufzeit mit Boden- und Wendezeit (`weeklyTripCapacity`),
  ohne Nachtpause und ohne Obergrenze 21; vorher 7 × 18 h ÷ Blockzeit ohne Bodenzeit, höchstens 21.
- Nach 20 Jahren (1980) ist der Optimizer 521 Mio. $ wert, 2,56 × der Median aller (204 Mio. $; vorher 417 Mio. $,
  1,81 ×). Damit gilt „ähnlicher Erfolg“ (Faktor ≤ 2, 7.4) nach 20 Jahren nicht mehr; nach 40 Jahren 1,79 (ok), nach
  60 Jahren 1,87.
- Übrige Zahlen fast gleich: Marge 24 %, Auslastung 100 %, Median aller nach 40 Jahren 952 statt 1 003 Mio. $,
  Flugzeuge je KI in den 2010ern 89 statt 94 (mehr Umläufe je Flugzeug), Rechenzeit 626 statt 760 ms je Monat.
- Der Optimizer fliegt kurze Strecken mit vielen Umläufen; die neue Regel erlaubt dort mehr als 21 je Woche.

### Fund 44: KI-Stärke jetzt Easy < Normal < Hard (B7.8) → O74

Gründer nach 40 Jahren (je 3 Läufe Easy und Hard): Easy 619, Normal 952, Hard 1 055 Mio. $ (vorher 579 / 1 003 /
1 010). Hard liegt 11 % über Normal (vorher 1 %). Mit nur 3 Läufen je Stärke ist der Abstand unsicher.

### Fund 45: Ruf-Meilenstein Gold (80) ist mit Spieler-Ausstattung erreichbar (B6.6) → kein Handlungsbedarf

Beste Spieler-Ausstattung (alle Satisfaction-Forschung, Moral 100, VIP-Lounge, Bordküche, Hangar, Stufe 3;
`playerBestCases`): Ruf-Ziel A320ceo FRA–MAD 1990 Flag-Kabine 81,6 (mit allen Kampagnen 84,6), Boutique 77,5 (80,5);
A330-300 FRA–JFK 1995 Flag 65,1 (68,1), Boutique 58,7 (61,7). Gold geht also mit einem Netz aus gut ausgestatteten Kurz-
und Mittelstrecken, nicht mit Langstrecke. Selten, wie gewollt („Offen aus 3.9c“).

### Fund 46: Stärke der Schwierigkeit (B3.5) → O75

`DIFFICULTY_FACTOR` Hard 0,9 / Easy 1,1 (Anziehung): gegen einen gleichen Rivalen mit freien Sitzen −5,7 % / +5,2 %
Fluggäste. Beim festen Preis 1,6 × Markt mit 14 Abflügen je Gesellschaft (A320ceo FRA–MAD 1990, Normal voll): Ergebnis
Hard −17 %, Easy +5 %. Mit 0,8 / 1,2: Fluggäste −11,9 %, Ergebnis −36 % / +10 %; mit 0,7 / 1,3: −18,8 %, −57 % / +14 %
(Messung mit Hilfsskript, nicht im Projekt). Allein auf der Strecke wirkt der Faktor kaum (nur gegen „Nicht fliegen“).

### Ohne neuen Handlungsbedarf

- Bester Preis bei knappen Sitzen („Offen aus 4.5a“ (2)): A320ceo FRA–MAD 1990 allein 1,98 × Markt (B4.5); Regel 4.10
  (Knappheit wirkt über den Preis) ist gewollt.
- Weg B aus O66 (mehr Konkurrenz unter der KI): weiter 1,00 Gesellschaften je Paar (B7.3); offen, hängt mit O76
  zusammen.

## Ergebnis Paket 5.3d (E79–E82: KI-Langstrecke, Optimizer)

Umgesetzt (F81): E81 (Streckensuche vor dem Kauf mit Bezugs-Typen je Bauart, `referenceTypeIndices`; Typwahl nach
Gewinn nach Kapitalkosten, `profitAfterCapital`, `src/model/rivalMonth.ts`), E82 (Optimizer-Kaufneigung 0,7 → 0,4,
`PERSONALITIES`, `src/model/constants.ts`). E79 und E80 ändern nichts. Neue Prüfregel B7.12 (Langstrecken-Anteil der KI
ab 1990) und Spalte „mit Widebody“ in der Tabelle je Streckenlänge (`src/balance/competition.ts`).
Bericht mit Langläufen: `balance/5.3d-bericht.md` (**21 ok · 0 Abweichung · 31 Info**; 10 Läufe × 60 Jahre Normal,
je 3 × 40 Jahre Easy und Hard).

### Fund 47: Die KI fliegt Langstrecke, aber fast nur mit Narrowbodies (B7.12, E81) → ok, beobachten

- Langstrecken-Anteil der KI ab 1990: **15,3 %** der Strecken-Monate (Ziel aus O76: deutlich über 5 %). Langstrecken je
  Lauf und Monat: 1990er 77, 2000er 64, 2010er 61 (5.3c: 22, 12, 12).
- Strecken mit Widebody bleiben selten: im Januar 0–1 je Lauf (B7.11, im Mittel 0,3). Die Langstrecken fliegen
  Narrowbodies großer Reichweite. Vermutung (nicht einzeln gemessen): Auf den gefundenen Strecken bringt ein
  Narrowbody großer Reichweite nach Zinsen mehr als ein Widebody, weil die KI ihre Paare allein fliegt und die Flugzahl
  so wählt, dass die Maschine voll ist. Folge: Der Spieler hat auf Langstrecke jetzt Konkurrenz, auf Widebody-Strecken großer
  Flughäfen weiter selten. Kein Fehler; im Spieltest (5.3b) ansehen.
- Marge der Langstrecken der KI in den 1970ern −7 % (Ölkrisen, 4 Strecken je Lauf), danach 16–37 %.

### Fund 48: Optimizer gedämpft, „ähnlicher Erfolg“ wieder erfüllt (B7.1, E82) → ok

Hilfsläufe in Kopien der Werte (10 Läufe, nicht im Projekt), Faktor des Optimizers nach 20 Jahren (mit E81):

| Variante | Optimizer nach 20 Jahren | Faktor 20 / 40 Jahre |
|---|---|---|
| nur E81 (Kaufneigung 0,7) | 2,67 | 2,67 / – |
| Reserve 30 statt 10 Mio. $ | 2,73 | 2,73 / – |
| Preis ≤ 30 % statt 45 % der Kasse | 2,63 | 2,63 / – |
| Kaufneigung 0,5 | 2,09 | 2,09 / 1,98 |
| Kaufneigung 0,5, 3 Drehkreuze | 2,09 | 2,09 / 1,98 |
| Kaufneigung 0,5, Wachstumsstopp ab 0,35 | 2,09 | 2,09 / 1,90 |
| **Kaufneigung 0,4 = gewählt** | **1,46** | **1,69 / 1,88** |

Reserve und Kassen-Anteil binden nur kurz (die Kasse des Optimizers wächst schnell); die Kaufneigung wirkt. Im
Langlauf: Faktor **1,69 nach 20, 1,88 nach 40 Jahren** (B7.1 ok); nach 50 / 60 Jahren 1,86 / 1,79. Stärkste nach
40 Jahren ist jetzt Flag (1,88, nahe an der Grenze), schwächste Boutique (0,76). Der Optimizer liegt nach 40 und
60 Jahren bei 0,95 bzw. 1,00 (5.3c: 0,81 bzw. 0,71): Er fällt im späten Spiel nicht mehr zurück.

### Fund 49: Die KI ist insgesamt deutlich stärker (B7.8, B7.3) → Info, Spieltest

- Median des Unternehmenswerts aller Gründer nach 40 Jahren **1 605 Mio. $** (5.3c: 952), nach 60 Jahren 2 590
  (5.3c: 1 430). Erlös je KI in den 1990ern 1 092 statt 688 Mio. $, Flugzeuge je KI in den 2010ern 106 statt 89.
  Grund: Mit den zusätzlichen Bezugs-Typen findet die KI mehr Strecken mit Gewinn, auch lange.
- Marge 24 % (B7.10 ok), Preisniveau Y Median 1,05, 1,01 Gesellschaften je Paar: Die KI teilt Paare weiter fast nie.
- KI-Stärke (E79, 3 Läufe je Stärke): Easy 741 < Normal 1 605 < Hard 1 721 Mio. $; Hard 7 % über Normal (5.3c: 11 %).
  Ob sich das im Spiel richtig anfühlt, prüft 5.3b.

### Fund 50: Rechenzeit der KI steigt um gut die Hälfte (B7.9) → Info, Spieltest

1 091 ms je Monat in den 2010ern (5.3c: 626), 5,6 min je Lauf (5.3c: 3,9). Je KI-Strecke 2,1 statt 1,4 ms: Vor einem
Kauf plant die KI jetzt bis zu dreimal (je Bezugs-Typ). Gemessen mit 4 Läufen gleichzeitig. Ob der Monatsabschluss im
Browser spürbar langsamer wird, prüft 5.3b.

## Ergebnis Paket 5.3b (Spieltest im Browser)

Bericht: `balance/5.3b-spieltest.md` (Produktions-Build in Chromium über Playwright; Langläufe im Browser 6 KI Normal
1960–2015 und 6 KI Hard 1960–1990, Free Mode ohne eigene Strecken). Behoben mit F82; neue Fragen O78, O79.

### Fund 51: Spielstand größer als der Browser-Speicher → behoben (F82)

Ab 1967 (6 KI Normal) scheiterte jede Autosicherung mit „Saving failed: the browser storage is full or blocked“.
Spielstand 1970: 5,1 Mio. Zeichen, davon 4,96 Mio. die KI, fast alles Monatsberichte: Jeder Bericht trug die Zahlen aller
Strecken (rund 1 KB je Strecke), 120 Berichte je KI. Behoben: Strecken-Zahlen nur im neuesten Bericht (`keptReports`),
KI behält 12 Berichte (`RIVAL_REPORT_MONTHS`). Danach 6 KI Normal: 1,5 Mio. (1970) … 3,0 Mio. Zeichen (2015, noch mit
120 Berichten je KI), keine Fehlermeldung mehr. Mit 12 KI (Node, nur KI-Teil, beide Teile von F82) 2015
3,1 Mio. Zeichen; mit Ansicht und Spieler grob 3,7–4,2 Mio., unter der Grenze von etwa 5,2 Mio., aber knapp. Spielstände in der Cloud (Supabase) waren nicht im Test.

### Fund 52: Jahresziel: Angebot blieb offen, Texte falsch → behoben (F82); hohes Ziel ohne Mehr-Prämie → O78

Das Dezember-Angebot blieb das ganze Jahr wählbar (das Modell löschte es nie); der Spieler konnte im Dezember das schon
erreichte Ziel nehmen. Jetzt endet es mit dem Januar-Abschluss (6.11). Texte: „three goals“ bei zwei, „A harder goal pays
more“ bei gleicher Prämie, falscher Menü-Pfad. Bleibt als Regel-Frage: Solange die Bezugsgröße unter 5 Mio. $ von 1960
liegt, zahlen alle Ziele die Mindest-Prämie (250 000 $ von 1960) und dieselbe Strafe; das hohe Ziel lohnt sich nie
(Beispiel 1961: Steady 2,2 Mio. $ und Stretch 2,7 Mio. $ Gewinn, beide $253K / $126K) → O78.

### Fund 53: Rechenzeit im Browser → Info, kein Handlungsbedarf

Spielstart 0,15–0,34 s (6 und 12 KI, 1960 und 2010; die „3 s“ aus 5.2b sind nicht nachzustellen). Monatsabschluss mit
6 KI Normal: 0,13 s (1960) → 0,44 s (1989) → 0,58 s (1999) → 0,67–0,87 s (2004–2014), Spitze 1,26 s. Hard (größere KI)
1989 1,56 s. Eine Änderung an Kasse oder Flotte rechnet den ganzen Monat neu (`plannerModel`): längste Aufgabe 0,23 s
(2000), Ansichtswechsel nie über 50 ms. Mit 12 KI ohne Oberfläche 1990 1,3 s, 2000–2010 2,3–2,5 s, 2015 4,5 s je
Abschluss: Mit vielen KI wird das Warten im späten Spiel deutlich (Fund 50).

### Fund 54: KI-Stärke und Langstrecke im Spiel → Info; Widebodies → O79

- Hard gegen Normal (je ein Lauf, eigener Zufall): Kasse aller KI 1970 438 gegen 193, 1990 4 668 gegen 1 433 Mio. $
  (× 3,3). Hard ist in der Konkurrenz-Ansicht klar stärker; der Langlauf (5.3d, Mittel über Läufe) sah nur + 7 % nach 40
  Jahren. E79 bleibt; ein Urteil „zu stark für einen Menschen“ braucht einen Spieler mit Strecken.
- Langstrecke (über 3 500 km): Normal 2010 48 von 508 KI-Strecken (9,4 %), 2015 53 von 605 (8,8 %), Hard 1990 62 von 496
  (12,5 %). Konkurrenz auf Langstrecke gibt es also (z. B. Kuwait Airways mit Drehkreuzen KWI, SFO, DEN).
- **Keine KI besaß je einen Widebody** (0 von 496–605 Flugzeugen). Die Langstrecken fliegen Narrowbodies großer
  Reichweite. Widebody-Strecken großer Flughäfen bleiben ohne Konkurrenz → O79 („Offen aus 5.3d“ (1)).

### Fund 55: Kleinkram aus dem Spieltest

- Rang-Ansicht vor dem dritten Abschluss: Zahlen wirken falsch („Reputation 0 / 30“ bei Ruf 50). Hinweis eingebaut (F82).
- „Oil Shock“: „(now $0)“ hinter einer Schwelle von 0 $ entfernt (F82).
- Frequent flyer und Kampagne 2015: Vorschau, Buchung und Kasse stimmen auf den Dollar (Bericht Abschnitt 4).
- Ortsnamen in den Flughafen-Daten sind teils deutsch („München“, „Kairo“, „Mexiko-Stadt“, „Wien“, „Genf“;
  `src/data/airportsRows.ts`) und erscheinen so in Zeitung und Planer; Oberflächentexte sind sonst englisch. Kein Teil des
  Rechenmodells; als Datenpflege außerhalb des Neubaus vormerken.
- Nicht geprüft (braucht eigene Strecken): Störungs-Frage im Browser, Deregulation-Zähler mit echten täglichen Strecken.

## Ergebnis Paket 5.3e (E83 Jahresziel, E84 Widebody der KI)

Umgesetzt (F83): E83 (gestaffelte Mindest-Prämie, `goalMinReward`, `src/model/progress.ts`). Gemessen nach E84:
neuer Abschnitt im Balance-Skript `src/balance/widebody.ts` (Prüfregeln B7.13, B7.14; läuft ohne `--long`), dazu vier
Hilfsläufe mit vorübergehenden Protokoll-Zeilen in der Kauf-Kette der KI (nicht im Projekt). Bericht:
`balance/5.3e-bericht.md` (**16 ok · 0 Abweichung · 25 Info**, ohne Langläufe; KI-Regeln unverändert, die Langläufe
gleichen 5.3d).

### Fund 56: Hohes Jahresziel zahlt jetzt immer mehr (B6.8, E83) → ok

Die Mindest-Prämie ist je Art gestaffelt (250 000 / 375 000 / 625 000 $ von 1960). Sie bindet für alle Arten bei
derselben Bezugsgröße (unter 12,5 Mio. $ von 1960); das hohe Ziel zahlt dann wie sonst das 2,5-Fache des sicheren und
lohnt ab einer Chance von 60 % (in allen 6 Beispielen von B6.8; vorher bei Mindest-Prämie „nie“). Beispiel aus Fund 52
(1961, Bezugsgröße Mindestwert): sicher $253K Prämie / $126K Strafe, hoch $632K / $316K. Der Satz „This year each pays
the same minimum bonus …“ im Ziel-Angebot entfällt (`goalOfferLines`).

### Fund 57: Warum die KI keinen Widebody kauft (B7.13, B7.14, E84) → O80 → E85 (so lassen)

1. **Größte Langstrecken-Paare** (je Jahr die 20 größten über 3 500 km zwischen Flughäfen ab Größe 3; 1990, 2000, 2010;
   Flag-Ausstattung, Rechnung der KI vor dem Kauf): Der beste Widebody liegt auf **0 von 60** Paaren vorn, und zwar
   schon **vor** den Kapitalkosten (Planer-Zahl), nicht erst danach. Beispiel 2000 LHR–JFK: 737-700, 10 Umläufe,
   1,20 Mio. $ je Monat (nach Zins 0,81); bester Widebody IL-96-300, 6 Umläufe, 0,80 (nach Zins 0,20). Auch mit freier
   Wahl jeder Flugzahl (statt 100 / 60 / 30 %) bleibt der Narrowbody vorn (Hilfsrechnung). Ein niedrigerer Zins
   (O79 Weg B) ändert daran nichts.
2. **Ursache: kein Größen-Vorteil je Sitz.** Kosten je Sitz und Woche, LHR–JFK 2000 (Tabelle im Bericht):
   Treibstoff je Sitz ist gleich (737-700 159 $, A330-300 159 $; er hängt nur an der Effizienz des Typs, 5.3);
   Besatzung + Landung je Sitz sind beim Widebody kleiner (43 gegen 78 $); der Flugzeug-Anteil je Sitz ist gleich, wenn
   beide alle Umläufe fliegen (31 gegen 35 $). Der größte Markt (rund 3 200 Fluggäste je Woche bei 10 Umläufen) füllt
   einen A330 aber nur bei der Hälfte der Umläufe; dann trägt jeder Sitz den doppelten Flugzeug-Anteil (61 $), und
   feste Kosten je Sitz sind fast gleich (265 gegen 261–275 $). Mit weniger Abflügen gewinnt der Narrowbody zudem etwas
   mehr Fluggäste je Sitz (A321ceo 10 Umläufe 2 828 gegen A330-300 5 Umläufe 2 735 bei gleich vielen Sitzen). Ein
   Widebody auf zwei Strecken (je halbe Umläufe, nur der Spieler kann das) bringt vor Zins so viel wie zwei 737-700
   (2,08–2,19 gegen 2,13 Mio. $ je Monat, LHR–JFK + LHR–BOS 2000, Hilfsrechnung), nach Zins weniger.
3. **Jenseits der Narrowbody-Reichweite** (Paare über 7 500 km): Widebody vorn auf 11 von 30 Paaren, alle mit Gewinn
   nach Zins (2000: alle 10, IL-96-300, 0,30–0,80 Mio. $ je Monat; 1990 nur HND–JFK, sonst die IL-62M mit großer
   Reichweite und 22 Mio. $ Kaufpreis). 2010 fliegt auf diesen Paaren nichts mit Gewinn nach Zins (737-700ER −0,1,
   Widebody −0,6 Mio. $).
4. **Kauf-Kette im Langlauf** (4 Läufe Normal, 1960–2009, 3 599 Kaufrunden mit gefundener Strecke): Ein Widebody passte
   (Reichweite, Piste, Slots) in 1 958 Runden; besser nach Zins war er in **9**, alle 1993–1997 auf 9 600–13 200 km
   (IL-96-300, MD-11ER). Alle 9 wurden gekauft; **kein** Widebody-Kauf scheiterte an Kasse oder Reserve (gesperrt
   wurden nur Narrowbodies und Regionalflugzeuge: 457 × Kassen-Anteil, 212 × Reserve). Median Widebody − Narrowbody nach
   Zins je Runde −0,8 bis −1,2 Mio. $ je Monat. Die Planung mit dem Widebody als Bezug (E81) ergab nur in 227 Runden einen
   Plan mit Gewinn und gewann 8-mal.

Folgerung: Die KI rechnet richtig; der Widebody ist im Modell nur dort besser, wo kein Narrowbody die Reichweite hat.
Dasselbe gilt für den Spieler (gleiche Kosten-Rechnung, R1). Ob Widebodies wirtschaftlich attraktiver werden sollen, ist
eine Frage des Spielmodells (Kosten 5.3, Satisfaction), nicht der KI → O80.

Entschieden (E85, O80 = A, 27.11.2026): so lassen. Kein Größen-Vorteil im Treibstoff, kein Komfort-Abzug; B7.13 und
B7.14 bleiben Info-Prüfungen.

## Ergebnis Paket 5.3g (Spieltest mit eigenen Strecken)

Bericht: `balance/5.3g-spieltest.md` (Produktions-Build in Chromium über Playwright; Szenario „Deregulation“ mit vier im
Planer angelegten Strecken, „Oil Shock“; Störung und Untergrenze über geänderten Startwert bzw. geänderte Kasse im
Spielstand ausgelöst). Behoben mit F84 (nur Texte).

### Fund 58: Deregulation-Zähler zählt Städtepaare richtig → ok

Täglich JFK–BOS zählt (1), JFK–ORD mit 4 + 3 Umläufen auf zwei Flugzeugen zählt als ein Paar (2), JFK–IAD mit 6 Umläufen
nicht. Anzeige und Abschluss gleich (`servedCityPairs`), nach drei Abschlüssen weiter 2.

### Fund 59: Störungs-Frage = Buchung auf den Dollar → ok; zwei Texte behoben (F84)

Flughafen-Streik JFK (4 Strecken, 104 Flüge) und Defekt N-ACAA (1 Strecke, 30 Flüge): Flüge, Gebühr (1,5 × eigene
Flugkosten), Kosten je Fluggast und Vorteil stimmen. Beide Antworten aus demselben Spielstand gespielt: Erlös-Unterschied
843 367 $, Gebühr 1 172 922 $, Ergebnis-Unterschied −481 722 $, genau die Beträge der Frage (E76, R2). Ruf nach Streichen
49 → 42, mit Charter 49. Behoben: (1) „No cost“ neben der Charter-Antwort (die Gebühr kommt mit dem Monat), jetzt „Fee
about $… at month-end“ bzw. „No fee“; (2) doppelte Strecken-Namen in Zeitung und Posteingang („JFK-ORD, JFK-ORD“).

### Fund 60: Szenario-Untergrenze im Spiel → ok; Text bei einem Monat behoben (F84)

Deregulation: Warnung „Capital is below -$27.3M now …“ vor dem Abschluss, „Bankruptcy watch … 1 / 2 month-ends“, Ende
nach dem dritten; die Schwelle folgt der Kreditlinie (−27,2 / −27,1 Mio. $). „Oil Shock“: Warnung und Ende nach einem
Abschluss. „1 month-end in a row“ hieß jetzt „A single month-end below it ends the scenario.“ bzw. „Cash below $0 at a
month-end.“

### Fund 61: Planer im Skript bedienbar; offen bleibt nur das Spielgefühl → Info

5.3b scheiterte am gesperrten Ziel („Unlock T1“) und an fehlenden Slots, nicht am Planer; der Ablauf steht im Bericht.
Abschluss mit 8 KI 1978 und vier Strecken 0,17–0,25 s. Ob die KI (Normal, Hard) einem Menschen zu stark oder zu schwach
ist, kann kein Skript beurteilen.

## Pakete 5.4a–5.4d: Schwierigkeit (27.11.2026)

Bericht: `balance/5.4-spieltest.md` (Spieltest-Matrix 141 Spiele und Planer-Probe nach E87, E89, E93, E97).

### Fund 62: Stufen rechnen verschieden; Easy-Ziel erreicht → ok

Mit dem Kosten-Faktor (E87) unterscheiden sich die Stufen auch bei vollen Flugzeugen (ATR 72 FRA 1995: 22 500 /
14 400 / 9 000 $/Woche). Mit passendem Flugzeug verdienen auf Easy 17–20 von 20 beliebten Zielen (E88). Hard bringt
37–46 % des Easy-Ergebnisses guter Strategien im Free Mode (E94: 40–50 %).

### Fund 63: Bester Preis näher am Markt → ok

Normal: Preisniveau 0,94–1,31 (Commuter 1,40), vorher 1,08–2,0; Vorteil gegen den Marktpreis 1,3- bis 3,3-fach statt
2- bis 6-fach. Gute Strategien verdienen 49–70 % weniger als vorher; optimierer 1995 125 Strecken, 2,0 Mrd. $ (E96 ok).
Ruf mit bestem Preis 45 statt 30–35 (E95 ok).

### Fund 64: „ryanair“ trägt weiter nicht → Frage O92

1995 Normal ±0 Mio. $ · 9 Strecken gegen „vorsichtig“ +63 · 57; die ersten vier Jahre gleichauf, danach Verluste mit
festem Preis 0,85 und mehr KI-Strecken. Nach E92 wird ein Kostenvorteil der LCC-Kabine eine Frage.

### Fund 65: „standard“ geht auf Hard nicht pleite; „wucher“ verdient 1995 mit kleinen Flugzeugen → Fragen O93, O94

standard Hard: −5,7 (1995) / −5,1 (1970) Mio. $ im letzten Jahr, tiefste Kasse −5,4 / −9,6, aber nie drei Monate unter
der Kreditlinie. schlecht-wucher 1995: +87 / +49 / +18 (vorher +7), weil die günstigeren Commuter (E89) zu 1,6 × Markt
auf großen Märkten voll werden; 1970 jetzt Verlust auf allen Stufen.

### Fund 66: Preis-Duell mit springenden Preisen in kleinen Klassen → Info, Balance-Langlauf 5.4e

`priceDuel` (FRA–MAD, A320, 14 Umläufe): Economy fest 1,43 × Markt, Premium springt 0,77 ↔ 1,16. Mit 28 Umläufen springt
auch Economy 0,76 ↔ 0,95 unter die Gewinnschwelle. Test prüft nur noch Economy (F86).

## Paket 5.4e: Balance-Langlauf nach der Schwierigkeit (27.11.2026)

Bericht: `balance/5.4e-bericht.md` (**18 ok · 3 Abweichung · 33 Info**; 10 Läufe × 60 Jahre Normal, je 3 × 40 Jahre
Easy und Hard; Auswertung und Hilfsläufe oben im Bericht). Vergleich mit `5.3d-bericht.md`. Keine Konstante geändert.

### Fund 67: Optimizer nach 20 Jahren zu schwach (B7.1) → Frage O95

Faktor 2,31 nach 20 Jahren (Grenze 2), 1,70 nach 40. Der Optimizer liegt nach 10 / 20 / 40 Jahren bei 0,64 / 0,43 /
0,84 × Median (5.3d: 1,31 / 1,46 / 0,95). Grund: Er setzt als einziger den besten Preis, und der liegt nach E97 näher
am Markt (Preisniveau Y 1970er 1,45 statt 1,71). Hilfsläufe (10 × 40 Jahre, Kopie): Kaufneigung 0,5 → Faktor 2,09 /
1,73; **0,6 → 1,77 / 1,75 (ok)**, Marge der KI 22 %, Langstrecke 15,2 %.

### Fund 68: Klassen-Forschung braucht 13–17 Monatsergebnisse (B6.7) → Frage O96

Rang 1 / 2 / 4 / 5: 13,1 / 16,7 / 5,8 / 13,0 Monatsergebnisse (5.3d: 8,3 / 9,1 / 3,3 / 7,1; Regel 6.8: höchstens 12).
Das Ergebnis je Fluggast beim besten Preis fiel um 37–46 % (gewollt nach E90/E97), die Preise der Forschung blieben.
Preise × 0,7 brächten 9,2 / 11,7 / 4,1 / 9,1.

### Fund 69: Preis-Duell bei Überkapazität kurz unter der Gewinnschwelle (B4.2) → Frage O97

Zwei gleiche Gesellschaften, A320ceo FRA–MAD 1990, abwechselnd bester Preis: mit 14 Abflügen fest bei 1,43 in Economy
(Schwelle 0,87, Gewinn 68 681 $ je Woche); mit 28 Abflügen Zyklus 0,71 ↔ 0,95, tiefster Preis 0,71 unter der
Schwelle 0,76 (5.3d: fest 0,92). Im Langlauf kommt der Fall nicht vor (1,00 Gesellschaften je Paar, Preiskampf
0,1 %); möglich nur zwischen Spieler und Optimizer, der ohne Preiskampf keinen Boden über `FARE_RATIO_MIN` hat
(`rivalPriceFloor`, `src/model/rivals.ts:362`).

### Fund 70: Werbung halb so wirksam (B6.9) → Frage O98

Eine Kampagne trägt sich erst ab 24–79 gleich großen Strecken (5.3d: 11–24). Mehr Fluggäste mit Kampagne 1,003–1,011
statt 1,006–1,024; der Mehr-Gewinn je Fluggast ist zudem kleiner. Halbe Kosten brächten etwa 12–40 Strecken.

### Fund 71: KI-Stärke, Preiskämpfe, Rest → ok, Info

- KI-Stärke (B7.8): Median Easy 572 · Normal 1 548 · Hard 1 430 Mio. $. Mit denselben Läufen 0–2 liegt die Summe der
  Gründer auf Hard in allen drei Läufen über Normal (im Mittel +8 %, 5.3d +7 %); Easy ≈ 38 % von Normal. Kein
  Handlungsbedarf (E79).
- Preiskämpfe der KI fast nie (0,1 %), Optimizer-Sprünge 0,9 % der Strecken-Monate (5.3d 1,5 %). Fund 66 zeigt sich im
  Langlauf nicht.
- Marge der KI 23 % (B7.10 ok), Langstrecke 11,7 % (B7.12 ok), Widebody-Strecken je Lauf ab 1990 1,3 (5.3d 0,5).
- Marge beim besten Preis lang 23 % / kurz-mittel 32 % (5.3d 27 / 42 %), gewollt (E90, E97).
- Rückgewinnung (B8.2): Pandemie mit Marktgröße × 0,25 bringt 0,71 × den Preis zurück (Info).
- Rechenzeit 1 009 ms je Monat in den 2010ern (5.3d 1 091).

## Paket 5.4f: Kürzere Wende der LCC-Kabine (27.11.2026)

Bericht: `balance/5.4f-spieltest.md`. `QUICK_TURN_FACTOR` = 0,5 (E98). Gemessen: ryanair, ryanair-gross, neue
Strategien ryanair-pack und vorsichtig-pack (Option `pack`: mehrere Strecken je Flugzeug), Zusatzlauf LCC-Kabine +
bester Preis + pack; je 2 Startwerte, 1995 und 1970.

### Fund 72: Die Wende ist nicht der Engpass; der Hebel ist ein Flugzeug für mehrere Strecken → Frage O99

Ein Flugzeug auf einer Strecke fliegt 7–14 Umläufe je Woche und steht den Rest der Zeit; mehr Umläufe bringen weniger
zusätzliche Fluggäste, als sie kosten (737-300 FRA 1995, LCC, 0,85: 14 Umläufe +24 447 $/Woche, 21 Umläufe −50 475).
Darum ändert E98 „ryanair“ kaum (1995 Normal −3,2 · 7 Strecken; vorher ±0 · 9). Mit `pack` teilen sich 2–2,3 Strecken
ein Flugzeug und seine Kosten (`aircraftShare`, 5.9): ryanair-pack 1995 Normal +47 · 65, Faktor 0,5 gegen 1 innerhalb
der Streuung (Easy +16 %, Normal −4 %, Hard +18 %). LCC-Kabine + bester Preis + pack: +444 / +238 / +139 Mio. $
(Easy / Normal / Hard) gegen vorsichtig-pack +364 / +226 / +115. Die LCC-Kabine trägt also; klein bleibt nur der feste
Preis 0,85. 1970 trägt keine LCC (nur Commuter, Ölkrise).

### Fund 73: Planer ohne Prognose bei geteiltem Flugzeug (Fehler, behoben)

Flog das gewählte Flugzeug schon eine Strecke auf einem anderen Paar, brach `plannerRouteFigures` ab
(`operationsCore`, Schleife „freie Sitze“, `src/model/monthClose.ts`); Planer und Streckenansicht zeigten keine
Prognose (Warnung im Log). Die KI war nicht betroffen (sonst wären Langläufe abgebrochen). Behoben in F87.

