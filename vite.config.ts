import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// `npm run build:static` sets this. It produces a single self-contained HTML file
// that runs from any web host and from a local file:// path, with no Node.js and no
// server — see scripts/inline-static.mjs and the README.
const isStaticBuild = process.env.STATIC_BUILD === '1';

export default defineConfig(() => {
  // Note: anything put in `define` is inlined verbatim into the client bundle and is
  // therefore public. Secrets belong on the server; browser-safe values must use the
  // VITE_ prefix and are read via import.meta.env.
  return {
    // Relative asset URLs, so the build also works when it is not served from a
    // domain root (a subfolder, an artifact host, or a local file).
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: isStaticBuild
      ? {
          outDir: 'dist-static',
          // One classic script and one stylesheet, which scripts/inline-static.mjs
          // then folds into the HTML. A plain IIFE (not an ES module) is what makes
          // the result openable straight from disk.
          cssCodeSplit: false,
          modulePreload: false,
          rollupOptions: {
            output: {
              format: 'iife' as const,
              inlineDynamicImports: true,
              entryFileNames: 'app.js',
              assetFileNames: 'app.[ext]',
            },
          },
          chunkSizeWarningLimit: 4000,
        }
      : {
          // The airport dataset dominates the bundle; splitting it out keeps the app
          // shell small and lets the browser cache the data separately.
          rollupOptions: {
            output: {
              // A function rather than a name-to-packages map: the map form left
              // React in the app chunk, because React is reached through several
              // entry files (react, react/jsx-runtime, react-dom/client).
              manualChunks(id: string) {
                if (/\/src\/data\/(airportsRows|moreAirportsRows|airports|more_airports|airportRegistry)\.ts$/.test(id)) return 'airport-data';
                if (/\/src\/data\/(aircraft|fuelPrices)\.ts$/.test(id)) return 'aircraft-data';
                if (!id.includes('/node_modules/')) return undefined;
                if (/\/node_modules\/(leaflet|react-leaflet|@react-leaflet)\//.test(id)) return 'map-vendor';
                // Libraries that change far less often than the game does: in
                // chunks of their own, a new release of the game leaves them
                // in the browser's cache.
                if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor';
                if (/\/node_modules\/(@supabase|iceberg-js|tslib)\//.test(id)) return 'supabase-vendor';
                if (/\/node_modules\/(motion|motion-dom|motion-utils|framer-motion)\//.test(id)) return 'motion-vendor';
                return undefined;
              },
            },
          },
          chunkSizeWarningLimit: 900,
        },
    server: {
      // HMR can be disabled via the DISABLE_HMR env var when file watching causes
      // flickering (e.g. while an agent is editing files).
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
