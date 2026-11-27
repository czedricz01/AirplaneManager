/**
 * Karibik, Mittel- und Südamerika. Quellen: ACI-LAC Airport Traffic Reports 2019/2024, ANAC/Infraero
 * (Brasilien), Aerocivil (Kolumbien), ORSNA (Argentinien), JAC (Chile), CORPAC/Lima Airport Partners,
 * Aeropuerto de Tocumen, Puerto Rico Ports Authority, Jahresberichte der Flughäfen. Kleine Flughäfen:
 * ICAO/Weltbank je Land, gerundet.
 */
import type { TrafficEntry } from './types';

export const LATIN_AMERICA: Record<string, TrafficEntry> = {
  // --- Karibik, Mittelamerika ---
  SJU: [9.4, 13.0, 'CB', 'L', 0.05],
  PUJ: [8.3, 9.5, 'CB', 'R', 0.01, { open: 1984, a: { 1984: 0.05, 1990: 0.5, 2000: 2.5, 2010: 4.5 } }],
  SDQ: [4.0, 5.0, 'CB', 'M', 0.03],
  KIN: [1.8, 2.0, 'CB', 'M', 0.02],
  MBJ: [4.6, 5.0, 'CB', 'R', 0.01],
  POS: [2.5, 2.1, 'CB', 'X', 0.05],
  BGI: [2.4, 2.3, 'CB', 'R', 0.05],
  NAS: [3.6, 4.3, 'CB', 'R', 0.02],
  AUA: [2.5, 2.9, 'CB', 'R', 0.02],
  BZE: [1.0, 1.2, 'CB', 'L', 0.01],
  HAV: [4.0, 2.0, 'CB', 'L', 0.02, { a: { 1958: 1.0, 1962: 0.15, 1990: 0.8, 2000: 1.6, 2010: 2.5 }, n: 'Revolution 1959, US-Embargo; Wirtschaftskrise ab 2020' }],
  LIR: [1.2, 1.9, 'CB', 'R', 0.01],
  SJO: [5.5, 6.5, 'CB', 'L', 0.03],
  PTY: [16.6, 18.0, 'CB', 'B', 0.65, { a: { 1970: 0.5, 1980: 1.0, 1990: 1.0, 2000: 2.0, 2010: 5.9 } }],
  SAL: [3.0, 3.6, 'CB', 'M', 0.3],
  GUA: [3.0, 3.0, 'CB', 'B', 0.02],
  TGU: [0.8, 0.9, 'CB', 'G', 0.01],
  MGA: [1.3, 1.1, 'CB', 'M', 0.01],
  SAP: [1.3, 1.4, 'CB', 'B', 0.01],

  // --- Kolumbien, Ecuador, Bolivien, Peru ---
  BOG: [35.6, 45.0, 'SA', 'B', 0.25, { a: { 1970: 1.5, 1980: 4.0, 1990: 6.0, 2000: 7.5, 2010: 18.4 } }],
  MDE: [8.5, 11.0, 'SA', 'M', 0.02],
  CLO: [5.6, 6.3, 'SA', 'M', 0.02],
  BAQ: [2.7, 3.5, 'SA', 'M', 0.01],
  CTG: [5.5, 7.5, 'SA', 'R', 0.01],
  UIO: [5.0, 5.0, 'SA', 'G', 0.03],
  GYE: [4.0, 4.1, 'SA', 'B', 0.02],
  VVI: [2.5, 2.3, 'SA', 'B', 0.05],
  LPB: [1.9, 1.7, 'SA', 'G', 0.02],
  LIM: [23.6, 25.0, 'SA', 'B', 0.25, { a: { 1970: 1.0, 1980: 2.0, 1990: 2.5, 2000: 4.0, 2010: 10.3 } }],
  CUZ: [3.5, 3.7, 'SA', 'R', 0.01],
  AQP: [2.0, 2.2, 'SA', 'M', 0.01],
  IQT: [0.8, 0.9, 'SA', 'M', 0.01],
  PIU: [0.9, 1.1, 'SA', 'M', 0.01],
  TPP: [0.6, 0.7, 'SA', 'L', 0.01],

  // --- Brasilien ---
  GRU: [65.8, 65.7, 'SA', 'B', 0.15, {
    a: { 1960: 1.0, 1970: 2.5, 1980: 6.0, 1990: 10.0, 2000: 20.0, 2010: 41.0 },
    n: 'São Paulo: Guarulhos (ab 1985) + Congonhas (CGH, nicht im Spiel)',
  }],
  GIG: [22.8, 20.6, 'SA', 'M', 0.05, { n: 'Rio de Janeiro: Galeão + Santos Dumont (SDU, nicht im Spiel)' }],
  BSB: [16.7, 15.0, 'SA', 'G', 0.35],
  CNF: [10.7, 11.0, 'SA', 'B', 0.05],
  SSA: [7.7, 8.0, 'SA', 'L', 0.03],
  FOR: [6.6, 7.0, 'SA', 'L', 0.05],
  REC: [8.7, 9.5, 'SA', 'M', 0.15],
  POA: [8.3, 6.0, 'SA', 'B', 0.02, { a: { 2023: 6.4 }, n: 'Hochwasser 2024: Flughafen fünf Monate geschlossen' }],
  CWB: [6.6, 6.4, 'SA', 'B', 0.02],
  MAO: [2.9, 3.4, 'SA', 'M', 0.03],
  BEL: [3.5, 3.6, 'SA', 'M', 0.02],
  IGU: [2.4, 2.6, 'SA', 'R', 0.01],

  // --- Chile, Argentinien, Uruguay, Paraguay ---
  SCL: [24.6, 25.6, 'SA', 'B', 0.15, { a: { 1970: 0.6, 1980: 1.2, 1990: 2.0, 2000: 5.0, 2010: 12.0 } }],
  IQQ: [1.3, 1.3, 'SA', 'X', 0.01],
  ANF: [1.6, 1.6, 'SA', 'X', 0.01],
  CJC: [1.6, 1.6, 'SA', 'X', 0.01],
  PMC: [1.0, 1.2, 'SA', 'L', 0.01],
  PUQ: [1.0, 1.1, 'SA', 'L', 0.01],
  EZE: [27.2, 22.7, 'SA', 'B', 0.1, { n: 'Buenos Aires: Ezeiza + Aeroparque (AEP, nicht im Spiel)' }],
  COR: [3.4, 3.6, 'SA', 'B', 0.02],
  MDZ: [2.2, 2.3, 'SA', 'L', 0.01],
  ROS: [1.3, 1.2, 'SA', 'B', 0.01],
  BRC: [1.3, 1.9, 'SA', 'R', 0.01],
  SLA: [1.1, 1.4, 'SA', 'L', 0.01],
  NQN: [1.0, 1.4, 'SA', 'X', 0.01],
  USH: [0.7, 0.8, 'SA', 'R', 0.01],
  FTE: [0.6, 0.8, 'SA', 'R', 0.01],
  MVD: [2.1, 2.0, 'SA', 'M', 0.02],
  ASU: [1.2, 1.3, 'SA', 'G', 0.02],
};
