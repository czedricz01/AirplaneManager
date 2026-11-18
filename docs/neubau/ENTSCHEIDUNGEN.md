# Entscheidungen

Hier steht, was festgelegt ist und was noch zu entscheiden ist.
Claude schlägt vor, der Mensch entscheidet.

## Getroffen

| Nr. | Datum | Entscheidung | Begründung |
|---|---|---|---|
| E1 | 17.11.2026 | Kein kompletter Neuanfang. Neu gebaut wird nur das Rechenmodell; Oberfläche, Daten und Technik bleiben. | Technik ist stabil (502 Tests, strenger Typmodus); die Widersprüche liegen im Modell. |
| E2 | 17.11.2026 | Erst Spezifikation, dann Code. | Ohne festgelegte Bedeutung jeder Größe entstehen die Widersprüche neu. |
| E3 | (früher, `ANALYSE.md:34`) | Oberflächentexte im Spiel einheitlich Englisch. | – |
| E4 | 18.11.2026 | **Schwierigkeit (O6):** Normal = Faktor 1 überall. Für den Spieler wirkt die Schwierigkeit nur auf die Nachfrage (Marktgröße). Preis und Treibstoff ohne Schwierigkeit. KI-Wirtschaft immer neutral; KI-Stärke nur über Verhalten (Startkasse, Suche, Kaufneigung). Easy-KI mit 2,25-fachen Preisen entfällt. | Eine Stelle ist verständlich; „Normal“ wird neutral; Hard-KI nicht mehr wirtschaftlich schwächer (1.2 W6, W7; 1.3 W10; 1.4 W9; 1.5 W13; 1.6 W3). |
| E5 | 18.11.2026 | **Monatslänge (O7):** Eine Konstante 365,25 / 12 / 7 ≈ 4,35 Wochen je Monat, überall. | Heute 48 Wochen (Erlös, Strecken-Kosten) gegen 52 Wochen (Unterhalt) im Jahr (1.3 W6; 1.4 W15). |
| E6 | 18.11.2026 | **Geldwert (O8):** Ein Kostenindex für alle Dollar-Beträge, auch Einmalpreise, Belohnungen und Forschung. Beträge, deren Nutzen mit der Airline wächst (Krisen-Antworten), zusätzlich als Anteil der Größe (z. B. der Treibstoff-Rechnung). | Feste Beträge von 1960 werden über 60 Jahre bedeutungslos (1.4 W8; 1.5 W9; 1.6 W5; 1.7 W3, W8; 1.8 W3, W4). |
| E7 | 18.11.2026 | **Zeitregeln und Marge (O5):** Grundpreise wachsen mit demselben Kostenindex wie Löhne und Gebühren; die Marge eines Jahres bestimmt vor allem der Treibstoff. Eine Wachstumsregel für die Nachfrage, Zielwert × 2,5 (1960 → 2019) als Konstante. Ziel: Eine gut geführte Strecke jeder Länge kann in jedem Jahrzehnt Gewinn bringen. Zahlen aus dem Balance-Skript (3.9). | Heute verliert Langstrecke fast immer, 2020 lohnt kaum eine Strecke; zwei Nachfrage-Bremsen hintereinander (1.2 W8; 1.3 W7; 1.4 W1, W2). |
| E8 | 18.11.2026 | **Treibstoff (O9):** Die Tabelle ist der echte Preis mit Krisen. Ereignisse ändern den Treibstoffpreis nicht mehr (nur Nachfrage und Krisen-Antworten). Nach 2030 gilt der letzte Tabellenwert. | Ölkrisen heute doppelt gezählt; Preissturz auf 1,05 $ nach 2030 (1.4 W3, W4; 1.7 W14). |
| E9 | 18.11.2026 | **Namen (O4):** *Type appeal*, *Cabin rating* (0–100), *Service points*, *Satisfaction* (je Klasse), *Route satisfaction*; *Established route bonus*, *Frequent flyer*; *Passenger share*, *Departure share*. „SAT“, „Loyalty“ und „Market share“ als Sammelnamen entfallen. | Ein Name für mehrere Größen mit verschiedenen Skalen (1.1 W13; 1.2 W12). |
| E10 | 18.11.2026 | **Strecken-Zufriedenheit (O3):** Klassen überall nach Fluggästen gewichten, nicht nach Sitzen. | Anzeige und Ruf rechnen heute verschieden; zählen soll, was die Gäste erlebt haben. |
| E11 | 18.11.2026 | **Startwerte (O10):** Teil der Spezifikation, als Konstanten im Modell. Startkapital-Stufen bleiben als Einstellung beim neuen Spiel. Start-Ruf siehe O1 (Block D). | Startwerte prägen die Balance; nur das Startkapital ist bewusst wählbar (1.8 W8). |
| E12 | 18.11.2026 | **Bauregeln (O11):** R1–R16 als Ganzes bestätigt (Liste unten). | Funde mit klarer Lösung ohne eigene Entscheidung. |
| E13 | 18.11.2026 | **Markt-Modell (O12):** Ein Markt-Modell je Städtepaar. Marktgröße aus Städten, Entfernung, Jahr, Saison. Jedes Angebot hat eine Anziehung aus Preis (gemessen am Marktpreis), SAT, Abflügen und Flugzeit (E20). „Nicht fliegen“ ist ein eigener Mitbewerber; die Fluggäste verteilen sich nach Anziehung. Preis wirkt mit und ohne Rivalen gleich. SAT wirkt im Markt nur über die Anziehung, über den Ruf langsam auf alle Strecken. | Heute wirkt SAT dreifach und der Preis mit Rivalen doppelt an zwei Bezugspreisen (1.1 W8; 1.2 W4; 1.3 Bezug 1.2 W4). |
| E14 | 18.11.2026 | **SAT-Skala (O13):** 0–160; 100 = „wie erwartet“, 160 = Spitze. Markt und Ruf nutzen die ganze Skala. | Heute Kappe 160, Ruf bis 130, Faktor bis über 200 (1.1 W7; 1.3 W11). |
| E15 | 18.11.2026 | **SAT unter 100 (O14):** Flachere Kurve, Richtung SAT 50 ≈ 75 % des Preises. Genaue Kurve und Abzüge aus dem Balance-Skript (3.9). | Heute SAT 50 = halber Preis; 4 $ Getränke heben den fairen Preis um 13 $ (1.1 W9). |
| E16 | 18.11.2026 | **Mehrgang-Menü (O15):** Summe mit abnehmendem Nutzen: bestes Gericht voll, jedes weitere anteilig. Mehr bieten bringt immer etwas. | Heute Mittelwert: Wagyu 60, Wagyu + Butterkeks 34,9 (1.1 W1; 1.4 W14). |
| E17 | 18.11.2026 | **Zwei Flughäfen (O16):** Alle Bodenteile (Schalter, Stellplätze, Lounge, Überlast) als Mittelwert beider Enden; das Bodengewicht (Langstrecke weniger) gilt für alle, auch Überlast. | Heute teils Mittelwert, teils Summe; Überlast auf Langstrecke voll (1.1 W3). |
| E18 | 18.11.2026 | **Check-in-Schalter (O17):** Ein Schalter am Abflughafen ist Pflicht; der Planer verlangt ihn beim Anlegen der Strecke. Der SAT-Abzug für fehlende Schalter entfällt. | Heute bis −18 SAT je Klasse, größter Einzelposten auf Kurzstrecke (1.1 W14). |
| E19 | 18.11.2026 | **Forschung „Plane type satisfaction“ (O18):** Wirkung direkt als SAT-Punkte (wie „Cabin design studio“); Text aus der Konstante. | Heute +0,2 bis +0,4 SAT, durch Runden oft 0 (1.1 W12; 1.5 W12). |
| E20 | 18.11.2026 | **Geschwindigkeit (O19):** Marktgröße mit fester Bezugsgeschwindigkeit, nur aus der Entfernung. Kürzere Flugzeit gibt einem Angebot einen **spürbaren** Vorteil in der Anziehung (E13), stärker als „klein“; Stärke aus dem Balance-Skript (3.9). *Abweichung von der Empfehlung: mehr Einfluss der Geschwindigkeit.* | Heute macht ein langsames Flugzeug den ganzen Markt kleiner (1.2 W1). |
| E21 | 18.11.2026 | **Klassen-Aufteilung (O20):** Je Klasse ein einfacher Anteil, der mit Flugzeit und Geschäftsanteil spürbar wächst. Richtung: Tourismus-geprägte Paare mehr Economy, Geschäfts-geprägte Paare mehr Business und First. Werte aus dem Balance-Skript (3.9). *Ergänzung zur Empfehlung: Richtung ausdrücklich festgelegt.* | Heute Premium bei 92 % der Paare genau 9 % (1.2 W5). |
| E22 | 18.11.2026 | **Flugzeit-Kurve (O21):** Kurve sinkt bis zur längsten Strecke weiter, flacher als heute. Verhältnis aus dem Balance-Skript (3.9). | Heute ab ca. 12,6 h jede Langstrecke gleich; kurz/lang Faktor 6,9 (1.2 W13). |
| E23 | 18.11.2026 | **Klassen-Faktoren (O2):** Überall die echten Klassen-Verhältnisse der Strecke aus einer Funktion (auch „Adjust All“, Startpreis, Gewichte). Gewinnschwelle je Klasse aus dem Modell. | Heute feste 1,6 / 3 / 5 gegen echte 1,3–2,35 / 2,0–3,75 / 3,0–6,5 (1.3 W2; 1.8 W5). |
| E24 | 18.11.2026 | **Unter Marktpreis (O22):** Ohne Rivalen ist der Marktpreis etwa der erlösbeste Preis. Billiger lohnt nur gegen Rivalen oder zum Füllen der Sitze. | Heute bringt Economy unter Marktpreis bis +5 % Erlös (1.3 W3). |
| E25 | 18.11.2026 | **Umsteiger-Tarif (O23):** Marktpreis der Verbindung Start–Ziel × fester Abschlag 0,9, mit derselben Funktion wie Direktgäste. | Heute 0,9 × Grundpreis ohne SAT, Schwierigkeit, Knappheit; auf Hard teurer als direkt (1.3 W5; 1.2 W9). |
| E26 | 18.11.2026 | **Planer-Hauptzahl (O24):** Immer der erwartete Gewinn bei heutiger Nachfrage, auf jeder Stufe. „Volle Maschine“ höchstens als Nebenzahl beim Marktpreis. | Heute steigt die Hauptzahl mit jedem Preis (1.3 W1). |
| E27 | 18.11.2026 | **Gebühren je Fluggast (O25):** Check-in nur am Abflughafen, Abfertigung je Abflug. Höhe so neu einstellen, dass die Summe je Fluggast etwa gleich bleibt. | Heute an Start und Ziel fällig, Umsteiger zahlen doppelt (1.4 W5). |
| E28 | 18.11.2026 | **Abstellplätze (O26):** Ab Verwaltungsstufe 2 bekommt jeder Slot automatisch einen Abstellplatz **ohne Unterhalt** (bewusster Vorteil der Stufe). *Abweichung von der Empfehlung: Geschenk bleibt.* | Heute nur im Code, ohne Kommentar (1.4 W7). |
| E29 | 18.11.2026 | **Wertmodell (O27):** Wert neu = Kaufpreis (mit Kabine). Lineare Abschreibung je Jahr bis zu einem Restwert; Zustand als Zu- oder Abschlag. Die Abschreibung steht als Kosten im Monatsgewinn. Ein Wertmodell für Spieler, KI und Gebrauchtmarkt (R13). | Heute sofort −10 %, Kabine wertlos, Wertverlust nie als Kosten, Kauf als normaler Gewinnmonat (1.4 W13; 1.7 W10). |
| E30 | 18.11.2026 | **Kauf- und Verkaufsspanne (O28):** Händler-Spanne: Verkauf an den Markt unter Wert, Kauf vom Markt zum Wert oder darüber. Vorbestellungs-Rabatt kleiner als diese Spanne. Kaufen und sofort verkaufen bringt nie Gewinn. | Heute +5 % bei Kauf und Sofortverkauf; Vorbestellung unter Wiederverkaufswert (1.7 W1, W2). |
| E31 | 18.11.2026 | **Grundüberholung (O29):** Preis als Anteil des Listenpreises (mit Kostenindex). Sie senkt Verschleiß und Ausfälle; der Wert steigt höchstens um den Preis. | Heute 200 000 $ fest, hebt den Wert einer 747 um 13 Mio. $ (1.7 W3). |
| E32 | 18.11.2026 | **Charter (O30):** Bei Charter steht das eigene Flugzeug (keine eigenen Flugkosten). Charter-Gebühr als Preis je Flug, nicht als Erlösanteil. | Heute doppelte Kosten, Charter immer 175 000–770 000 $ teurer als Streichen (1.7 W4). |
| E33 | 18.11.2026 | **Gestrichene Flüge (O31):** Eine Strafe: Ruf-Abzug. Kein SAT-Abzug; die Nachfrage fällt höchstens auf die übrigen Sitze. | Heute SAT- und Ruf-Abzug; Erlös −77 % bei halbem Flugplan (1.7 W5). |
| E34 | 18.11.2026 | **Negative Kasse (O32):** Kreditlinie mit Zins bis zu einer Grenze (aus Flottenwert, E29). Darunter Warnung, nach 6 Monaten Zwangsverkauf von Flugzeugen; ohne Flugzeuge Spielende. | Heute für den Spieler ohne Folge, die KI wird nach 6 Monaten verkauft (1.7 W6). |
| E35 | 18.11.2026 | **Ereignisse (O33):** Ereignisse gelten für alle Gesellschaften gleich, auch regionale. Krisen-Antworten kosten einen Anteil der betroffenen Größe (E6). Mehr Ereignisse mit Antworten: nicht im Neubau, später. | Heute regionale nur für den Spieler; feste Preise 3–25 Mio. $ bei wachsendem Nutzen (1.7 W8, W13). |

