/**
 * Who the rival airlines can be.
 *
 * Real carriers start at their real home base and only exist in the years
 * they actually flew, so a 1965 game gets BOAC and Pan Am, a 2010 game gets
 * British Airways and Emirates. Fictional carriers fill the rest of the field
 * and take a free major airport as their hub.
 *
 * Several real carriers share a home airport (JFK, KUL, ...). Only one rival
 * per hub is ever picked, and never one based at the player's hub.
 */

export type RivalPersonality = 'flag' | 'lcc' | 'expansionist' | 'optimizer' | 'boutique';

export interface RealAirline {
  name: string;
  /** IATA code, unique within this list. */
  code: string;
  /** Airport id of the carrier's main hub. */
  hub: string;
  /** First year of scheduled service under this name. */
  founded: number;
  /** Year the carrier ceased or was renamed; absent while it still flies. */
  ceased?: number;
  personality: RivalPersonality;
}

export const REAL_AIRLINES: RealAirline[] = [
  // Europe
  { name: 'Lufthansa', code: 'LH', hub: 'FRA', founded: 1955, personality: 'flag' },
  { name: 'Condor', code: 'DE', hub: 'FRA', founded: 1956, personality: 'lcc' },
  { name: 'Air France', code: 'AF', hub: 'CDG', founded: 1933, personality: 'flag' },
  { name: 'BOAC', code: 'BA', hub: 'LHR', founded: 1946, ceased: 1974, personality: 'flag' },
  { name: 'British Airways', code: 'BA', hub: 'LHR', founded: 1974, personality: 'flag' },
  { name: 'KLM Royal Dutch Airlines', code: 'KL', hub: 'AMS', founded: 1919, personality: 'flag' },
  { name: 'Swissair', code: 'SR', hub: 'ZRH', founded: 1931, ceased: 2002, personality: 'boutique' },
  { name: 'Swiss International Air Lines', code: 'LX', hub: 'ZRH', founded: 2002, personality: 'boutique' },
  { name: 'Alitalia', code: 'AZ', hub: 'FCO', founded: 1946, ceased: 2021, personality: 'flag' },
  { name: 'SAS Scandinavian Airlines', code: 'SK', hub: 'CPH', founded: 1946, personality: 'flag' },
  { name: 'Iberia', code: 'IB', hub: 'MAD', founded: 1927, personality: 'flag' },
  { name: 'TAP Air Portugal', code: 'TP', hub: 'LIS', founded: 1945, personality: 'flag' },
  { name: 'Sabena', code: 'SN', hub: 'BRU', founded: 1923, ceased: 2001, personality: 'flag' },
  { name: 'Austrian Airlines', code: 'OS', hub: 'VIE', founded: 1957, personality: 'boutique' },
  { name: 'Finnair', code: 'AY', hub: 'HEL', founded: 1923, personality: 'optimizer' },
  { name: 'Aer Lingus', code: 'EI', hub: 'DUB', founded: 1936, personality: 'optimizer' },
  { name: 'Olympic Airways', code: 'OA', hub: 'ATH', founded: 1957, ceased: 2009, personality: 'flag' },
  { name: 'LOT Polish Airlines', code: 'LO', hub: 'WAW', founded: 1929, personality: 'flag' },
  { name: 'CSA Czechoslovak Airlines', code: 'OK', hub: 'PRG', founded: 1923, personality: 'flag' },
  { name: 'Malev Hungarian Airlines', code: 'MA', hub: 'BUD', founded: 1954, ceased: 2012, personality: 'flag' },
  { name: 'Wizz Air', code: 'W6', hub: 'BUD', founded: 2004, personality: 'lcc' },
  { name: 'Tarom', code: 'RO', hub: 'OTP', founded: 1954, personality: 'flag' },
  { name: 'Balkan Bulgarian Airlines', code: 'LZ', hub: 'SOF', founded: 1947, ceased: 2002, personality: 'flag' },
  { name: 'JAT Yugoslav Airlines', code: 'JU', hub: 'BEG', founded: 1947, ceased: 2013, personality: 'flag' },
  { name: 'Interflug', code: 'IF', hub: 'BER', founded: 1963, ceased: 1991, personality: 'flag' },
  { name: 'Air Berlin', code: 'AB', hub: 'BER', founded: 1979, ceased: 2017, personality: 'expansionist' },
  { name: 'Aeroflot', code: 'SU', hub: 'SVO', founded: 1932, personality: 'expansionist' },
  { name: 'Icelandair', code: 'FI', hub: 'KEF', founded: 1937, personality: 'optimizer' },
  { name: 'Ryanair', code: 'FR', hub: 'STN', founded: 1985, personality: 'lcc' },
  { name: 'easyJet', code: 'U2', hub: 'LTN', founded: 1995, personality: 'lcc' },
  { name: 'Norwegian Air Shuttle', code: 'DY', hub: 'OSL', founded: 2002, personality: 'lcc' },
  { name: 'Vueling', code: 'VY', hub: 'BCN', founded: 2004, personality: 'lcc' },
  { name: 'Turkish Airlines', code: 'TK', hub: 'IST', founded: 1933, personality: 'expansionist' },
  { name: 'Pegasus Airlines', code: 'PC', hub: 'SAW', founded: 1990, personality: 'lcc' },

  // North America
  { name: 'Pan American World Airways', code: 'PA', hub: 'JFK', founded: 1927, ceased: 1991, personality: 'expansionist' },
  { name: 'JetBlue Airways', code: 'B6', hub: 'JFK', founded: 2000, personality: 'lcc' },
  { name: 'Trans World Airlines', code: 'TW', hub: 'STL', founded: 1930, ceased: 2001, personality: 'expansionist' },
  { name: 'United Airlines', code: 'UA', hub: 'ORD', founded: 1926, personality: 'expansionist' },
  { name: 'American Airlines', code: 'AA', hub: 'DFW', founded: 1930, personality: 'optimizer' },
  { name: 'Delta Air Lines', code: 'DL', hub: 'ATL', founded: 1929, personality: 'optimizer' },
  { name: 'Eastern Air Lines', code: 'EA', hub: 'MIA', founded: 1930, ceased: 1991, personality: 'expansionist' },
  { name: 'Northwest Airlines', code: 'NW', hub: 'MSP', founded: 1926, ceased: 2010, personality: 'optimizer' },
  { name: 'Continental Airlines', code: 'CO', hub: 'IAH', founded: 1937, ceased: 2012, personality: 'expansionist' },
  { name: 'Western Airlines', code: 'WA', hub: 'LAX', founded: 1926, ceased: 1987, personality: 'optimizer' },
  { name: 'Pacific Southwest Airlines', code: 'PS', hub: 'SAN', founded: 1949, ceased: 1988, personality: 'lcc' },
  { name: 'US Airways', code: 'US', hub: 'CLT', founded: 1979, ceased: 2015, personality: 'optimizer' },
  { name: 'America West Airlines', code: 'HP', hub: 'PHX', founded: 1983, ceased: 2007, personality: 'lcc' },
  { name: 'Frontier Airlines', code: 'F9', hub: 'DEN', founded: 1994, personality: 'lcc' },
  { name: 'Alaska Airlines', code: 'AS', hub: 'SEA', founded: 1944, personality: 'optimizer' },
  { name: 'Hawaiian Airlines', code: 'HA', hub: 'HNL', founded: 1929, personality: 'boutique' },
  { name: 'Air Canada', code: 'AC', hub: 'YYZ', founded: 1937, personality: 'flag' },
  { name: 'Canadian Pacific Air Lines', code: 'CP', hub: 'YVR', founded: 1942, ceased: 2001, personality: 'optimizer' },
  { name: 'WestJet', code: 'WS', hub: 'YYC', founded: 1996, personality: 'lcc' },
  { name: 'Aeromexico', code: 'AM', hub: 'MEX', founded: 1934, personality: 'flag' },
  { name: 'Copa Airlines', code: 'CM', hub: 'PTY', founded: 1947, personality: 'optimizer' },
  { name: 'LACSA', code: 'LR', hub: 'SJO', founded: 1946, ceased: 2013, personality: 'optimizer' },
  { name: 'TACA', code: 'TA', hub: 'SAL', founded: 1931, ceased: 2013, personality: 'optimizer' },

  // South America
  { name: 'Varig', code: 'RG', hub: 'GIG', founded: 1927, ceased: 2006, personality: 'flag' },
  { name: 'TAM Airlines', code: 'JJ', hub: 'GRU', founded: 1976, personality: 'optimizer' },
  { name: 'Gol Linhas Aereas', code: 'G3', hub: 'GRU', founded: 2001, personality: 'lcc' },
  { name: 'LAN Chile', code: 'LA', hub: 'SCL', founded: 1929, personality: 'optimizer' },
  { name: 'Avianca', code: 'AV', hub: 'BOG', founded: 1919, personality: 'flag' },
  { name: 'Aerolineas Argentinas', code: 'AR', hub: 'EZE', founded: 1950, personality: 'flag' },

  // Middle East
  { name: 'El Al', code: 'LY', hub: 'TLV', founded: 1948, personality: 'flag' },
  { name: 'Emirates', code: 'EK', hub: 'DXB', founded: 1985, personality: 'expansionist' },
  { name: 'Qatar Airways', code: 'QR', hub: 'DOH', founded: 1994, personality: 'boutique' },
  { name: 'Etihad Airways', code: 'EY', hub: 'AUH', founded: 2003, personality: 'boutique' },
  { name: 'Gulf Air', code: 'GF', hub: 'BAH', founded: 1950, personality: 'flag' },
  { name: 'Oman Air', code: 'WY', hub: 'MCT', founded: 1993, personality: 'boutique' },
  { name: 'Kuwait Airways', code: 'KU', hub: 'KWI', founded: 1954, personality: 'flag' },
  { name: 'Saudia', code: 'SV', hub: 'JED', founded: 1945, personality: 'flag' },
  { name: 'Royal Jordanian', code: 'RJ', hub: 'AMM', founded: 1963, personality: 'flag' },
  { name: 'Middle East Airlines', code: 'ME', hub: 'BEY', founded: 1945, personality: 'flag' },
  { name: 'Air Arabia', code: 'G9', hub: 'SHJ', founded: 2003, personality: 'lcc' },

  // Africa
  { name: 'EgyptAir', code: 'MS', hub: 'CAI', founded: 1933, personality: 'flag' },
  { name: 'Ethiopian Airlines', code: 'ET', hub: 'ADD', founded: 1946, personality: 'expansionist' },
  { name: 'Kenya Airways', code: 'KQ', hub: 'NBO', founded: 1977, personality: 'optimizer' },
  { name: 'South African Airways', code: 'SA', hub: 'JNB', founded: 1934, personality: 'flag' },
  { name: 'Royal Air Maroc', code: 'AT', hub: 'CMN', founded: 1957, personality: 'flag' },
  { name: 'Air Algerie', code: 'AH', hub: 'ALG', founded: 1947, personality: 'flag' },
  { name: 'Tunisair', code: 'TU', hub: 'TUN', founded: 1948, personality: 'flag' },
  { name: 'Nigeria Airways', code: 'WT', hub: 'LOS', founded: 1958, ceased: 2003, personality: 'flag' },
  { name: 'Ghana Airways', code: 'GH', hub: 'ACC', founded: 1958, ceased: 2005, personality: 'flag' },
  { name: 'Air Afrique', code: 'RK', hub: 'ABJ', founded: 1961, ceased: 2002, personality: 'flag' },
  { name: 'TAAG Angola Airlines', code: 'DT', hub: 'LAD', founded: 1938, personality: 'flag' },
  { name: 'Air Zimbabwe', code: 'UM', hub: 'HRE', founded: 1967, personality: 'flag' },
  { name: 'Air Tanzania', code: 'TC', hub: 'DAR', founded: 1977, personality: 'optimizer' },
  { name: 'RwandAir', code: 'WB', hub: 'KGL', founded: 2003, personality: 'expansionist' },
  { name: 'Air Namibia', code: 'SW', hub: 'WDH', founded: 1946, ceased: 2021, personality: 'flag' },
  { name: 'Air Madagascar', code: 'MD', hub: 'TNR', founded: 1962, personality: 'flag' },
  { name: 'Air Mauritius', code: 'MK', hub: 'MRU', founded: 1967, personality: 'boutique' },
  { name: 'Air Seychelles', code: 'HM', hub: 'SEZ', founded: 1977, personality: 'boutique' },

  // Asia
  { name: 'Air India', code: 'AI', hub: 'BOM', founded: 1946, personality: 'flag' },
  { name: 'Indian Airlines', code: 'IC', hub: 'DEL', founded: 1953, ceased: 2011, personality: 'flag' },
  { name: 'IndiGo', code: '6E', hub: 'DEL', founded: 2006, personality: 'lcc' },
  { name: 'Pakistan International Airlines', code: 'PK', hub: 'KHI', founded: 1955, personality: 'flag' },
  { name: 'Biman Bangladesh Airlines', code: 'BG', hub: 'DAC', founded: 1972, personality: 'flag' },
  { name: 'SriLankan Airlines', code: 'UL', hub: 'CMB', founded: 1979, personality: 'flag' },
  { name: 'Japan Airlines', code: 'JL', hub: 'HND', founded: 1951, personality: 'flag' },
  { name: 'All Nippon Airways', code: 'NH', hub: 'NRT', founded: 1955, personality: 'optimizer' },
  { name: 'Korean Air', code: 'KE', hub: 'ICN', founded: 1969, personality: 'flag' },
  { name: 'Asiana Airlines', code: 'OZ', hub: 'ICN', founded: 1988, personality: 'boutique' },
  { name: 'Singapore Airlines', code: 'SQ', hub: 'SIN', founded: 1972, personality: 'boutique' },
  { name: 'Malaysia Airlines', code: 'MH', hub: 'KUL', founded: 1972, personality: 'flag' },
  { name: 'AirAsia', code: 'AK', hub: 'KUL', founded: 1996, personality: 'lcc' },
  { name: 'Thai Airways', code: 'TG', hub: 'BKK', founded: 1960, personality: 'flag' },
  { name: 'Cathay Pacific', code: 'CX', hub: 'HKG', founded: 1946, personality: 'boutique' },
  { name: 'China Airlines', code: 'CI', hub: 'TPE', founded: 1959, personality: 'optimizer' },
  { name: 'EVA Air', code: 'BR', hub: 'TPE', founded: 1991, personality: 'boutique' },
  { name: 'Air China', code: 'CA', hub: 'PEK', founded: 1988, personality: 'flag' },
  { name: 'China Eastern Airlines', code: 'MU', hub: 'PVG', founded: 1988, personality: 'expansionist' },
  { name: 'China Southern Airlines', code: 'CZ', hub: 'CAN', founded: 1988, personality: 'expansionist' },
  { name: 'Hainan Airlines', code: 'HU', hub: 'HAK', founded: 1993, personality: 'expansionist' },
  { name: 'Sichuan Airlines', code: '3U', hub: 'CTU', founded: 1987, personality: 'optimizer' },
  { name: 'Shenzhen Airlines', code: 'ZH', hub: 'SZX', founded: 1993, personality: 'optimizer' },
  { name: 'Xiamen Airlines', code: 'MF', hub: 'XMN', founded: 1985, personality: 'optimizer' },
  { name: 'Spring Airlines', code: '9C', hub: 'SHA', founded: 2005, personality: 'lcc' },
  { name: 'Vietnam Airlines', code: 'VN', hub: 'HAN', founded: 1989, personality: 'flag' },
  { name: 'Garuda Indonesia', code: 'GA', hub: 'CGK', founded: 1949, personality: 'flag' },
  { name: 'Philippine Airlines', code: 'PR', hub: 'MNL', founded: 1941, personality: 'flag' },
  { name: 'Air Astana', code: 'KC', hub: 'ALA', founded: 2002, personality: 'optimizer' },
  { name: 'Uzbekistan Airways', code: 'HY', hub: 'TAS', founded: 1992, personality: 'flag' },

  // Oceania
  { name: 'Qantas', code: 'QF', hub: 'SYD', founded: 1920, personality: 'flag' },
  { name: 'Ansett Australia', code: 'AN', hub: 'MEL', founded: 1936, ceased: 2002, personality: 'optimizer' },
  { name: 'Jetstar', code: 'JQ', hub: 'MEL', founded: 2004, personality: 'lcc' },
  { name: 'Virgin Australia', code: 'VA', hub: 'BNE', founded: 2000, personality: 'lcc' },
  { name: 'Air New Zealand', code: 'NZ', hub: 'AKL', founded: 1940, personality: 'optimizer' },
  { name: 'Fiji Airways', code: 'FJ', hub: 'NAN', founded: 1951, personality: 'boutique' },
  { name: 'Air Tahiti Nui', code: 'TN', hub: 'PPT', founded: 1998, personality: 'boutique' }
];

