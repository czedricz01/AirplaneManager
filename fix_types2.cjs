const fs = require('fs');
let fUtils = fs.readFileSync('src/lib/financeUtils.ts', 'utf8');

fUtils = fUtils.replace(
  /const basePriceBE75 = totalEstPaxWeightedMax \> 0 \? totalWeeklyCosts \/ \(totalEstPaxWeightedMax \* 0\.75\) : 100;/g,
  `const basePriceBE75 = weightedSeatsPerWeek > 0 ? totalWeeklyCosts / (weightedSeatsPerWeek * 0.75) : 100;`
);

fUtils = fUtils.replace(
  /const basePriceBE99 = totalEstPaxWeightedMax \> 0 \? totalWeeklyCosts \/ \(totalEstPaxWeightedMax \* 0\.99\) : 80;/g,
  `const basePriceBE99 = weightedSeatsPerWeek > 0 ? totalWeeklyCosts / (weightedSeatsPerWeek * 0.99) : 80;`
);

fUtils = fUtils.replace(
  /const basePriceBE35 = totalEstPaxWeightedMax \> 0 \? totalWeeklyCosts \/ \(totalEstPaxWeightedMax \* 0\.35\) : 300;/g,
  `const basePriceBE35 = weightedSeatsPerWeek > 0 ? totalWeeklyCosts / (weightedSeatsPerWeek * 0.35) : 300;`
);

fs.writeFileSync('src/lib/financeUtils.ts', fUtils);
