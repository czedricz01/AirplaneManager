import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'src', 'components', 'RouteScheduleEditView.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

content = content.replace(/className="w-full py-4 bg-aero-yellow text-black font-black uppercase tracking-widest hover:bg-white hover:scale-\[1.02\] active:scale-95 transition-all shadow-2xl disabled:opacity-50 disabled:grayscale disabled:hover:scale-100 flex items-center justify-center gap-2"/g,
    'className="w-full py-4 px-6 bg-aero-yellow text-black font-black uppercase text-sm tracking-widest hover:bg-white transition-all shadow-2xl disabled:opacity-50 flex items-center justify-center gap-2 rounded-none"');

fs.writeFileSync(filePath, content, 'utf-8');