export interface FictionalAirline {
  name: string;
  /** Two-character code, never one of the real carriers' codes above. */
  code: string;
}

export const FICTIONAL_AIRLINES: FictionalAirline[] = [
  { name: 'Aurelia Airways', code: 'R7' },
  { name: 'Meridian Air', code: 'M5' },
  { name: 'Polaris Airlines', code: 'P3' },
  { name: 'Northwind Airways', code: 'N4' },
  { name: 'Solstice Air', code: 'S6' },
  { name: 'Atlas Continental', code: 'A9' },
  { name: 'Pacifica Airways', code: 'H2' },
  { name: 'Coral Sky Airlines', code: 'C4' },
  { name: 'Zephyr Airlines', code: 'Z7' },
  { name: 'Cumulus Air', code: 'U5' },
  { name: 'Silverline Airways', code: 'V3' },
  { name: 'Kestrel Airlines', code: 'K6' },
  { name: 'Monsoon Express', code: 'T9' },
  { name: 'Mistral Airways', code: 'W5' },
  { name: 'Crescent Airlines', code: 'X4' },
  { name: 'Blue Lagoon Air', code: 'L6' },
  { name: 'Stratos Airways', code: 'Q2' },
  { name: 'Equator Air', code: 'E8' },
  { name: 'Nimbus Airlines', code: 'J4' },
  { name: 'Halcyon Air', code: 'Y7' },
  { name: 'Borealis Air', code: 'D5' },
  { name: 'Terra Nova Airways', code: 'G6' },
  { name: 'Vega Airlines', code: 'O2' },
  { name: 'Sirocco Air', code: 'I8' }
];

/** Is a real carrier flying under this name in the given year? */
export const isActiveIn = (airline: RealAirline, year: number): boolean =>
  airline.founded <= year && (airline.ceased === undefined || airline.ceased > year);
