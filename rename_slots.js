import fs from 'fs';
const path = './src/data/airports.ts';
let content = fs.readFileSync(path, 'utf8');

// Replace "slots: number;" with "level: number;"
content = content.replace(/slots: number;/g, 'level: number;');

// Replace "slots": with "level":
content = content.replace(/"slots":/g, '"level":');

// Just in case it wasn't quoted
content = content.replace(/  slots: /g, '  level: ');

fs.writeFileSync(path, content);
console.log('Done');
