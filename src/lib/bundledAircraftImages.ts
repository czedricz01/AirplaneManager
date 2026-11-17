/**
 * Aircraft pictures shipped with the game itself, in src/assets/planes/.
 *
 * Each file is named after its aircraft in the form `aircraftImageStem` returns
 * (for example `airbus_a220_100.webp`). Vite finds the files at build time,
 * copies them into the build with a content hash in the name, and gives back
 * their final URLs. This module only maps stem -> URL; the images themselves
 * are loaded by the browser when a card shows them.
 *
 * In the single-file static build (`npm run build:static`) the URLs are data:
 * URLs instead, so the pictures sit inside the HTML file (see vite.config.ts).
 */
const files = import.meta.glob('../assets/planes/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export const BUNDLED_AIRCRAFT_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([filePath, url]) => [
    filePath.slice(filePath.lastIndexOf('/') + 1, -'.webp'.length),
    url,
  ])
);
