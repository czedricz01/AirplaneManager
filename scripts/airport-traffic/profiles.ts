/**
 * Wachstums-Profile je Land oder Region: Fluggäste an den Flughäfen der Region, 2019 = 1.
 *
 * Ein Flughafen ohne eigene historische Stützwerte folgt dem Profil seiner Region: Wert(Jahr) =
 * Wert(2019) × Profil(Jahr). Zwischen den Stützjahren wird geometrisch (gleiche Wachstumsrate je Jahr)
 * gerechnet. `g25` ist das Wachstum 2024 → 2025, wenn für den Flughafen kein Wert für 2025 angegeben ist.
 *
 * Quellen (gerundet, Fluggäste an Flughäfen bzw. von den Gesellschaften des Landes beförderte Fluggäste):
 * - Welt: ICAO, Civil Aviation Statistics of the World (über Weltbank IS.AIR.PSGR): 1970 310 Mio.,
 *   1980 642 Mio., 1990 1 025 Mio., 2000 ≈ 1 670 Mio., 2010 ≈ 2 630 Mio., 2019 ≈ 4 400 Mio.
 * - USA: FAA/BTS, Fluggäste der US-Gesellschaften (1960 ≈ 58 Mio. … 2019 ≈ 926 Mio.).
 * - Kanada: Statistics Canada, Air Passenger Traffic. Mexiko: SCT/AFAC, Aviación Mexicana en Cifras.
 * - Deutschland: ADV-Verkehrsstatistik; Großbritannien: CAA Airport Data; Frankreich: UAF;
 *   Spanien: AENA; Italien: Assaeroporti; Griechenland: HCAA.
 * - Polen: ULC; Russland/Sowjetunion: Aeroflot 1960–1990 (16 / 71 / 104 / 139 Mio.), Rosaviatsia ab 1992.
 * - Türkei: DHMI. Golfstaaten: Jahresberichte der Flughäfen (Dubai Airports, HIA, Abu Dhabi Airports).
 * - China: CAAC Statistical Bulletin (Fluggäste der Gesellschaften 1980 3,4 Mio., 1990 16,6 Mio.,
 *   2000 67 Mio., 2010 268 Mio., 2019 660 Mio.; Flughäfen 2019 1 350 Mio., 2024 1 460 Mio.).
 * - Japan: MLIT, Airport Management Statistics. Korea: KAC/IIAC. Indien: AAI Traffic News.
 * - Brasilien: ANAC/Infraero. Australien: BITRE Airport Traffic Data.
 * - Übrige Regionen: ICAO/Weltbank je Land, gerundet.
 */

export interface Profile {
  /** Stützwerte, 2019 = 1. */
  readonly points: Readonly<Record<number, number>>;
  /** Wachstum 2024 → 2025, wenn kein eigener Wert für 2025 vorliegt. */
  readonly g25: number;
}

const p = (points: Record<number, number>, g25: number): Profile => ({ points: { ...points, 2019: 1 }, g25 });

