import { useEffect, useState } from 'react';
import { logWarn } from '../../lib/debugLog';

// Older WebKit/Blink builds only have the prefixed names.
type FullscreenDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void> | void;
};

const fsDocument = () => document as FullscreenDocument;
const currentElement = () => fsDocument().fullscreenElement ?? fsDocument().webkitFullscreenElement ?? null;

/**
 * Started from the home screen as an installed app (manifest.webmanifest asks
 * for full screen), there is no browser UI left to hide.
 */
const launchedAsApp = () =>
  typeof window.matchMedia === 'function' &&
  (window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: standalone)').matches);

/**
 * Full screen for the whole page. On a phone the browser's address bar and the
 * system bars take a large share of the screen, sideways especially, and the
 * address bar never slides away on its own because the page itself does not
 * scroll.
 *
 * `supported` is false where the browser cannot do it (iPhone browsers only
 * allow videos to go full screen) and when the game already runs as an app.
 */
export function useFullscreen(): { supported: boolean; active: boolean; toggle: () => void } {
  const [active, setActive] = useState(() => currentElement() !== null);
  // Read once, at start: `display-mode: fullscreen` also matches while this
  // hook's own full screen is on, which would hide the button to leave it.
  const [asApp] = useState(launchedAsApp);
  const supported = !asApp && Boolean(fsDocument().fullscreenEnabled ?? fsDocument().webkitFullscreenEnabled);

  useEffect(() => {
    const onChange = () => setActive(currentElement() !== null);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const toggle = () => {
    // Either call can be refused (no user gesture, a permissions policy); the
    // page simply stays as it is, so the refusal is only logged.
    const refused = (err: unknown) => logWarn('fullscreen', 'request refused', err);
    try {
      if (currentElement()) {
        const doc = fsDocument();
        Promise.resolve((doc.exitFullscreen ?? doc.webkitExitFullscreen)?.call(doc)).catch(refused);
      } else {
        const root = document.documentElement as FullscreenElement;
        Promise.resolve((root.requestFullscreen ?? root.webkitRequestFullscreen)?.call(root, { navigationUI: 'hide' })).catch(refused);
      }
    } catch (err) {
      refused(err);
    }
  };

  return { supported, active, toggle };
}
