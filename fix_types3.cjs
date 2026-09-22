const fs = require('fs');
let fUtils = fs.readFileSync('src/lib/financeUtils.ts', 'utf8');

fUtils = fUtils.replace(
  /const basePriceBE75 = weightedSeatsPerWeek \> 0 \? totalWeeklyCosts \/ \(weightedSeatsPerWeek \* 0\.75\) : 100;/,
  `const weightedSeatsPerWeek = (
    (aircraft.config?.economy || 0) * 1 +
    (aircraft.config?.premium || 0) * 1.6 +
    (aircraft.config?.business || 0) * 3.0 +
    (aircraft.config?.first || 0) * 5.0
  ) * flightLegs;
  
  const basePriceBE75 = weightedSeatsPerWeek > 0 ? totalWeeklyCosts / (weightedSeatsPerWeek * 0.75) : 100;`
);

fs.writeFileSync('src/lib/financeUtils.ts', fUtils);
