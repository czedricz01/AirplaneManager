import type { ProfileKey } from './profiles';

/**
 * Geschäftsreise-Anteil der Fluggäste, als Zahl 0 … 1 oder als Kategorie:
 * - `R` Urlaubsinsel/Badeort 0,06
 * - `L` Urlaubs-geprägte Stadt oder Region 0,13
 * - `M` gemischte Stadt (Regelfall) 0,24
 * - `B` Wirtschafts- oder Hauptstadt mit viel Geschäftsverkehr 0,33
 * - `G` Regierungs- oder Verwaltungsstadt 0,40
 * - `X` Rohstoff- oder Finanzstandort mit sehr viel Geschäftsverkehr 0,45
 * Bezugswerte: CAA Passenger Survey 2019 (alle befragten britischen Flughäfen 19 %, Heathrow ≈ 30 %,
 * Gatwick ≈ 13 %, London City ≈ 46 %), Fraport (Frankfurt 2019 ≈ 35 %), ADV Airport Travel Survey 2018
 * (deutsche Flughäfen gesamt ≈ 30 %).
 */
export type BusinessCategory = 'R' | 'L' | 'M' | 'B' | 'G' | 'X';

export const BUSINESS_SHARE: Record<BusinessCategory, number> = {
  R: 0.06,
  L: 0.13,
  M: 0.24,
  B: 0.33,
  G: 0.4,
  X: 0.45,
};

/** Zusätzliche Angaben zu einem Flughafen. Alle Fluggast-Zahlen in Millionen je Jahr. */
export interface TrafficExtra {
  /** Historische Stützwerte (Jahr → Mio. Fluggäste), auch nach 2019 (z. B. Kriegsjahre). */
  readonly a?: Readonly<Record<number, number>>;
  /** Erstes Jahr mit Verkehr; davor 0. Der Wert im Eröffnungsjahr kommt aus `a`. */
  readonly open?: number;
  /** Fluggäste 2025, wenn bekannt; sonst 2024 × Profil-Wachstum. */
  readonly p25?: number;
  /** Erklärung (Stadtsumme, Vorgänger-Flughafen, Krieg …). */
  readonly n?: string;
}

/**
 * Ein Flughafen: [Fluggäste 2019, Fluggäste 2024, Profil, Geschäftsanteil, Umsteiger-Anteil, Zusatz].
 * Fluggäste = Ein- und Aussteiger laut Flughafen-Statistik (ACI-Zählweise), inklusive der Flughäfen
 * derselben Stadt, die nicht selbst im Spiel sind (siehe `n`). Umsteiger-Anteil = Teil dieser Zahl,
 * der nur umsteigt; der Rest ist Ziel- und Quellverkehr der Stadt.
 */
export type TrafficEntry = readonly [
  p19: number,
  p24: number,
  profile: ProfileKey,
  business: BusinessCategory | number,
  transfer: number,
  extra?: TrafficExtra,
];
