/**
 * Folds the output of `STATIC_BUILD=1 vite build` into a single HTML file.
 *
 * The result has no external references of its own: one <style> block and one
 * classic <script> block. That makes it runnable from a plain static web host,
 * from a USB stick, or by double-clicking it — no Node.js, no server, no install.
 *
 * External services the game uses at runtime (map tiles, fonts, aircraft photos)
 * are still fetched from the network if the browser can reach them.
 */
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve(process.cwd(), 'dist-static');
const htmlPath = path.join(outDir, 'index.html');

if (!fs.existsSync(htmlPath)) {
  console.error(`[inline-static] ${htmlPath} not found — run the vite build first.`);
  process.exit(1);
}

let html = fs.readFileSync(htmlPath, 'utf8');
const inlined = [];

// Stylesheets -> <style>
html = html.replace(
  /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/g,
  (match, href) => {
    if (/^https?:|^\/\//.test(href)) return match; // leave CDN/font links alone
    const assetPath = path.join(outDir, href.replace(/^\.?\//, ''));
    if (!fs.existsSync(assetPath)) return match;
    inlined.push(href);
    return `<style>\n${fs.readFileSync(assetPath, 'utf8')}\n</style>`;
  }
);

// Scripts -> inline <script> at the very end of <body>.
//
// Vite writes the entry as `type="module" crossorigin` in <head>. The static build
// emits a plain IIFE instead, and dropping those attributes is what lets the file
// run from a local file:// path, where module fetches are blocked by CORS. But a
// classic inline script is NOT deferred, so leaving it in <head> would run it
// before #root exists. Hence the move to the end of the body.
const scriptBodies = [];
html = html.replace(
  /<script([^>]*)src=["']([^"']+)["']([^>]*)><\/script>\s*/g,
  (match, _before, src) => {
    if (/^https?:|^\/\//.test(src)) return match;
    const assetPath = path.join(outDir, src.replace(/^\.?\//, ''));
    if (!fs.existsSync(assetPath)) return match;
    inlined.push(src);
    scriptBodies.push(fs.readFileSync(assetPath, 'utf8'));
    return '';
  }
);

if (scriptBodies.length > 0) {
  const block = scriptBodies.map(code => `<script>\n${code}\n</script>`).join('\n');
  const closingBody = html.lastIndexOf('</body>');
  // Spliced rather than String.replace'd on purpose: a string replacement would
  // interpret `$&`, `$1` and friends inside the minified bundle as replacement
  // patterns and silently corrupt the code.
  html = closingBody === -1
    ? html + block
    : html.slice(0, closingBody) + block + '\n' + html.slice(closingBody);
}

// Preload hints point at files that no longer exist separately.
html = html.replace(/<link[^>]*rel=["']modulepreload["'][^>]*>\s*/g, '');

fs.writeFileSync(htmlPath, html);

// Drop the now-redundant asset files so the folder holds exactly one deliverable.
for (const ref of inlined) {
  const assetPath = path.join(outDir, ref.replace(/^\.?\//, ''));
  fs.rmSync(assetPath, { force: true });
}
const assetsDir = path.join(outDir, 'assets');
if (fs.existsSync(assetsDir) && fs.readdirSync(assetsDir).length === 0) {
  fs.rmdirSync(assetsDir);
}

const bytes = fs.statSync(htmlPath).size;
console.log(`[inline-static] Inlined ${inlined.length} asset(s).`);
console.log(`[inline-static] dist-static/index.html — ${(bytes / 1024 / 1024).toFixed(2)} MB, self-contained.`);
