import { airportsData } from '../data/airports';
import { moreAirports } from '../data/more_airports';

export function getCountryPrefix(hubId: string): string {
  const idUpper = hubId.toUpperCase();

  // High-priority overrides (e.g. small countries, island regions or specific custom assignments)
  const overrides: Record<string, string> = {
    // Germany
    FRA: 'D', MUC: 'D', TXL: 'D', HAM: 'D', DUS: 'D', SXF: 'D', CGN: 'D', STR: 'D', BER: 'D', DTM: 'D',
    // UK
    LHR: 'G', LGW: 'G', MAN: 'G', EDI: 'G', STN: 'G', BHX: 'G', LCY: 'G', GLA: 'G', LTN: 'G',
    // France
    CDG: 'F', ORY: 'F', NCE: 'F', LYS: 'F', MRS: 'F', TLS: 'F', SXB: 'F', BOD: 'F',
    // Japan
    HND: 'JA', NRT: 'JA', KIX: 'JA', NGO: 'JA', FUK: 'JA', CTS: 'JA', OKA: 'JA',
    // Netherlands
    AMS: 'PH', EIN: 'PH', RTM: 'PH',
    // Italy
    FCO: 'I', MXP: 'I', LIN: 'I', VCE: 'I', BGY: 'I', NAP: 'I', PMO: 'I', TRN: 'I', BLQ: 'I',
    // Spain
    MAD: 'EC', BCN: 'EC', PMI: 'EC', AGP: 'EC', ALC: 'EC', VLC: 'EC', LPA: 'EC', TFS: 'EC', IBZ: 'EC',
    // USA
    JFK: 'N', ATL: 'N', ORD: 'N', LAX: 'N', SFO: 'N', MIA: 'N', DFW: 'N', DEN: 'N', SEA: 'N', EWR: 'N', BOS: 'N', MSP: 'N', DTW: 'N', PHX: 'N', IAH: 'N', LAS: 'N', CLT: 'N', SAN: 'N', LGA: 'N', HNL: 'N', ANC: 'N',
    // Switzerland
    ZRH: 'HB', GVA: 'HB', BSL: 'HB',
    // Singapore
    SIN: '9V',
    // Australia
    SYD: 'VH', MEL: 'VH', BNE: 'VH', PER: 'VH', ADL: 'VH', CNS: 'VH', OOL: 'VH',
    // UAE
    DXB: 'A6', AUH: 'A6', SHJ: 'A6',
    // Turkey
    IST: 'TC', AYT: 'TC', SAW: 'TC', ESB: 'TC', ADB: 'TC',
    // Qatar
    DOH: 'A7',
    // Russia
    SVO: 'RA', DME: 'RA', LED: 'RA', VKO: 'RA',
    // Hong Kong
    HKG: 'B',
  };

  if (overrides[idUpper]) {
    return overrides[idUpper];
  }

  // Find coordinates dynamically
  let coords: [number, number] | null = null;
  const coreMatch = airportsData.find(a => a.id === idUpper);
  if (coreMatch) {
    coords = coreMatch.coords;
  } else {
    const extraMatch = moreAirports.find(a => a.id === idUpper);
    if (extraMatch) {
      coords = extraMatch.coords as [number, number];
    }
  }

  if (coords) {
    const [lat, lng] = coords;

    // Canada check: dynamic prefix is C
    if (idUpper.startsWith('Y') && lng < -50) return 'C';

    // India
    if (lat > 8 && lat < 36 && lng > 68 && lng < 97) return 'VT';

    // South Korea
    if (lat > 33 && lat < 39 && lng > 124 && lng < 131) return 'HL';

    // Japan fallback
    if (lat > 24 && lat < 46 && lng > 122 && lng < 146) return 'JA';

    // China / Taiwan / Hong Kong
    if (lat > 18 && lat < 54 && lng > 73 && lng < 135) return 'B';

    // USA fallback
    if (lat > 24 && lat < 50 && lng > -125 && lng < -66) return 'N';
    if (lat > 50 && lat < 72 && lng > -170 && lng < -130) return 'N'; // Alaska
    if (lat > 18 && lat < 23 && lng > -161 && lng < -154) return 'N'; // Hawaii

    // Canada General
    if (lat > 42 && lat < 83 && lng > -141 && lng < -50) return 'C';

    // Mexico
    if (lat > 14 && lat < 33 && lng > -118 && lng < -86) return 'XA';

    // Brazil
    if (lat > -34 && lat < 6 && lng > -74 && lng < -34) return 'PP';

    // Argentina
    if (lat > -55 && lat < -21 && lng > -74 && lng < -53) return 'LV';

    // Chile
    if (lat > -56 && lat < -17 && lng > -76 && lng < -66) return 'CC';

    // Colombia
    if (lat > -4 && lat < 13 && lng > -79 && lng < -66) return 'HK';

    // Australia fallback
    if (lat > -44 && lat < -10 && lng > 113 && lng < 154) return 'VH';

    // New Zealand
    if (lat > -48 && lat < -33 && lng > 165 && lng < 179) return 'ZK';

    // Vietnam
    if (lat > 8 && lat < 24 && lng > 102 && lng < 110) return 'VN';

    // Thailand
    if (lat > 5 && lat < 21 && lng > 97 && lng < 106) return 'HS';

    // Malaysia
    if (lat > 1 && lat < 8 && lng > 99 && lng < 120) return '9M';

    // Singapore fallback
    if (lat > 1.2 && lat < 1.5 && lng > 103.6 && lng < 104.1) return '9V';

    // Indonesia
    if (lat > -11 && lat < 6 && lng > 95 && lng < 141) return 'PK';

    // Philippines
    if (lat > 4 && lat < 21 && lng > 116 && lng < 127) return 'RP';

    // UAE fallback
    if (lat > 22 && lat < 26.5 && lng > 51 && lng < 56.5) return 'A6';

    // Saudi Arabia
    if (lat > 16 && lat < 32.5 && lng > 34 && lng < 56) return 'HZ';

    // Ireland
    if (lat > 51.3 && lat < 55.5 && lng > -10.7 && lng < -5.3) return 'EI';

    // United Kingdom
    if (lat > 49.8 && lat < 61 && lng > -8.5 && lng < 1.8) return 'G';

    // Denmark (check before Sweden/others)
    if (lat > 54.5 && lat < 57.9 && lng > 8.0 && lng < 13.0) return 'OY';

    // Norway
    if (lat > 58 && lat < 71 && lng > 4 && lng < 32) return 'LN';

    // Sweden
    if (lat > 55 && lat < 69 && lng > 11 && lng < 24) return 'SE';

    // Finland
    if (lat > 60 && lat < 70 && lng > 20 && lng < 32) return 'OH';

    // Switzerland
    if (lat > 45.8 && lat < 47.8 && lng > 5.9 && lng < 10.5) return 'HB';

    // Austria
    if (lat > 46.3 && lat < 49.1 && lng > 9.5 && lng < 17.2) return 'OE';

    // Spain & Portugal
    if (lat > 36.9 && lat < 42.2 && lng > -9.6 && lng < -6.1) return 'CS';
    if (lat > 35.8 && lat < 44 && lng > -9.4 && lng < 4.4) return 'EC';

    // Belgium
    if (lat > 49.5 && lat < 51.5 && lng > 2.5 && lng < 6.4) return 'OO';

    // Netherlands
    if (lat > 50.7 && lat < 53.6 && lng > 3.3 && lng < 7.2) return 'PH';

    // Czech Republic (check before Germany box to capture Prague correctly)
    if (lat > 48.5 && lat < 51.1 && lng > 12.0 && lng < 18.9) return 'OK';

    // Poland (check before Germany box)
    if (lat > 49 && lat < 54.9 && lng > 14.1 && lng < 24.2) return 'SP';

    // Germany box
    if (lat > 47.2 && lat < 55.1 && lng > 5.86 && lng < 15.04) {
      return 'D';
    }

    // Hungary
    if (lat > 45.7 && lat < 48.6 && lng > 16 && lng < 22.9) return 'HA';

    // Romania
    if (lat > 43.6 && lat < 48.3 && lng > 20.2 && lng < 29.7) return 'YR';

    // Italy
    if (lat > 36.5 && lat < 47.1 && lng > 6.6 && lng < 18.6) return 'I';

    // France
    if (lat > 42.4 && lat < 51.1 && lng > -5.2 && lng < 9.6) return 'F';

    // Turkey fallback
    if (lat > 36 && lat < 42.1 && lng > 26 && lng < 45) return 'TC';

    // Greece
    if (lat > 34.8 && lat < 41.8 && lng > 19.3 && lng < 28.3) return 'SX';

    // Russia
    if (lat > 41 && lat < 82 && lng > 19 && lng < 170) return 'RA';

    // South Africa
    if (lat > -35 && lat < -22 && lng > 16 && lng < 33) return 'ZS';

    // Egypt
    if (lat > 22 && lat < 31.5 && lng > 25 && lng < 35) return 'SU';

    // Kenya
    if (lat > -5 && lat < 5 && lng > 34 && lng < 42) return '5Y';

    // Ethiopia
    if (lat > 3 && lat < 15 && lng > 33 && lng < 48) return 'ET';
  }

  return 'D';
}