export const PROFILES = {
  /** USA. */
  US: p({ 1960: 0.063, 1970: 0.18, 1980: 0.32, 1990: 0.5, 2000: 0.72, 2010: 0.78 }, 1.01),
  /** Kanada. */
  CA: p({ 1960: 0.05, 1970: 0.13, 1980: 0.26, 1990: 0.32, 2000: 0.47, 2010: 0.66 }, 1.0),
  /** Mexiko. */
  MX: p({ 1960: 0.02, 1970: 0.06, 1980: 0.19, 1990: 0.24, 2000: 0.38, 2010: 0.55 }, 1.03),
  /** Karibik und Mittelamerika. */
  CB: p({ 1960: 0.04, 1970: 0.15, 1980: 0.28, 1990: 0.38, 2000: 0.55, 2010: 0.7 }, 1.03),
  /** Südamerika. */
  SA: p({ 1960: 0.02, 1970: 0.05, 1980: 0.12, 1990: 0.19, 2000: 0.3, 2010: 0.62 }, 1.04),
  /** West- und Nordeuropa (GB, IE, DE, FR, Benelux, CH, AT, Skandinavien). */
  WE: p({ 1960: 0.03, 1970: 0.12, 1980: 0.22, 1990: 0.37, 2000: 0.6, 2010: 0.74 }, 1.03),
  /** Südeuropa (ES, PT, IT, GR, MT, CY): Charter-Boom ab den 1960ern. */
  SE: p({ 1960: 0.015, 1970: 0.08, 1980: 0.16, 1990: 0.26, 2000: 0.5, 2010: 0.7 }, 1.04),
  /** Mittel- und Osteuropa außerhalb der früheren Sowjetunion (PL, CZ, HU, RO, BG, Ex-Jugoslawien, AL, Baltikum). */
  EE: p({ 1960: 0.025, 1970: 0.04, 1980: 0.07, 1990: 0.06, 2000: 0.13, 2010: 0.42 }, 1.08),
  /** Russland und Belarus: Aeroflot-Zeit, Einbruch der 1990er, Sanktionen ab 2022. */
  RU: p({ 1960: 0.08, 1970: 0.33, 1980: 0.48, 1990: 0.66, 1995: 0.22, 2000: 0.17, 2010: 0.45 }, 0.97),
  /** Kaukasus, Zentralasien, Moldau, Ukraine bis 2021. */
  CS: p({ 1960: 0.06, 1970: 0.25, 1980: 0.4, 1990: 0.55, 1995: 0.15, 2000: 0.12, 2010: 0.4 }, 1.08),
  /** Türkei. */
  TR: p({ 1960: 0.005, 1970: 0.02, 1980: 0.04, 1990: 0.09, 2000: 0.17, 2010: 0.48 }, 1.06),
  /** Golfstaaten und Arabische Halbinsel. */
  ME: p({ 1960: 0.004, 1970: 0.02, 1980: 0.1, 1990: 0.16, 2000: 0.27, 2010: 0.55 }, 1.06),
  /** Levante, Irak, Iran, Ägypten. */
  LV: p({ 1960: 0.04, 1970: 0.1, 1980: 0.2, 1990: 0.25, 2000: 0.4, 2010: 0.7 }, 1.05),
  /** Nordafrika (Maghreb). */
  NF: p({ 1960: 0.03, 1970: 0.1, 1980: 0.22, 1990: 0.3, 2000: 0.42, 2010: 0.75 }, 1.07),
  /** Afrika südlich der Sahara. */
  AF: p({ 1960: 0.04, 1970: 0.1, 1980: 0.2, 1990: 0.25, 2000: 0.35, 2010: 0.65 }, 1.06),
  /** China (Festland). */
  CN: p({ 1960: 0.003, 1970: 0.002, 1980: 0.005, 1990: 0.025, 2000: 0.1, 2010: 0.41 }, 1.05),
  /** Japan. */
  JP: p({ 1960: 0.01, 1970: 0.11, 1980: 0.3, 1990: 0.53, 2000: 0.75, 2010: 0.71 }, 1.04),
  /** Südkorea. */
  KR: p({ 1960: 0.002, 1970: 0.012, 1980: 0.05, 1990: 0.19, 2000: 0.38, 2010: 0.56 }, 1.03),
  /** Hongkong, Taiwan, Singapur. */
  AT: p({ 1960: 0.01, 1970: 0.04, 1980: 0.13, 1990: 0.32, 2000: 0.5, 2010: 0.66 }, 1.06),
  /** Südostasien (TH, MY, ID, PH, KH, MM, LA, BN). */
  SEA: p({ 1960: 0.006, 1970: 0.025, 1980: 0.07, 1990: 0.13, 2000: 0.22, 2010: 0.47 }, 1.05),
  /** Vietnam. */
  VN: p({ 1960: 0.003, 1970: 0.005, 1980: 0.003, 1990: 0.008, 2000: 0.06, 2010: 0.24 }, 1.08),
  /** Indien. */
  IN: p({ 1960: 0.004, 1970: 0.012, 1980: 0.03, 1990: 0.06, 2000: 0.12, 2010: 0.42 }, 1.05),
  /** Übriges Südasien (PK, BD, LK, NP, MV). */
  SAS: p({ 1960: 0.03, 1970: 0.08, 1980: 0.18, 1990: 0.3, 2000: 0.4, 2010: 0.6 }, 1.04),
  /** Australien und Neuseeland. */
  AU: p({ 1960: 0.03, 1970: 0.075, 1980: 0.14, 1990: 0.21, 2000: 0.4, 2010: 0.7 }, 1.03),
  /** Pazifik-Inseln. */
  PI: p({ 1960: 0.02, 1970: 0.1, 1980: 0.25, 1990: 0.4, 2000: 0.55, 2010: 0.75 }, 1.03),
} as const satisfies Record<string, Profile>;

export type ProfileKey = keyof typeof PROFILES;
