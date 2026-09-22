import fs from 'fs';
let code = fs.readFileSync('src/components/RoutePlannerView.tsx', 'utf8');

code = code.replace(/const cycleMin = s\.isOneWay \? \(30 \+ s\.durMin \+ 30\) : \(30 \+ s\.durMin \+ s\.turnoverMin \+ s\.durMin \+ 30\);/g, 'const cycleMin = (30 + s.durMin + s.turnoverMin + s.durMin + 30);');
code = code.replace(/title=\{isOneWay \? `FLIGHT: \$\{airlineCode\}\$\{flightNumberOutbound\}` : `OUT: \$\{airlineCode\}\$\{flightNumberOutbound\} \| IN: \$\{airlineCode\}\$\{flightNumberInbound\}`\}/g, 'title={`OUT: ${airlineCode}${flightNumberOutbound} | IN: ${airlineCode}${flightNumberInbound}`}');
code = code.replace(/\{isOneWay \? `\$\{airlineCode\}\$\{flightNumberOutbound\}` : `\$\{airlineCode\}\$\{flightNumberOutbound\} \& \$\{airlineCode\}\$\{flightNumberInbound\}`\}/g, '{`${airlineCode}${flightNumberOutbound} & ${airlineCode}${flightNumberInbound}`}');
code = code.replace(/\{selectedOrigin\.id\} \{isOneWay \? '\''→'\'' : '\''⇄'\''\} \{selectedDest\.id\}/g, '{selectedOrigin.id} ⇄ {selectedDest.id}');

fs.writeFileSync('src/components/RoutePlannerView.tsx', code);
