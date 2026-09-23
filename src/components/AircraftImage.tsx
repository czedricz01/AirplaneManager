import React, { useState, useEffect, useMemo } from 'react';
import { Plane } from 'lucide-react';
import { getAircraftImageCandidates, markImageUrlFailed } from '../lib/imageUtils';

interface AircraftImageProps {
  safeName: string;
  manufacturer?: string;
  type?: string;
  imagesMap?: Record<string, string>;
  keyLookup?: string;
  className?: string;
  alt?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}

export const AircraftImage: React.FC<AircraftImageProps> = ({
  safeName,
  manufacturer,
  type,
  imagesMap,
  keyLookup,
  className = "w-full h-full object-cover",
  alt,
  referrerPolicy = "no-referrer"
}) => {
  const [candidateIndex, setCandidateIndex] = useState(0);

  const candidates = useMemo(
    () => getAircraftImageCandidates(safeName, manufacturer, type, imagesMap, keyLookup),
    [safeName, manufacturer, type, imagesMap, keyLookup]
  );

  // Reset index when the candidate list itself changes. Comparing the memoised array
  // by identity avoids re-serialising imagesMap on every render.
  useEffect(() => {
    setCandidateIndex(0);
  }, [candidates]);

  const handleImageError = () => {
    // Remember the miss so no other card retries this URL in this session.
    const failed = candidates[candidateIndex];
    if (failed) markImageUrlFailed(failed);

    if (candidateIndex < candidates.length - 1) {
      setCandidateIndex(prev => prev + 1);
    } else {
      setCandidateIndex(candidates.length); // Out of bounds -> show fallback UI
    }
  };

  const currentSrc = candidates[candidateIndex];

  if (!currentSrc || candidateIndex >= candidates.length) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-white/20 font-mono text-center px-4 bg-black/60 border border-white/5 rounded-sm">
        <Plane size={36} className="mb-2 text-aero-yellow/40" />
        <span className="uppercase tracking-widest text-[11px] font-bold text-white/50">
          {manufacturer || ''} {type || safeName}
        </span>
        <span className="text-[9px] mt-1 text-white/30 uppercase tracking-wider">Visual Identification Required</span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt || `${manufacturer || ''} ${type || safeName}`}
      className={className}
      // Expanding a manufacturer in the market fired 40-60 requests at once,
      // including every aircraft scrolled off screen. The browser now waits
      // until each one is close to the viewport.
      loading="lazy"
      decoding="async"
      onError={handleImageError}
      referrerPolicy={referrerPolicy}
    />
  );
};