export function getFamilyBlock(manufacturer: string, type: string, family: string): string {
  const m = manufacturer.toLowerCase();
  const t = type.toLowerCase();
  const f = family ? family.toLowerCase() : '';

  // Airbus narrowbodies (neo vs ceo)
  if (m.includes('airbus')) {
    if (t.includes('neo') || f.includes('neo') || t.includes('a220')) {
      return 'IN'; // neo block
    }
    if (t.includes('a318') || t.includes('a319') || t.includes('a320') || t.includes('a321')) {
      return 'II'; // classic narrowbody block
    }
    if (t.includes('a330') || t.includes('a340')) {
      return 'IK'; // medium/long haul
    }
    if (t.includes('a350')) {
      return 'AI'; // modern long haul
    }
    if (t.includes('a380')) {
      return 'IM'; // superjumbo
    }
    if (t.includes('a300') || t.includes('a310')) {
      return 'IA'; // classic airbus
    }
  }

  // Boeing
  if (m.includes('boeing')) {
    if (t.includes('737')) {
      return 'ME'; // typical European B737 blocks
    }
    if (t.includes('747')) {
      return 'AB'; // legendary Lufthansa B747 block (e.g. D-ABYA)
    }
    if (t.includes('757') || t.includes('767')) {
      return 'AW'; // typical Condor style
    }
    if (t.includes('777')) {
      return 'AL'; 
    }
    if (t.includes('787')) {
      return 'AP'; 
    }
    if (t.includes('707') || t.includes('720') || t.includes('727')) {
      return 'CA'; // Classic Boeings
    }
  }

  // Concorde
  if (t.includes('concorde') || f.includes('concorde')) {
    return 'CO';
  }

  // Regional/Special Jests
  if (m.includes('bombardier') || m.includes('embraer') || t.includes('crj') || t.includes('erj')) {
    return 'CI';
  }

  // ATR
  if (m.includes('atr') || t.includes('atr')) {
    return 'FT';
  }

  // Custom static generators
  let f1 = m.replace(/[^a-z]/g, '').slice(0, 1).toUpperCase();
  let f2 = t.replace(/[^a-z]/g, '').slice(0, 1).toUpperCase();
  
  if (!f1) f1 = 'X';
  if (!f2) f2 = 'Y';
  
  let prefix = f1 + f2;
  if (prefix === 'AA') prefix = 'AX';
  return prefix;
}