### Bauregeln R1–R16 (bestätigt mit E12)

Diese Funde haben eine klare Lösung. Sie werden als Regeln in die Spezifikation übernommen (2.3–2.9).

| Nr. | Regel | Löst |
|---|---|---|
| R1 | **Ein Markt, eine Rechnung.** Alle Angebote eines Städtepaars (eigene Strecken, KI, Umsteiger) werden einmal gemeinsam aufgeteilt. Abflüge je Gesellschaft auf dem Paar summiert, je Richtung gezählt. Spieler und KI nutzen dieselbe Rechnung. | 1.2 W2, W3, W9, W10, W14; 1.1 W10; 1.6 doppelte Rivalen-Angebote |
| R2 | **Eine Funktion je Größe; Ansichten rechnen nicht.** Planer, Overlay, Streckenansicht, Live-Karte, Flughafen-Ansicht und Bericht lesen nur Werte aus dem Modell. | 1.1 W5; 1.3 W1 (Umsetzung); 1.4 Doppelte Rechnungen; 1.8 W1, W6, W7 |
| R3 | **Spielregeln nicht in `App.tsx` oder Klick-Handlern.** Treibstoff-Absicherung, Überholung, Umrüstung, Kabine (`src/model/kabine.ts`), Einrichtungs-Preise, Saisontabelle stehen im Modell. | 1.8 W3, W4, W8; 1.7 Doppelte Rechnungen |
| R4 | **Intern ungerundet, einmal kappen.** Runden nur für die Anzeige. | 1.1 W6 |
| R5 | **Stufenlose Zeit.** Mahlzeiten-Zahl gleitend wie der Flugzeit-Index; keine Sprünge bei 360 und 720 Minuten. | 1.1 W2; 1.4 W14 |
| R6 | **Kosten nach der richtigen Bezugsgröße.** Landungen je Flugabschnitt am Ziel; Flugbegleiter nach eingebauter Kabine; Treibstoff und Landung nach Flugzeug; Bodenpersonal je Abflug (oder in Abfertigung enthalten); ein Nachlass-Faktor für alle Flughafen-Gebühren; KI-Landegebühr mit derselben Funktion. | 1.4 W6, W8 (Teil), W10, W11, W12 |
| R7 | **KI-Preise relativ zum Marktpreis**, mit derselben Funktion wie beim Spieler; der Preis-Reiz der KI aus ihrem echten Preis. | 1.3 W4 |
| R8 | **Fehlender Preis = Marktpreis**, an einer Stelle. | 1.3 W9 |
| R9 | **Planer zeigt den Anlauf** neuer Strecken (erster Monat und volle Nachfrage). | 1.2 W11 |
| R10 | **Ruf an einer Stelle.** Eine Funktion „Ruf-Änderung“ mit Liste der Ursachen je Monat; Grenzen 0–100 einmal. | 1.5 W4 |
| R11 | **Kasse am Monatsende** nach allen Buchungen des Abschlusses; alle Leser nutzen sie; Abbuchungen gehören in den Bericht dieses Monats. | 1.7 W7 |
| R12 | **Monatsablauf sauber:** Verschleiß aus geflogenen Flügen; Pech-Deckel nach dem ersten Pech im Abschluss schließen; Ereignisse als Teil des Spielstands, nicht als Modul-Zustand. | 1.7 W11, W12, W13 (Teil) |
| R13 | **Gebrauchtmarkt:** Alter mindestens „jetzt − Bauende“; eine Restwert-Formel für alle (mit Alter und Zustand). | 1.7 W9; 1.6 W7 |
| R14 | **KI-Einzelheiten:** Langstrecken-Ausstattung je Mahlzeit; in langer Krise geparkte Flugzeuge verkaufen; 2. Drehkreuz bevorzugt in der Heimatregion, Mindeststufe 5. | 1.1 W11; 1.6 W9, W10 |
| R15 | **Einheitliche Regeln:** überall `regionOf`; Jahresziel aus Vorjahr und Größe mit Mindest-Belohnung. | 1.5 W10, W11 |
| R16 | **Aufräumen:** Selbstbedienungs-Abzug, SAT-Zweig über 200 und `loadFactor` im Ruf-Ziel entfernen; Texte und Kommentare aus Konstanten (4.1); altes Mahlzeiten-Format in 5.1 umwandeln. | 1.1 W4, W15; 1.3 W8, W11; 1.5 W12; 1.6 W11 |

