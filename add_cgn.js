import fs from 'fs';

const filePath = 'src/data/airports.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// Cologne stats based on DUS but slightly lower
const cgnStats = {};
for (let year = 1960; year <= 2025; year++) {
  // Just creating a basic growth curve matching the others approximately
  const baseT = 20;
  const baseB = 30;
  // Let's say tourism grows to ~100 over 65 years, business to ~150
  cgnStats[year.toString()] = {
    tourism: Math.round(baseT * Math.pow(1.025, year - 1960)),
    business: Math.round(baseB * Math.pow(1.026, year - 1960))
  };
}

const cgnObj = {
  id: "CGN",
  name: "Köln Bonn",
  coords: [50.8659, 7.1427],
  slots: 3,
  stats: cgnStats
};

const cgnStr = JSON.stringify(cgnObj, null, 4).replace(/\n/g, '\n  ');

content = content.replace(/  \}\n\];/, `  },\n  ${cgnStr}\n];`);

fs.writeFileSync(filePath, content);
console.log('Added CGN to airports.ts');
