import * as fs from 'fs';
import * as path from 'path';

function standardizeButtons(filePath: string) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Standardize "Next" / Primary Action buttons
    // Wait, let's just make sure they all use bg-aero-yellow text-black font-black uppercase text-sm tracking-widest hover:bg-white transition-all
    
    // In ConfigurePurchaseView, it's:
    // className="bg-aero-yellow text-black font-black uppercase tracking-widest text-sm px-4 py-4 rounded-sm hover:bg-white transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-aero-yellow disabled:transform-none"
    // Let's keep it similar.
    content = content.replace(/bg-aero-yellow text-black font-black uppercase text-sm tracking-widest hover:bg-white hover:shadow-2xl hover:scale-\[1\.01\] transition-all font-sans/g,
        'bg-aero-yellow text-black font-black uppercase text-sm tracking-widest py-4 px-6 rounded-none hover:bg-white transition-all shadow-2xl disabled:opacity-50');

    // And the back buttons:
    content = content.replace(/border border-white\/20 text-white\/60 font-black uppercase text-sm tracking-widest hover:text-white hover:bg-white\/10 transition-all font-sans/g,
        'border border-white/20 text-white/60 font-black uppercase text-sm tracking-widest py-4 px-6 rounded-none hover:text-white hover:bg-white/10 transition-all');

    // Make sure we have shrink-0 at the bottom Action bars.
    
    fs.writeFileSync(filePath, content, 'utf-8');
}

const componentsDir = path.join(process.cwd(), 'src', 'components');
const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));
files.forEach(f => {
    standardizeButtons(path.join(componentsDir, f));
});