## Offen

Zusammenfassung aus Paket 1.9 (Stand 17.11.2026, Commit `a4648b3`).
Quelle: die acht Dateien in `bestand/`. Kurzform der Verweise: **1.2 W4** = `bestand/2-nachfrage.md`,
Abschnitt W4; **1.2 F4** = dort offene Frage 4.

Aus 56 Einzelfragen (7 je Bestandsdatei) und O1–O6 sind **49 Fragen** geworden. Doppelte Fragen
sind zusammengelegt. O1–O6 behalten ihre Nummer, neue Fragen beginnen bei O7.
Alle 103 Funde (W) der Bestandsdateien sind einer Frage oder einer Bauregel (R1–R16) zugeordnet.

Jede Frage hat eine **Empfehlung** von Claude. Wer einer Empfehlung zustimmt, schreibt nur „ja“.
Manche Fragen legen nur die **Richtung** fest; die genauen Zahlen kommen aus dem Balance-Skript
(Paket 3.9). Das steht dann in der Empfehlung.

Die Fragen sind in vier Blöcke geteilt. Jeder Block ist ein Teil von Paket 2.1 (2.1a–2.1d).

**Stand 18.11.2026:** Block A (O3–O11) und die Bauregeln sind entschieden (E4–E12), Block B (O2, O12–O24)
ebenfalls (E13–E26), Block C (O25–O33) ebenfalls (E27–E35, oben). Offen sind noch 17 Fragen in Block D.

