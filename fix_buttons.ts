import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'src', 'components', 'ConfigurePurchaseView.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Move the Back button to the bottom footer.
// In Header:
content = content.replace(
    /<button\s+onClick=\{onCancel\}\s+className="text-white\/50 hover:text-white transition-colors p-2 -ml-2"\s+>\s+<ChevronLeft size=\{24\} \/>\s+<\/button>/,
    ''
);

// In Footer:
// Replace `<div className="flex items-center gap-3 flex-1">`
content = content.replace(
    /<div className="flex items-center gap-3 flex-1">/,
    `<button onClick={onCancel} className="border border-white/20 text-white/60 font-black uppercase text-sm tracking-widest py-4 px-6 rounded-none hover:text-white hover:bg-white/10 transition-all mr-auto">Cancel</button>
          <div className="flex items-center gap-3">`
);

fs.writeFileSync(filePath, content, 'utf-8');
