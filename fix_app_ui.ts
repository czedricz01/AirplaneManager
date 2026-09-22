import * as fs from 'fs';
import * as path from 'path';

function processFile(filePath: string) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // 1. Color replacements
    content = content.replace(/text-emerald-[0-9]+/g, 'text-aero-yellow');
    content = content.replace(/text-blue-[0-9]+/g, 'text-white/80');
    content = content.replace(/bg-blue-[0-9]+\/[0-9]+/g, 'bg-white/5');
    content = content.replace(/border-blue-[0-9]+\/[0-9]+/g, 'border-white/10');
    
    content = content.replace(/text-green-[0-9]+/g, 'text-aero-yellow');
    content = content.replace(/bg-green-[0-9]+\/[0-9]+/g, 'bg-aero-yellow/10');
    content = content.replace(/border-green-[0-9]+\/[0-9]+/g, 'border-aero-yellow/20');
    
    content = content.replace(/text-red-[0-9]+/g, 'text-aero-yellow/60');
    content = content.replace(/bg-red-[0-9]+\/[0-9]+/g, 'bg-[#111]');
    content = content.replace(/border-red-[0-9]+\/[0-9]+/g, 'border-white/20');
    
    // Standardize grays to anthracite
    content = content.replace(/bg-zinc-[0-9]+/g, 'bg-[#1a1a1a]');
    content = content.replace(/bg-gray-[0-9]+/g, 'bg-[#1a1a1a]');
    content = content.replace(/bg-slate-[0-9]+/g, 'bg-[#1a1a1a]');
    
    content = content.replace(/bg-\[\#111111\]/g, 'bg-[#0f0f0f]');
    content = content.replace(/bg-\[\#161616\]/g, 'bg-[#141414]');
    content = content.replace(/bg-\[\#1a1a1a\]/g, 'bg-[#1a1a1a]');
    content = content.replace(/bg-\[\#1c0d0d\]/g, 'bg-[#1a1a1a]');
    content = content.replace(/bg-\[\#180c0c\]/g, 'bg-[#1a1a1a]');

    // 2. Reduce dead spaces
    content = content.replace(/mb-6/g, 'mb-3');
    content = content.replace(/mb-8/g, 'mb-4');
    content = content.replace(/mb-12/g, 'mb-6');
    content = content.replace(/gap-6/g, 'gap-3');
    content = content.replace(/gap-8/g, 'gap-4');
    content = content.replace(/p-6/g, 'p-4');
    content = content.replace(/p-8/g, 'p-4');
    content = content.replace(/py-8/g, 'py-4');
    content = content.replace(/px-8/g, 'px-4');
    content = content.replace(/py-6/g, 'py-3');
    content = content.replace(/px-6/g, 'px-3');

    fs.writeFileSync(filePath, content, 'utf-8');
}

processFile(path.join(process.cwd(), 'src', 'App.tsx'));
