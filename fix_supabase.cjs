const fs = require('fs');
let content = fs.readFileSync('src/components/BuyAircraftView.tsx', 'utf-8');

const anchorStart = `        {/* Permanent Supabase Storage Bucket Settings */}`;
const anchorEnd = `        {/* Sleek ZIP & Single Image Customizers - visible in debug mode */}`;

const startIndex = content.indexOf(anchorStart);
const endIndex = content.indexOf(anchorEnd, startIndex);

const oldCode = content.slice(startIndex, endIndex);

const newCode = `        {/* Permanent Supabase Storage Bucket Settings */}
        {debugMode && (
          <div className="bg-[#111111] border border-aero-yellow/20 rounded-sm p-4 shrink-0 transition-all hover:border-aero-yellow/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold font-mono uppercase tracking-[0.2em] text-aero-yellow flex items-center gap-2">
                  <Database size={16} />
                  Supabase Storage Bucket (Permanent Images)
                </h3>
                <p className="text-xs text-white/60 font-mono mt-0.5">
                  Connected Supabase storage bucket URL for permanent aircraft image rendering across all devices.
                </p>
              </div>
              {getSupabaseBucketUrl() && (
                <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-sm text-[10px] font-mono text-green-400 font-bold uppercase tracking-wider self-start sm:self-center shrink-0">
                  <CheckCircle2 size={12} />
                  Bucket Active
                </div>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="e.g. https://xxxx.supabase.co/storage/v1/object/public/your-bucket-name"
                className="flex-1 bg-black/60 border border-white/10 rounded-sm px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-aero-yellow/60 transition-colors placeholder:text-white/20"
                value={getSupabaseBucketUrl()}
                onChange={(e) => {
                  setSupabaseBucketUrl(e.target.value);
                  setSearchTerm(prev => prev); // re-trigger render
                }}
              />
              <button
                type="button"
                className="bg-white/5 hover:bg-white/10 text-white font-mono text-xs px-4 py-2 border border-white/10 rounded-sm transition-colors whitespace-nowrap"
                onClick={() => {
                  setSupabaseBucketUrl('');
                  setSearchTerm(prev => prev);
                }}
              >
                Reset
              </button>
            </div>
          </div>
        )}
`;

content = content.replace(oldCode, newCode);
fs.writeFileSync('src/components/BuyAircraftView.tsx', content);
console.log("Fixed Supabase bucket hide");
