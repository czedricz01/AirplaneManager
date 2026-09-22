const fs = require('fs');
const filepath = './src/components/RoutePlannerView.tsx';

let content = fs.readFileSync(filepath, 'utf8');

let lines = content.split(/\r?\n/);

let step3StartIdx = -1;
let step3EndIdx = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('step === 3 && selectedOrigin')) {
    step3StartIdx = i;
  }
  if (lines[i].includes('step === 4 && financials') && step3StartIdx !== -1) {
    step3EndIdx = i;
    break;
  }
}

console.log('Step 3 block lies between lines:', step3StartIdx + 1, 'and', step3EndIdx + 1);

let balance = 0;
let details = [];

for (let row = step3StartIdx; row < step3EndIdx; row++) {
  const line = lines[row];
  
  // Count occurrences of <div and </div on the line
  let opens = (line.match(/<div(\s|>|$)/gi) || []).length;
  let closes = (line.match(/<\/div>/gi) || []).length;
  
  balance += opens - closes;
  if (opens > 0 || closes > 0) {
    details.push({
      lineNum: row + 1,
      text: line.trim(),
      opens,
      closes,
      currentBalance: balance
    });
  }
}

// Print lines with final non-zero balances to see where mismatch propagates
console.log('Final tag balances timeline:');
details.forEach(d => {
  console.log(`L${d.lineNum}: [Net:${d.currentBalance}] (Opens:${d.opens} Closes:${d.closes}) - "${d.text}"`);
});

console.log('Overall net balance for step 3 is:', balance);
