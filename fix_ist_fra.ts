import fs from 'fs';
let fileStr = fs.readFileSync('src/data/raw_airports.csv', 'utf-8');

// But actually the source of truth for the game at runtime is airports.ts. 
// I will just modify airports.ts directly using JSON string manipulation or finding the object.

// Actually since we have raw_airports.csv we might need to modify that too, but since my previous script reconstructed airports.ts entirely from raw_airports.csv, I must modify the CSV!
let csvLines = fileStr.split('\n');

for (let i = 0; i < csvLines.length; i++) {
  if (csvLines[i].startsWith('IST;')) {
    let parts = csvLines[i].split(';');
    parts[4] = '6'; // Reduce level
    for (let j = 5; j < parts.length; j++) {
       if (parts[j]) {
          parts[j] = String(Math.round(parseInt(parts[j]) * 0.70)); // reduce passengers 30%
       }
    }
    csvLines[i] = parts.join(';');
  }
  else if (csvLines[i].startsWith('FRA;')) {
    let parts = csvLines[i].split(';');
    parts[4] = '7'; // Ensure level 7
    for (let j = 5; j < parts.length; j++) {
       if (parts[j]) {
          parts[j] = String(Math.round(parseInt(parts[j]) * 1.30)); // increase passengers 30%
       }
    }
    csvLines[i] = parts.join(';');
  }
}

fs.writeFileSync('src/data/raw_airports.csv', csvLines.join('\n'));
console.log('Modified raw_airports.csv');

// Now regenerate airports.ts using the same code backwards.
let result = `export interface Airport {
  id: string;
  name: string;
  coords: [number, number];
  level: number;
  stats?: {
    [year: string]: { tourism: number; business: number };
  };
}

export const airportsData: Airport[] = [
`;

for (let i = 1; i < csvLines.length; i++) {
  if (!csvLines[i].trim()) continue;
  const parts = csvLines[i].split(';');
  let stats = '    "stats": {\n';
  let year = 1960;
  for (let j = 5; j < parts.length; j += 2) {
    if (parts[j] && parts[j+1]) {
      stats += `      "${year}": {\n        "tourism": ${parseInt(parts[j])},\n        "business": ${parseInt(parts[j+1])}\n      }`;
      if (j + 2 < parts.length && parts[j+2]) stats += ',';
      stats += '\n';
    }
    year++;
  }
  stats += '    }';

  result += `  {
    "id": "${parts[0]}",
    "name": "${parts[1]}",
    "coords": [
      ${parseFloat(parts[2])},
      ${parseFloat(parts[3])}
    ],
    "level": ${parseInt(parts[4])},
${stats}
  }`;
  if (i < csvLines.length - 1 && csvLines[i+1].trim()) result += ',\n';
  else result += '\n';
}
result += '];\n';
result += `
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
`;

fs.writeFileSync('src/data/airports.ts', result);
console.log('Regenerated airports.ts');
