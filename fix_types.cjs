const fs = require('fs');

let fUtils = fs.readFileSync('src/lib/financeUtils.ts', 'utf8');

fUtils = fUtils.replace(
  /return \{\n\s*estWeeklyProfit:/,
  `const basePriceBE75 = totalEstPaxWeightedMax > 0 ? totalWeeklyCosts / (totalEstPaxWeightedMax * 0.75) : 100;
  const basePriceBE99 = totalEstPaxWeightedMax > 0 ? totalWeeklyCosts / (totalEstPaxWeightedMax * 0.99) : 80;
  const basePriceBE35 = totalEstPaxWeightedMax > 0 ? totalWeeklyCosts / (totalEstPaxWeightedMax * 0.35) : 300;
  
  return {
    basePriceBE75,
    basePriceBE99,
    basePriceBE35,
    estWeeklyProfit:`
);

fs.writeFileSync('src/lib/financeUtils.ts', fUtils);

let rEdit = fs.readFileSync('src/components/RoutePricingEditView.tsx', 'utf8');
rEdit = rEdit.replace(
  /const \{ weeklyFuelCost, weeklyCateringCost, weeklyStaffCost, weeklyInfraCost \} = financials\.costsBreakdown \|\| \{ weeklyFuelCost: 0, weeklyCateringCost: 0, weeklyStaffCost: 0, weeklyInfraCost: 0 \};/,
  `const { fuel: weeklyFuelCost = 0, catering: weeklyCateringCost = 0, crew: weeklyStaffCost = 0, infra: weeklyInfraCost = 0 } = (financials.costsBreakdown || {}) as Record<string, number>;`
);
fs.writeFileSync('src/components/RoutePricingEditView.tsx', rEdit);