### Block D · Ruf, Rang, Konkurrenz, Oberfläche (Paket 2.1d)

| Nr. | Frage | Empfehlung | Quellen |
|---|---|---|---|
| O1 | **Ruf-Neutralpunkt und Start-Ruf:** Neutral ist 75 (Nachfrage-Faktor 1), Start 50 (−5 %). Typische Ziele liegen bei 60–74; viele Spieler bleiben dauerhaft unter 75. Die Firmen-Ansicht färbt ab 65 grün. | Neutral bei 50, Start bei 50. Farbstufen aus den Konstanten. | O1; 1.5 W3, F7 |
| O34 | **Werbung und Ruf:** Werbung hebt den Ruf dauerhaft um bis zu 15 Punkte. | Werbung bringt nur Bekanntheit (Nachfrage, solange sie läuft), keinen Ruf. | 1.5 W1, F1 |
| O35 | **Einmalige Ruf-Boni und -Strafen** (Meilensteine, Rang, Jahresziel, Streik, Ausfall, Übernahme +2): verfliegen in Monaten, können aber eine Rang-Schwelle überspringen. | Keine Einmal-Sprünge im Ruf. Belohnungen in Geld oder Freischaltungen. Störungen wirken über O31. Übernahme +2 entfällt. | 1.5 W2, F2; 1.8 W8, F4 |
| O36 | **Zustand im Ruf:** ungewichtetes Mittel der Flugzeuge mit Strecke; abgestellte zählen nicht; die Kabine steckt schon in der SAT. | Zustand nicht mehr im Ruf; er wirkt über die SAT (Kabine) und über Ausfälle (Zelle). Ruf kommt aus SAT (nach Fluggästen) und gestrichenen Flügen. | 1.5 W5, F5 |
| O37 | **Rang:** Bedingungen gelten für einen einzigen Monat; ein Sommermonat genügt. Der Rang geht nie verloren. | Mittel der letzten 3 Monate prüfen. Rang geht weiter nie verloren. | 1.5 W6, F3 |
| O38 | **Flugzeugklassen:** an den Rang gebunden; die Concorde ist im freien Spiel kaum erreichbar. | Klasse frei, sobald Rang **oder** Jahr erreicht ist (was zuerst kommt). Jahr je Klasse in der Spezifikation. | 1.5 W8, F4 |
| O39 | **Forschungsplätze je Rang:** Code gibt 3 / 4 / 5 bei Rang 3 / 6 / 9; Texte versprechen 3 bei National (4) und 5 bei Flag Carrier (8). | Die Texte gelten: Plätze als Feld je Rang, Text daraus erzeugt. (Nur Bestätigung.) | 1.5 W7 |
| O40 | **Karriere-Punkte:** Free und Normal in einer Ruhmeshalle; Forschung zählt fast so viel wie der höchste Rang. | Getrennte Listen für Free und Normal. Gewichte in Phase 2 festlegen; Richtung: Vermögen und Rang zählen am meisten. | 1.5 W14, F6 |
| O41 | **Gleiche Regeln für die KI:** Die KI zahlt keine Flughafen-Kosten, hat Gebühren-Rabatt überall, freie Slots, keinen Anlauf, keinen Ruf, keinen Verschleiß, keine Sperren, bekommt Zuschuss; regionale Ereignisse treffen sie nicht; im Spieler-Markt zählt sie immer mit SAT 100. | Dieselbe Wirtschaft für alle (Kosten, Slots, Anlauf, Verschleiß, Ruf, Ereignisse, SAT). Vereinfacht bleiben nur die Entscheidungen der KI. Was die KI bewusst auslässt (Forschung, Personal und Streik, Werbung), steht als Liste in der Spezifikation. | 1.6 W2, F1; 1.1 W10; 1.2 W10; 1.7 W13 |
| O42 | **Persönlichkeiten und Billigflieger:** Flag-Carrier werden bis 2000 zu 19–26 Mrd. $ Kasse, LCC und Optimizer gehen pleite, weil Kosten je Sitz nicht vom Geschäftsmodell abhängen. | Alle Persönlichkeiten im Mittel ähnlich erfolgreich. Billigflieger bekommen echte Kostenvorteile (dichtere Kabine, weniger Personal je Sitz). | 1.6 W1, F3 |
| O43 | **KI-Wachstum und Kasse:** Wachstum endet an den Drehkreuz-Slots, danach sammelt sich Geld ohne Grenze. Der Ticker-Rang zählt nach Kasse. | Größe nach Sitzen messen. KI kann weitere Drehkreuze eröffnen und modernisieren; Geld über einer Grenze geht als Dividende ab. Ticker-Rang nach Fluggästen. | 1.6 W4, F4 |
| O44 | **Zuschuss für die KI** (150 000–450 000 $ je Monat, nominal): | Abschaffen, sobald die KI-Wirtschaft nach E4 (O6), O41, O42 stimmt. Bis dahin mit Kostenindex. | 1.6 W5, F5 |
| O45 | **Übernahme:** Preis aus Flottenwert ohne Alter; die Kasse der KI verfällt; Slots des 2. Drehkreuzes landen am Heimat-Drehkreuz. | Preis = Unternehmenswert: Flottenwert mit Alter (O27) + Kasse + Wert der Slots. Slots je Flughafen übergeben. | 1.6 W6, F6 |
| O46 | **Flugzeuge aufgelöster KI:** verschwinden, die Meldung sagt „go back to the market“. | An den Gebrauchtmarkt geben. | 1.6 W8, F7; 1.7 W9 |
| O47 | **Slots:** Gemietete Rechte und KI-Abflüge je Woche werden voneinander abgezogen, als wären sie dieselbe Einheit. Die Grenze (Stufe × 300) steht nur in Ansichten; die KI prüft sie nicht. | Ein Slot = ein Abflug je Woche. Die Grenze steht im Modell; die KI belegt Slots und hält die Grenze ein. | 1.8 W2, F1 |
| O48 | **Flüge je Tag:** Der Planer zählt die freie Tageszeit des Flugzeugs, der Zeitplan-Editor den ganzen Tag. | Regel des Planers (übrige Strecken desselben Flugzeugs zählen), in einer Funktion im Modell. | 1.8 W6, F7 |
| O49 | **Erklärtexte und Debug-Anzeige:** neun Texte mit festen Zahlen; die Debug-Anzeige schreibt Formeln ab. | Alle Zahlen in Texten aus den Konstanten. Die Debug-Anzeige zeigt nur die Aufschlüsselung, die das Modell liefert, keine eigene Rechnung. | 1.8 W9, F6; 1.3 W8 |

### Abhängigkeiten

- E13 (O12) bestimmt mit E4, E6, E7 die Grundform des Modells.
- E7, E15, E20, E21, E22 legen nur die Richtung fest; die Zahlen kommen aus dem Balance-Skript (3.9).
- E29 (O27, Wertmodell) ist Grundlage für E30, E31, E34 und O45.
- O41 (gleiche Regeln) ist Grundlage für O42–O44 und O47.
- O44 (Zuschuss abschaffen) erst, wenn E4 (O6), O41 und O42 umgesetzt sind.
