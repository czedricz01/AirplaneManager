import { logDebug } from './debugLog';

/** File name stem of an aircraft picture: "Airbus A220-100" -> "airbus_a220_100".
 *  The files in src/assets/planes/ are named this way. */
export const aircraftImageStem = (name: string): string =>
  name
    .replace(/[\/\\]/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

/**
 * The picture URLs to try for one aircraft, best first.
 *
 * 1. A picture uploaded to the local server (`imagesMap`), so an upload
 *    replaces the shipped one.
 * 2. The picture shipped with the game (`bundledImages`).
 *
 * `bundledImages` is passed in rather than imported, so this file still runs
 * outside Vite (unit tests).
 */
export const getAircraftImageCandidates = (
  safeName: string,
  manufacturer?: string,
  type?: string,
  imagesMap?: Record<string, string>,
  bundledImages?: Record<string, string>
): string[] => {
  const fullName = (safeName || `${manufacturer || ''} ${type || ''}`).trim();
  const stems = [aircraftImageStem(fullName)];
  if (manufacturer && type) stems.push(aircraftImageStem(`${manufacturer} ${type}`));

  const candidates: string[] = [];
  if (imagesMap) {
    // The server names its folders either by stem or by the plain aircraft name.
    for (const key of [...stems, fullName.replace(/[\/\\]/g, '-'), safeName]) {
      if (imagesMap[key]) candidates.push(imagesMap[key]);
    }
  }
  if (bundledImages) {
    for (const stem of stems) {
      if (bundledImages[stem]) candidates.push(bundledImages[stem]);
    }
  }
  return Array.from(new Set(candidates));
};

/**
 * The server's map of uploaded aircraft pictures, fetched once per session.
 *
 * Every open of the details modal and of the market used to request it again.
 * On the static GitHub Pages build there is no server at all, so each of those
 * requests failed and logged an error. A failed or non-JSON answer now counts
 * as "no uploaded pictures" for the rest of the session. `refresh` forces a new
 * request, for after an upload.
 */
let imagesMapPromise: Promise<Record<string, string>> | null = null;

export function loadAircraftImagesMap(refresh = false): Promise<Record<string, string>> {
  if (!imagesMapPromise || refresh) {
    imagesMapPromise = fetch('/api/aircraft-images')
      .then(async res => {
        const type = res.headers.get('content-type') || '';
        if (!res.ok || !type.includes('application/json')) {
          logDebug('images', `No image API here (status ${res.status}); using bundled pictures only`);
          return {};
        }
        const data = await res.json();
        return data && typeof data === 'object' ? (data as Record<string, string>) : {};
      })
      .catch(err => {
        logDebug('images', 'Image API unreachable', err);
        return {};
      });
  }
  return imagesMapPromise;
}
