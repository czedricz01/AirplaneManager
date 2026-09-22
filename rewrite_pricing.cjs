const fs = require('fs');
let content = fs.readFileSync('src/components/RoutePricingEditView.tsx', 'utf8');
content = content.replace(
  /const originHub = .*?const adjustAllPricesByPercentage = \([^)]+\) => \{.*?\};/s,
  `const { basePriceBE75, basePriceBE99, basePriceBE35 } = financials;
  
  const adjustAllPricesByPercentage = (pct: number) => {
    setTicketPrices(prev => {
      const next = { ...prev };
      ['economy', 'premium', 'business', 'first'].forEach(cls => {
        const seats = aircraft.config?.[cls as keyof typeof aircraft.config] as number || 0;
        if (seats && seats > 0) {
          const current = prev[cls] || 150;
          let newVal = Math.round(current * (1 + pct));
          const multiplier = (cls === 'premium' ? 1.6 : cls === 'business' ? 3.0 : cls === 'first' ? 5.0 : 1.0);
          const breakEvenPrice = Math.round((basePriceBE75 || 100) * multiplier);
          const min = Math.round(breakEvenPrice * 0.5);
          const max = Math.round((basePriceBE35 || 300) * multiplier);
          newVal = Math.max(min, Math.min(max, newVal));
          next[cls] = newVal;
        }
      });
      return next;
    });
  };`
);
fs.writeFileSync('src/components/RoutePricingEditView.tsx', content);
