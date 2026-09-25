import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import type { Edition } from '../lib/newspaper';

/** A newspaper face that needs no web font: every platform has one of these. */
const SERIF = 'Georgia, "Times New Roman", Times, "Liberation Serif", serif';
const PAPER = '#f4efe2';
const INK = '#1d1b17';
const RULE = 'rgba(29, 27, 23, 0.55)';

export interface NewspaperOverlayProps {
  edition: Edition | null;
  open: boolean;
  onClose: () => void;
}

/**
 * The month's newspaper, spun onto the screen the way old films showed the
 * headlines. Closes on the button, on Escape and on a click beside the page.
 * With reduced motion it simply fades in.
 */
export function NewspaperOverlay({ edition, open, onClose }: NewspaperOverlayProps) {
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const spin = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } }
    : {
        initial: { opacity: 0, scale: 0.15, rotate: -540 },
        animate: { opacity: 1, scale: 1, rotate: 0 },
        exit: { opacity: 0, scale: 0.9, rotate: 0 },
        transition: { duration: 0.85, ease: [0.2, 0.8, 0.25, 1] as const }
      };

  return (
    <AnimatePresence>
      {open && edition && (
        <motion.div
          key="newspaper"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // Below the app's alerts (z-[5000]), so an alert raised meanwhile stays on top.
          className="absolute inset-0 z-[4900] bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-hidden"
          onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.article
            {...spin}
            role="dialog"
            aria-modal="true"
            aria-labelledby="newspaper-headline"
            className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto custom-scrollbar shadow-[0_30px_80px_rgba(0,0,0,0.7)] px-5 sm:px-8 py-6"
            style={{ background: PAPER, color: INK, fontFamily: SERIF }}
          >
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close the newspaper"
              className="absolute top-2 right-2 p-1.5 rounded-sm text-black/50 hover:text-black hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black/40"
            >
              <X size={20} />
            </button>

            {/* Masthead */}
            <header className="text-center">
              <div className="flex items-end justify-between gap-2 text-[11px] uppercase tracking-[0.2em] pb-1 pr-8" style={{ borderBottom: `1px solid ${RULE}` }}>
                <span>{edition.issue}</span>
                <span className="hidden sm:inline">Est. 1960</span>
                <span>{edition.price}</span>
              </div>
              <h2 className="font-black leading-none tracking-tight py-2 text-4xl sm:text-6xl" style={{ fontFamily: SERIF }}>
                {edition.masthead}
              </h2>
              <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.2em] py-1" style={{ borderTop: `3px double ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
                <span>Monthly edition</span>
                <span className="font-bold">{edition.date}</span>
                <span className="hidden sm:inline">All the news that flies</span>
              </div>
            </header>

            {/* Front page */}
            <section className="pt-4 pb-3" style={{ borderBottom: `1px solid ${RULE}` }}>
              <h3 id="newspaper-headline" className="font-black leading-[1.05] text-3xl sm:text-5xl text-center" style={{ fontFamily: SERIF }}>
                {edition.headline}
              </h3>
              <p className="italic text-center text-base sm:text-lg mt-2 opacity-80">{edition.subhead}</p>
              {/* flow-root keeps the drop cap inside the paragraph when the lead is a single line. */}
              <p className="flow-root mt-3 text-[15px] leading-relaxed max-w-3xl mx-auto first-letter:float-left first-letter:text-5xl first-letter:leading-[0.85] first-letter:font-black first-letter:mr-2 first-letter:mt-1">
                {edition.lead}
              </p>
            </section>

            {/* Columns */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${edition.columns.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-x-5 gap-y-4 pt-3`}>
              {edition.columns.map((c, i) => (
                <section
                  key={c.title}
                  // A rule between columns side by side: every second one on two
                  // columns, every one but the first on three or four.
                  className={`text-[13px] leading-snug ${i % 2 === 1 ? 'sm:border-l sm:pl-5' : i > 0 ? 'lg:border-l lg:pl-5' : ''}`}
                  style={{ borderColor: RULE }}
                >
                  <h4 className="font-bold uppercase tracking-wider text-[12px] pb-1 mb-1.5" style={{ borderBottom: `1px solid ${RULE}` }}>
                    {c.title}
                  </h4>
                  <p className="text-justify hyphens-auto">{c.body}</p>
                </section>
              ))}
            </div>

            {/* Market ticker */}
            {edition.ticker.length > 0 && (
              <footer className="mt-4 pt-2 flex flex-wrap justify-center gap-x-6 gap-y-1 text-[11px] uppercase tracking-widest font-mono" style={{ borderTop: `3px double ${RULE}` }}>
                {edition.ticker.map(t => (
                  <span key={t.label} className="whitespace-nowrap">
                    <span className="opacity-60">{t.label}</span> <span className="font-bold">{t.value}</span>
                    {t.trend && t.trend !== '0%' && <span className="opacity-60"> {t.trend}</span>}
                  </span>
                ))}
              </footer>
            )}
          </motion.article>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
