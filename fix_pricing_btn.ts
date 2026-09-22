import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'src', 'components', 'RoutePricingEditView.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

content = content.replace(/className="px-12 py-3 bg-aero-yellow text-black font-black uppercase text-xs tracking-widest hover:bg-white transition-all flex items-center gap-2 shadow-lg shadow-aero-yellow\/20"/g,
    'className="bg-aero-yellow text-black font-black uppercase text-sm tracking-widest py-4 px-6 rounded-none hover:bg-white transition-all shadow-2xl flex items-center gap-2 disabled:opacity-50"');

content = content.replace(/className="px-8 py-3 bg-white\/5 text-white\/50 font-black uppercase text-xs tracking-widest hover:text-white hover:bg-white\/10 transition-all border border-white\/10"/g,
    'className="border border-white/20 text-white/60 font-black uppercase text-sm tracking-widest py-4 px-6 rounded-none hover:text-white hover:bg-white/10 transition-all"');

fs.writeFileSync(filePath, content, 'utf-8');