export function generateUniqueRegistration(
  manufacturer: string,
  type: string,
  family: string,
  hubId: string,
  existingRegistrations: string[]
): string {
  const prefix = getCountryPrefix(hubId);
  const block = getFamilyBlock(manufacturer, type, family);
  
  const existingRegSet = new Set(existingRegistrations.map(r => r.toUpperCase()));
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const blockChar1 = block.charAt(0) || 'X';
  let blockChar2 = block.charAt(1) || 'Y';

  for (let blockOffset = 0; blockOffset < 26; blockOffset++) {
    const offsetIndex = (alphabet.indexOf(blockChar2) + blockOffset) % 26;
    const currentBlockChar2 = alphabet.charAt(offsetIndex >= 0 ? offsetIndex : 0);
    
    for (let i = 0; i < 26; i++) {
      const seqChar = alphabet.charAt(i);
      const reg = `${prefix}-A${blockChar1}${currentBlockChar2}${seqChar}`;
      if (!existingRegSet.has(reg.toUpperCase())) {
        return reg;
      }
    }
  }

  // Fallback random block
  for (let attempt = 0; attempt < 500; attempt++) {
    const r1 = alphabet.charAt(Math.floor(Math.random() * 26));
    const r2 = alphabet.charAt(Math.floor(Math.random() * 26));
    const r3 = alphabet.charAt(Math.floor(Math.random() * 26));
    const reg = `${prefix}-A${r1}${r2}${r3}`;
    if (!existingRegSet.has(reg.toUpperCase())) {
      return reg;
    }
  }

  // Ultimate fallback
  return `${prefix}-A${block}${Math.random().toString(36).substring(2, 3).toUpperCase()}`;
}
