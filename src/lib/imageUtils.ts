import { readString, writeString, removeKey } from './safeStorage';
import { logDebug } from './debugLog';

export const DEFAULT_SUPABASE_BUCKET_URLS = [
  'https://vupjxnkwagemsiafwgve.supabase.co/storage/v1/object/public/PlanePics',
  'https://vupjxnkwagemsiafwgve.storage.supabase.co/storage/v1/s3/PlanePics'
];

export const getExternalImageBaseUrl = (): string => {
  return readString('supabase_bucket_url') || readString('external_image_base_url') || DEFAULT_SUPABASE_BUCKET_URLS[0];
};

export const setExternalImageBaseUrl = (url: string) => {
  if (typeof window === 'undefined') return;
  const cleaned = url ? url.trim().replace(/\/+$/, '') : '';
  if (!cleaned) {
    removeKey('external_image_base_url');
    removeKey('supabase_bucket_url');
  } else {
    writeString('external_image_base_url', cleaned);
    writeString('supabase_bucket_url', cleaned);
  }
  // A new bucket means the cached candidate lists and the 404 memory are stale.
  clearAircraftImageCandidateCache();
  clearFailedImageUrls();
};

export const getSupabaseBucketUrl = (): string => {
  return getExternalImageBaseUrl();
};

export const setSupabaseBucketUrl = (url: string) => {
  setExternalImageBaseUrl(url);
};

/**
 * Remote URLs that have already failed once in this session.
 *
 * The candidate list is a series of guesses at a filename, and every miss costs a
 * real HTTP request. Without this, a catalogue of a few hundred aircraft could fire
 * tens of thousands of 404s, because each card rediscovers the same dead URLs.
 */
const failedImageUrls = new Set<string>();

export const markImageUrlFailed = (url: string) => {
  if (url) failedImageUrls.add(url);
};


export const clearFailedImageUrls = () => failedImageUrls.clear();

/** Upper bound on remote guesses per aircraft. Enough to cover the common naming
 *  conventions without turning one missing picture into a request storm. */
const MAX_REMOTE_CANDIDATES = 24;

const candidateCache = new Map<string, string[]>();
let candidateCacheImagesMap: Record<string, string> | undefined;

export const clearAircraftImageCandidateCache = () => {
  candidateCache.clear();
  candidateCacheImagesMap = undefined;
};

export const getAircraftImageCandidates = (
  safeName: string,
  manufacturer?: string,
  type?: string,
  imagesMap?: Record<string, string>,
  keyLookup?: string
): string[] => {
  // The list depends only on these inputs, so build it once per aircraft rather than
  // on every render of every card showing that aircraft.
  if (imagesMap !== candidateCacheImagesMap) {
    candidateCache.clear();
    candidateCacheImagesMap = imagesMap;
  }
  const cacheKey = `${safeName}|${manufacturer || ''}|${type || ''}|${keyLookup || ''}`;
  const cached = candidateCache.get(cacheKey);
  if (cached) return cached;

  const localCandidates: string[] = [];
  const remoteCandidates: string[] = [];
  const userBaseUrl = readString('supabase_bucket_url') || readString('external_image_base_url');

  const baseUrls: string[] = [];
  if (userBaseUrl && userBaseUrl.trim()) {
    const cleanUserUrl = userBaseUrl.trim().replace(/\/+$/, '');
    baseUrls.push(cleanUserUrl);
    if (!cleanUserUrl.endsWith('/PlanePics')) {
      baseUrls.push(`${cleanUserUrl}/PlanePics`);
    }
  }

  // Add built-in defaults
  DEFAULT_SUPABASE_BUCKET_URLS.forEach(url => {
    const cleanUrl = url.replace(/\/+$/, '');
    if (!baseUrls.includes(cleanUrl)) {
      baseUrls.push(cleanUrl);
    }
  });

  // Construct search stems for filenames
  const rawFullName = (safeName || `${manufacturer || ''} ${type || ''}`).trim();
  const cleanSafeName = rawFullName.replace(/[\/\\]/g, '-').trim();

  const stems: string[] = [];

  // 1. Underscore all lower: "Airbus A220-100" -> "airbus_a220_100" / "ATR ATR 42-500" -> "atr_atr_42_500"
  const underscoreLower = cleanSafeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (underscoreLower) stems.push(underscoreLower);

  // 2. Underscore mixed case: "ATR ATR 42-500" -> "ATR_ATR_42_500" / "airbus A320" -> "airbus_A320"
  const underscoreMixed = cleanSafeName
    .replace(/[\s\-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (underscoreMixed && !stems.includes(underscoreMixed)) stems.push(underscoreMixed);

  // 3. If manufacturer and type are provided separately
  if (manufacturer && type) {
    const mfgTypeLower = `${manufacturer}_${type}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (mfgTypeLower && !stems.includes(mfgTypeLower)) stems.push(mfgTypeLower);

    const mfgTypeMixed = `${manufacturer}_${type}`
      .replace(/[\s\-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (mfgTypeMixed && !stems.includes(mfgTypeMixed)) stems.push(mfgTypeMixed);
  }

  // 4. Hyphenated lower: "airbus-a220-100"
  const hyphenatedLower = cleanSafeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (hyphenatedLower && !stems.includes(hyphenatedLower)) stems.push(hyphenatedLower);

  // 5. Hyphenated mixed case: "Airbus-A220-100"
  const hyphenatedMixed = cleanSafeName
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (hyphenatedMixed && !stems.includes(hyphenatedMixed)) stems.push(hyphenatedMixed);

  // 6. Type only stem: "a220_100" or "a320"
  if (type) {
    const typeLower = type.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (typeLower && !stems.includes(typeLower)) stems.push(typeLower);
  }

  // 7. Clean safe name directly
  if (cleanSafeName && !stems.includes(cleanSafeName)) stems.push(cleanSafeName);

  const extensions = ['.jpg', '.png', '.webp', '.jpeg'];

  // Images the local server actually reported, and bundled fallbacks, come FIRST:
  // they are known to exist, so the remote guessing below usually never runs.
  if (imagesMap) {
    if (imagesMap[underscoreLower]) localCandidates.push(imagesMap[underscoreLower]);
    if (imagesMap[cleanSafeName]) localCandidates.push(imagesMap[cleanSafeName]);
    if (imagesMap[safeName]) localCandidates.push(imagesMap[safeName]);
  }

  // Generate bucket candidate URLs for each stem & extension
  baseUrls.forEach(base => {
    stems.forEach(stem => {
      extensions.forEach(ext => {
        remoteCandidates.push(`${base}/${encodeURIComponent(stem)}${ext}`);
      });
      // Also check subfolder structure: base/stem/image.ext
      extensions.forEach(ext => {
        remoteCandidates.push(`${base}/${encodeURIComponent(stem)}/image${ext}`);
      });
    });
  });

  // Drop URLs already known to 404, then cap what is left.
  const liveRemote = Array.from(new Set(remoteCandidates))
    .filter(url => !failedImageUrls.has(url))
    .slice(0, MAX_REMOTE_CANDIDATES);

  // Deduplicate candidates preserving priority order
  const result = Array.from(new Set([...localCandidates, ...liveRemote]));
  candidateCache.set(cacheKey, result);
  return result;
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
          logDebug('images', `No image API here (status ${res.status}); using bundled and remote pictures only`);
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
