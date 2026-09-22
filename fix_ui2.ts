import * as fs from 'fs';
import * as path from 'path';

const componentsDir = path.join(process.cwd(), 'src', 'components');

function processFile(filePath: string) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Global color replacements
    content = content.replace(/bg-emerald-[0-9]+/g, 'bg-aero-yellow');
    content = content.replace(/text-emerald-[0-9]+/g, 'text-aero-yellow');
    content = content.replace(/border-emerald-[0-9]+/g, 'border-aero-yellow');
    
    content = content.replace(/bg-blue-[0-9]+/g, 'bg-white/10');
    content = content.replace(/text-blue-[0-9]+/g, 'text-white');
    content = content.replace(/border-blue-[0-9]+/g, 'border-white/20');
    
    content = content.replace(/bg-green-[0-9]+/g, 'bg-aero-yellow/20');
    content = content.replace(/text-green-[0-9]+/g, 'text-aero-yellow');
    content = content.replace(/border-green-[0-9]+/g, 'border-aero-yellow/30');

    content = content.replace(/bg-red-[0-9]+/g, 'bg-[#1a1a1a]');
    content = content.replace(/text-red-[0-9]+/g, 'text-aero-yellow/50');
    content = content.replace(/border-red-[0-9]+/g, 'border-white/10');

    content = content.replace(/bg-amber-[0-9]+/g, 'bg-aero-yellow');
    content = content.replace(/text-amber-[0-9]+/g, 'text-aero-yellow');
    
    content = content.replace(/shadow-\[.*?\]/g, 'shadow-2xl');
    
    // standardize buttons - replace hover:bg-emerald-400 to hover:bg-white
    content = content.replace(/hover:bg-emerald-[0-9]+/g, 'hover:bg-white hover:text-black');
    content = content.replace(/hover:text-emerald-[0-9]+/g, 'hover:text-black');
    content = content.replace(/hover:border-emerald-[0-9]+/g, 'hover:border-white');

    fs.writeFileSync(filePath, content, 'utf-8');
}

const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));
files.forEach(f => {
    processFile(path.join(componentsDir, f));
});
processFile(path.join(process.cwd(), 'src', 'App.tsx'));
