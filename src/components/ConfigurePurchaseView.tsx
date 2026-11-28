import { clickOnKey } from '../lib/a11y';
import React, { useState, useMemo, useEffect } from 'react';
import { formatCurrency, formatNumber, yearOf } from '../lib/format';
import { Aircraft, aircraftList } from '../data/aircraft';
import { cabinExtras, classInterior } from '../lib/modelBridge';
import { cabinQuote, extraOffers, featureOffers, seatTypeOffers, type CabinChoice, type CabinPartOffer } from '../lib/modelCabin';
import { CABIN_CLASSES, CABIN_EXPECTATION, CABIN_EXTRA_SPACE_CM, CABIN_EXTRA_SPACE_GAIN, INTERIOR_SHARE, TYPE_APPEAL_SHARE, type CabinClass, type CabinExtra } from '../model/constants';
import type { OwnedAircraft } from './MyFleetView';
import { Minus, Plus, Info, Settings, X, Download, Trash2 } from 'lucide-react';
// The shared version of what used to be a local SeatInfoTooltip here; the rest of
// the interface needs the same affordance, so it now lives in its own module.
import { InfoTooltip as SeatInfoTooltip } from './InfoTooltip';
import { useTapReveal } from './ui/useTapReveal';
import { useCloudConfigs } from '../lib/useCloudConfigs';
import type { ConfigItem } from '../lib/configStore';
import { OverwritePicker } from './ui/OverwritePicker';
import { Details } from './ui/Details';

/** A cabin layout saved for one aircraft type, kept with the account. */
type SavedPreset = ConfigItem & {
  aircraftId: string;
  baseInteriorPop: number;
  config: any;
  createdAt: number;
};

export type ClassSetup = {
  seats: number;
  pitch: number;
  seatType: string;
  hasIFE: boolean;
  hasPower: boolean;
  // Economy
  hasHooks?: boolean; 
  hasMovableArmrests?: boolean;
  hasAdjHeadrests?: boolean;
  hasFixedShell?: boolean;
  hasPedHolder?: boolean;
  // Premium
  hasCocktailTable?: boolean;
  hasCalfRest?: boolean;
  hasFootrests?: boolean;
  hasGooseneckLight?: boolean;
  hasUSBC?: boolean;
  // Business
  hasLumbarSupport?: boolean;
  hasElecSeatControl?: boolean;
  hasMassage?: boolean;
  hasPrivacyDivider?: boolean;
  hasInductiveCharging?: boolean;
  // First
  hasWardrobe?: boolean;
  hasWoodLeather?: boolean;
  hasMirrors?: boolean;
  hasMinibar?: boolean;
  hasActiveClimate?: boolean;
};

export type ConfigOutput = {
  first: number;
  business: number;
  premium: number;
  economy: number;
  details: {
    first: ClassSetup;
    business: ClassSetup;
    premium: ClassSetup;
    economy: ClassSetup;
    hasWifi?: boolean;
    hasAmbientLighting?: boolean;
    hasPremiumCatering?: boolean;
    hasOnboardBar?: boolean;
    hasShower?: boolean;
    hasReducedGalley?: boolean;
    hasMinimalServices?: boolean;
  };
};

interface Props {
  aircraft: Aircraft;
  capital: number;
  currentDateOffset: number; // 0 = Jan 1960
  initialPlane?: OwnedAircraft | null;
  fleet?: OwnedAircraft[];
  onCancel: () => void;
  onConfirmPurchase: (
    aircraft: Aircraft, 
    quantity: number, 
    config: ConfigOutput,
    baseInteriorPop: number,
    totalCost: number
  ) => void;
}

type ClassType = 'first' | 'business' | 'premium' | 'economy';

/** Points in the interior score (model, SPEZIFIKATION 2.3), with sign. */
const signedPts = (v: number) => `${v > 0 ? '+' : ''}${formatNumber(v, Number.isInteger(v) ? 0 : 1)} interior score pts`;

/** A price in the dialog, with sign: +$1,200 / -$25,000. */
const signedPrice = (v: number) => `${v < 0 ? '-' : '+'}${formatCurrency(Math.abs(v))}`;

/** Short note under a part: its price, or when it can be fitted. */
function partSub(o: CabinPartOffer, perSeat: boolean): string {
  if (!o.deliverable) {
    if (o.minCapacity !== undefined && o.availableFrom <= 0) return `Req. ${o.minCapacity}+ seats`;
    if (o.minCapacity !== undefined) return `Avail. ${yearOf(o.availableFrom)}, ${o.minCapacity}+ seats`;
    return `Avail. ${yearOf(o.availableFrom)}`;
  }
  return `${signedPrice(o.price)}${perSeat ? ' / seat' : ''}`;
}

/** What a cabin-wide extra does to the cabin space, for its tooltip (model, SPEZIFIKATION 7.5). */
function extraSpaceNote(key: CabinExtra): string {
  const cm = CABIN_EXTRA_SPACE_CM[key];
  const gain = CABIN_EXTRA_SPACE_GAIN[key];
  if (cm) return `\n-${formatNumber(cm)} cm cabin space`;
  if (gain) return `\n+${formatNumber(gain * 100)}% cabin space`;
  return '';
}

/** Tooltip lines of a cabin-wide extra: points, price, space and, if it cannot be fitted yet, why. */
function extraDetails(o: CabinPartOffer<CabinExtra>): string {
  let text = `\n\n${signedPts(o.points)}\n${signedPrice(o.price)} upfront${extraSpaceNote(o.key)}`;
  if (!o.deliverable) {
    const needs = [`year ${yearOf(o.availableFrom)}+`];
    if (o.minCapacity !== undefined) needs.push(`a type with ${o.minCapacity}+ seats`);
    text += `\n\nRequires ${needs.join(' and ')}.`;
  }
  return text;
}

type SeatColors = { seat: string; back: string; body: string };

/** Seat colours per cabin in the diagram. */
const SEAT_COLORS: Record<ClassType, SeatColors> = {
  first: { seat: 'bg-accent', back: 'bg-accent', body: 'bg-accent/80' },
  business: { seat: 'bg-raised', back: 'bg-raised', body: 'bg-surface' },
  premium: { seat: 'bg-accent', back: 'bg-accent', body: 'bg-accent/80' },
  economy: { seat: 'bg-raised', back: 'bg-raised', body: 'bg-raised/80' },
};

/** Whether an aisle follows seat column `c` in a row `abreast` seats wide. */
function isAisleAfter(abreast: number, c: number, acClass: string): boolean {
  if (abreast === 10) return c === 2 || c === 6;
  if (abreast === 9) return c === 2 || c === 5;
  if (abreast === 8) return c === 1 || c === 5;
  if (abreast === 7) return c === 1 || c === 4;
  if (abreast === 6) return acClass === 'Widebody' ? (c === 1 || c === 3) : c === 2;
  if (abreast === 5) return c === 1;
  if (abreast === 4) return acClass === 'Widebody' ? (c === 0 || c === 2) : c === 1;
  if (abreast === 3 || abreast === 2) return c === 0;
  return false;
}

interface SeatRowProps {
  seatsInRow: number;
  abreast: number;
  cls: ClassType;
  acClass: string;
  isSuite: boolean;
  isFlatBed: boolean;
}

/**
 * One row of seats in the cabin diagram.
 *
 * Memoised on a handful of plain values: moving a slider by one seat changes
 * the last row of a cabin, and every other row -- several hundred elements on
 * a widebody -- is skipped instead of rebuilt.
 */
const SeatRow = React.memo(function SeatRow({ seatsInRow, abreast, cls, acClass, isSuite, isFlatBed }: SeatRowProps) {
  const { seat: seatColor, back: backColor, body: bodyColor } = SEAT_COLORS[cls];
  const armrest = cls === 'economy' ? 'bg-raised' : 'bg-raised';
  return (
    <div className="flex-1 flex flex-col items-stretch justify-between h-full gap-0">
      {Array.from({ length: abreast }).map((_, c) => {
        const isAisle = isAisleAfter(abreast, c, acClass);
        const isVisible = c < seatsInRow;

        return (
          <div key={c}
               className={`relative flex-1 flex flex-col justify-between overflow-hidden rounded-sm ${
                 isSuite ? 'border border-rule bg-raised' : `${bodyColor} border border-line`
               }`}
               style={{
                  marginBottom: isAisle ? (cls === 'first' && !isSuite ? (acClass === 'Regional' ? '24px' : '44px') : (acClass === 'Regional' ? '8px' : '14px')) : '1px',
                  visibility: isVisible ? 'visible' : 'hidden',
                  marginRight: '45%'
               }}>
              {isSuite ? (
                <div className="absolute inset-[1px] flex items-center justify-center">
                   <div className={`w-full h-full ${backColor} rounded-sm`} />
                   <div className={`absolute left-0 w-[40%] h-full ${seatColor} rounded-l-sm`} />
                </div>
              ) : isFlatBed ? (
                <div className="w-full h-full flex flex-row">
                   <div className={`w-[70%] h-full ${seatColor} rounded-l-sm`} />
                   <div className={`w-[30%] h-full ${backColor} rounded-r-sm`} />
                </div>
              ) : (
                <>
                  {/* Seat Cushion: rounded at the front (nose-facing) edge, shaded towards the back */}
                  <div className={`absolute inset-y-0 left-[6%] right-[26%] rounded-l-sm ${seatColor} bg-gradient-to-r from-transparent to-ground`} />
                  {/* Seat Back */}
                  <div className={`absolute inset-y-0 right-0 w-[26%] ${backColor} border-l border-line rounded-r-sm`} />
                  {/* Headrest, narrower than the backrest so its curve reads as a headrest bump */}
                  <div className="absolute right-[3%] top-[18%] bottom-[18%] w-[14%] bg-raised rounded-full" />
                  {/* Armrests separating neighbouring seats */}
                  <div className={`absolute top-0 left-[4%] right-[24%] h-[1px] ${armrest}`} />
                  <div className={`absolute bottom-0 left-[4%] right-[24%] h-[1px] ${armrest}`} />
                </>
              )}
          </div>
        );
      })}
    </div>
  );
});

interface SeatBlockProps {
  count: number;
  cls: ClassType;
  type: string;
  acClass: string;
}

/**
 * All seats of one cabin in the diagram.
 *
 * This was a render function inside the view, so every change anywhere on the
 * page -- a slider step, a ticked extra, the pointer entering a cabin zone --
 * rebuilt every seat of every cabin: over 5,000 elements for an A380. As a
 * memoised component a cabin redraws only when its own seat count or seat
 * type changes.
 */
const SeatBlock = React.memo(function SeatBlock({ count, cls, type, acClass }: SeatBlockProps) {
  let abreast = 6;
  if (acClass === 'Widebody') abreast = cls === 'first' ? 4 : (cls === 'business' ? 6 : (cls === 'premium' ? 8 : 10));
  else if (acClass === 'Narrowbody') abreast = cls === 'first' ? 2 : (cls === 'business' ? 4 : (cls === 'premium' ? 5 : 6));
  else abreast = cls === 'first' ? 2 : (cls === 'business' ? 3 : (cls === 'premium' ? 4 : 4));

  const isSuite = type.includes('Suite') || type === 'Residence';
  const isFlatBed = type.includes('Flat') || type === 'Sleeper';

  const rows = Math.ceil(count / abreast);

  return (
     <div className="absolute inset-0 flex flex-row items-stretch justify-start overflow-hidden pointer-events-none gap-[1px]">
        {Array.from({ length: rows }).map((_, r) => (
          <SeatRow
            key={r}
            seatsInRow={Math.min(abreast, count - (r * abreast))}
            abreast={abreast}
            cls={cls}
            acClass={acClass}
            isSuite={isSuite}
            isFlatBed={isFlatBed}
          />
        ))}
     </div>
  );
});

export function ConfigurePurchaseView({ aircraft, capital, currentDateOffset, initialPlane, fleet = [], onCancel, onConfirmPurchase }: Props) {
  const isRenovating = !!initialPlane;

  const [quantity, setQuantity] = useState(1);
  const [showLoadConfig, setShowLoadConfig] = useState(false);
  const [showSaveConfig, setShowSaveConfig] = useState(false);
  const [savePresetName, setSavePresetName] = useState("");
  // 'aero_saved_presets' is where versions before accounts kept them.
  const { items: savedPresets, save: savePreset, remove: removePreset } = useCloudConfigs<SavedPreset>('aircraft_preset', 'aero_saved_presets');
  // The preset the next save replaces; null stores a new one.
  const [overwritePresetId, setOverwritePresetId] = useState<string | null>(null);
  useEffect(() => { if (!showSaveConfig) setOverwritePresetId(null); }, [showSaveConfig]);
  const [activeConfigTab, setActiveConfigTab] = useState<'general' | 'classes'>('classes');
  const [selectedClass, setSelectedClass] = useState<ClassType | null>(null);
  // Which cabin zone's details show under the diagram: the hovered one with a
  // mouse, or for a moment the tapped one on a touch screen.
  const [hoverZone, setHoverZone] = useState<ClassType | null>(null);
  const [tappedZone, onZoneTap] = useTapReveal<ClassType>();
  const shownZone = hoverZone ?? tappedZone;
  const zonePointer = (zone: ClassType) => ({
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') setHoverZone(zone); },
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') setHoverZone(null); },
    onPointerUp: onZoneTap(zone),
  });

  // Extras state
  const [hasWifi, setHasWifi] = useState(initialPlane?.config?.details?.hasWifi ?? false);
  const [hasAmbientLighting, setHasAmbientLighting] = useState(initialPlane?.config?.details?.hasAmbientLighting ?? false);
  const [hasPremiumCatering, setHasPremiumCatering] = useState(initialPlane?.config?.details?.hasPremiumCatering ?? false);
  const [hasOnboardBar, setHasOnboardBar] = useState(initialPlane?.config?.details?.hasOnboardBar ?? false);
  const [hasShower, setHasShower] = useState(initialPlane?.config?.details?.hasShower ?? false);
  const [hasReducedGalley, setHasReducedGalley] = useState(initialPlane?.config?.details?.hasReducedGalley ?? false);
  const [hasMinimalServices, setHasMinimalServices] = useState(initialPlane?.config?.details?.hasMinimalServices ?? false);

  // First Class
  const [firstSeats, setFirstSeats] = useState(initialPlane?.config?.details?.first?.seats ?? initialPlane?.config?.first ?? 0);
  const [firstPitch, setFirstPitch] = useState(initialPlane?.config?.details?.first?.pitch ?? 180);
  const [firstType, setFirstType] = useState(initialPlane?.config?.details?.first?.seatType ?? 'Standard');
  const [firstIFE, setFirstIFE] = useState(initialPlane?.config?.details?.first?.hasIFE ?? false);
  const [firstPower, setFirstPower] = useState(initialPlane?.config?.details?.first?.hasPower ?? false);
  const [firstWardrobe, setFirstWardrobe] = useState(initialPlane?.config?.details?.first?.hasWardrobe ?? false);
  const [firstWoodLeather, setFirstWoodLeather] = useState(initialPlane?.config?.details?.first?.hasWoodLeather ?? false);
  const [firstMirrors, setFirstMirrors] = useState(initialPlane?.config?.details?.first?.hasMirrors ?? false);
  const [firstMinibar, setFirstMinibar] = useState(initialPlane?.config?.details?.first?.hasMinibar ?? false);
  const [firstActiveClimate, setFirstActiveClimate] = useState(initialPlane?.config?.details?.first?.hasActiveClimate ?? false);

  // Biz Class
  const [bizSeats, setBizSeats] = useState(initialPlane?.config?.details?.business?.seats ?? initialPlane?.config?.business ?? 0);
  const [bizPitch, setBizPitch] = useState(initialPlane?.config?.details?.business?.pitch ?? 120);
  const [bizType, setBizType] = useState(initialPlane?.config?.details?.business?.seatType ?? 'Standard');
  const [bizIFE, setBizIFE] = useState(initialPlane?.config?.details?.business?.hasIFE ?? false);
  const [bizPower, setBizPower] = useState(initialPlane?.config?.details?.business?.hasPower ?? false);
  const [bizLumbarSupport, setBizLumbarSupport] = useState(initialPlane?.config?.details?.business?.hasLumbarSupport ?? false);
  const [bizElecSeatControl, setBizElecSeatControl] = useState(initialPlane?.config?.details?.business?.hasElecSeatControl ?? false);
  const [bizMassage, setBizMassage] = useState(initialPlane?.config?.details?.business?.hasMassage ?? false);
  const [bizPrivacyDivider, setBizPrivacyDivider] = useState(initialPlane?.config?.details?.business?.hasPrivacyDivider ?? false);
  const [bizInductiveCharging, setBizInductiveCharging] = useState(initialPlane?.config?.details?.business?.hasInductiveCharging ?? false);

  // Premium Class
  const [premSeats, setPremSeats] = useState(initialPlane?.config?.details?.premium?.seats ?? initialPlane?.config?.premium ?? 0);
  const [premPitch, setPremPitch] = useState(initialPlane?.config?.details?.premium?.pitch ?? 90);
  const [premType, setPremType] = useState(initialPlane?.config?.details?.premium?.seatType ?? 'Standard');
  const [premIFE, setPremIFE] = useState(initialPlane?.config?.details?.premium?.hasIFE ?? false);
  const [premPower, setPremPower] = useState(initialPlane?.config?.details?.premium?.hasPower ?? false);
  const [premCocktailTable, setPremCocktailTable] = useState(initialPlane?.config?.details?.premium?.hasCocktailTable ?? false);
  const [premCalfRest, setPremCalfRest] = useState(initialPlane?.config?.details?.premium?.hasCalfRest ?? false);
  const [premFootrests, setPremFootrests] = useState(initialPlane?.config?.details?.premium?.hasFootrests ?? false);
  const [premGooseneckLight, setPremGooseneckLight] = useState(initialPlane?.config?.details?.premium?.hasGooseneckLight ?? false);
  const [premUSBC, setPremUSBC] = useState(initialPlane?.config?.details?.premium?.hasUSBC ?? false);

  // Economy Class
  const [ecoType, setEcoType] = useState(initialPlane?.config?.details?.economy?.seatType ?? 'Standard');
  const [ecoPitch, setEcoPitch] = useState(initialPlane?.config?.details?.economy?.pitch ?? 74);
  const [ecoIFE, setEcoIFE] = useState(initialPlane?.config?.details?.economy?.hasIFE ?? false);
  const [ecoPower, setEcoPower] = useState(initialPlane?.config?.details?.economy?.hasPower ?? false);
  const [ecoHooks, setEcoHooks] = useState(initialPlane?.config?.details?.economy?.hasHooks ?? false);
  const [ecoMovableArmrests, setEcoMovableArmrests] = useState(initialPlane?.config?.details?.economy?.hasMovableArmrests ?? false);
  const [ecoAdjHeadrests, setEcoAdjHeadrests] = useState(initialPlane?.config?.details?.economy?.hasAdjHeadrests ?? false);
  const [ecoFixedShell, setEcoFixedShell] = useState(initialPlane?.config?.details?.economy?.hasFixedShell ?? false);
  const [ecoPedHolder, setEcoPedHolder] = useState(initialPlane?.config?.details?.economy?.hasPedHolder ?? false);

  const CAPACITY = aircraft.capacity; // Seats of the type at 74 cm pitch
  // Type values from the catalogue, not the ones carried on an owned aircraft.
  const typeSpec = aircraftList.find(a => a.id === aircraft.id) ?? aircraft;

  // What can be fitted this month, with points and prices (model, SPEZIFIKATION 2.3, 5.13).
  const offers = useMemo(() => {
    const seats = {} as Record<CabinClass, CabinPartOffer[]>;
    const features = {} as Record<CabinClass, Record<string, CabinPartOffer>>;
    for (const c of CABIN_CLASSES) {
      seats[c] = seatTypeOffers(c, currentDateOffset, CAPACITY);
      features[c] = Object.fromEntries(featureOffers(c, currentDateOffset, CAPACITY).map(o => [o.key, o]));
    }
    const extras = Object.fromEntries(extraOffers(currentDateOffset, CAPACITY).map(o => [o.key, o])) as Record<CabinExtra, CabinPartOffer<CabinExtra>>;
    return { seats, features, extras };
  }, [currentDateOffset, CAPACITY]);
  /** Availability, price and points of a seat feature, for the lists below. */
  const feat = (c: CabinClass, key: string) => {
    const o = offers.features[c][key];
    return { req: o.availableFrom, price: o.price, available: o.deliverable, points: o.points };
  };
  const extraOffer = offers.extras;
  const isWifiAvailable = extraOffer.wifi.deliverable;
  const isAmbientAvailable = extraOffer.ambient.deliverable;
  const isCateringAvailable = extraOffer.catering.deliverable;
  const isBarAvailable = extraOffer.bar.deliverable;
  const isShowerAvailable = extraOffer.shower.deliverable;

  // The cabin as chosen, in the form the dialog saves it.
  const classSetups = {
    first: { seats: firstSeats, pitch: firstPitch, seatType: firstType, hasIFE: firstIFE, hasPower: firstPower, hasWardrobe: firstWardrobe, hasWoodLeather: firstWoodLeather, hasMirrors: firstMirrors, hasMinibar: firstMinibar, hasActiveClimate: firstActiveClimate },
    business: { seats: bizSeats, pitch: bizPitch, seatType: bizType, hasIFE: bizIFE, hasPower: bizPower, hasLumbarSupport: bizLumbarSupport, hasElecSeatControl: bizElecSeatControl, hasMassage: bizMassage, hasPrivacyDivider: bizPrivacyDivider, hasInductiveCharging: bizInductiveCharging },
    premium: { seats: premSeats, pitch: premPitch, seatType: premType, hasIFE: premIFE, hasPower: premPower, hasCocktailTable: premCocktailTable, hasCalfRest: premCalfRest, hasFootrests: premFootrests, hasGooseneckLight: premGooseneckLight, hasUSBC: premUSBC },
    economy: { seats: 0, pitch: ecoPitch, seatType: ecoType, hasIFE: ecoIFE, hasPower: ecoPower, hasHooks: ecoHooks, hasMovableArmrests: ecoMovableArmrests, hasAdjHeadrests: ecoAdjHeadrests, hasFixedShell: ecoFixedShell, hasPedHolder: ecoPedHolder },
  };
  const extraFlags = { hasWifi, hasAmbientLighting, hasPremiumCatering, hasOnboardBar, hasShower, hasReducedGalley, hasMinimalServices };
  const choice: CabinChoice = {
    seats: { first: firstSeats, business: bizSeats, premium: premSeats },
    interiors: {
      first: classInterior('first', classSetups.first),
      business: classInterior('business', classSetups.business),
      premium: classInterior('premium', classSetups.premium),
      economy: classInterior('economy', classSetups.economy),
    },
    extras: cabinExtras(extraFlags),
  };

  // Space, seats, interior score, cabin rating and price: all from the model
  // (src/lib/modelCabin.ts), the same functions the month close values the fleet with.
  const quote = cabinQuote(
    typeSpec,
    choice,
    currentDateOffset,
    initialPlane
      ? {
          builtMonth: initialPlane.purchasedAt,
          launchCustomer: initialPlane.launchBonusUntil !== undefined,
          cabinCondition: initialPlane.conditionInterior,
          refitsDone: initialPlane.refitsDone || 0,
        }
      : undefined
  );

  const TOTAL_SPACE = quote.space;
  const ecoSeats = quote.seats.economy;
  const isOverbooked = quote.overbooked;
  const maxFirstSeats = quote.maxSeats.first;
  const maxBizSeats = quote.maxSeats.business;
  const maxPremSeats = quote.maxSeats.premium;
  const extrasSpace = quote.fittedExtras.reduce((sum, e) => sum + (CABIN_EXTRA_SPACE_CM[e] ?? 0), 0);
  const totalSeats = quote.totalSeats;
  const scoreOf = (c: CabinClass) => quote.interior[c].total;

  // The model's interior scores, their mean by seats: stored on the aircraft and the
  // preset only to be shown ("Interior" in the configuration lists); no figure reads it.
  const baseInteriorPop = totalSeats > 0
    ? Math.round(CABIN_CLASSES.reduce((sum, c) => sum + quote.seats[c] * scoreOf(c), 0) / totalSeats)
    : 0;

  const unitPrice = quote.unitPrice;
  const totalPrice = unitPrice * quantity;
  const canAfford = capital >= totalPrice;

  const pFirstRaw = ((firstSeats * quote.seatSpace.first) / TOTAL_SPACE) * 100;
  const pBizRaw = ((bizSeats * quote.seatSpace.business) / TOTAL_SPACE) * 100;
  const pPremRaw = ((premSeats * quote.seatSpace.premium) / TOTAL_SPACE) * 100;
  const pEcoRaw = ((ecoSeats * quote.seatSpace.economy) / TOTAL_SPACE) * 100;

  const totalUsedP = pFirstRaw + pBizRaw + pPremRaw + pEcoRaw;
  const pFirst = totalUsedP > 0 ? (pFirstRaw / totalUsedP) * 100 : 0;
  const pBiz = totalUsedP > 0 ? (pBizRaw / totalUsedP) * 100 : 0;
  const pPrem = totalUsedP > 0 ? (pPremRaw / totalUsedP) * 100 : 0;
  const pEco = totalUsedP > 0 ? (pEcoRaw / totalUsedP) * 100 : 0;


  const handleSavePreset = () => {
    if (!savePresetName.trim()) return;
    
    const preset = {
      // Saving under an existing id replaces that preset (see saveConfig).
      id: overwritePresetId ?? Math.random().toString(36).substring(7),
      aircraftId: aircraft.id,
      name: savePresetName.trim(),
      // The score the purchase itself uses. Presets used to store a different
      // formula (weighted by cabin space, other extra values).
      baseInteriorPop,
      config: {
        first: firstSeats, business: bizSeats, premium: premSeats, economy: ecoSeats,
        details: {
          hasWifi, hasAmbientLighting, hasPremiumCatering, hasOnboardBar, hasShower, hasReducedGalley, hasMinimalServices,
          first: classSetups.first,
          business: classSetups.business,
          premium: classSetups.premium,
          economy: { ...classSetups.economy, seats: ecoSeats }
        }
      },
      createdAt: Date.now()
    };
    savePreset(preset);
    setSavePresetName("");
    setShowSaveConfig(false);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removePreset(id);
  };

  const handleLoadConfig = (plane: any) => {
    const c = plane.config.details;
    if (!c) return;
    
    // Extras
    setHasWifi(c.hasWifi ?? false);
    setHasAmbientLighting(c.hasAmbientLighting ?? false);
    setHasPremiumCatering(c.hasPremiumCatering ?? false);
    setHasOnboardBar(c.hasOnboardBar ?? false);
    setHasShower(c.hasShower ?? false);
    setHasReducedGalley(c.hasReducedGalley ?? false);
    setHasMinimalServices(c.hasMinimalServices ?? false);
    
    // First
    if (c.first) {
      setFirstSeats(c.first.seats ?? 0);
      setFirstPitch(c.first.pitch ?? 180);
      setFirstType(c.first.seatType ?? 'Standard');
      setFirstIFE(c.first.hasIFE ?? false);
      setFirstPower(c.first.hasPower ?? false);
      setFirstWardrobe(c.first.hasWardrobe ?? false);
      setFirstWoodLeather(c.first.hasWoodLeather ?? false);
      setFirstMirrors(c.first.hasMirrors ?? false);
      setFirstMinibar(c.first.hasMinibar ?? false);
      setFirstActiveClimate(c.first.hasActiveClimate ?? false);
    }
    
    // Biz
    if (c.business) {
      setBizSeats(c.business.seats ?? 0);
      setBizPitch(c.business.pitch ?? 120);
      setBizType(c.business.seatType ?? 'Standard');
      setBizIFE(c.business.hasIFE ?? false);
      setBizPower(c.business.hasPower ?? false);
      setBizLumbarSupport(c.business.hasLumbarSupport ?? false);
      setBizElecSeatControl(c.business.hasElecSeatControl ?? false);
      setBizMassage(c.business.hasMassage ?? false);
      setBizPrivacyDivider(c.business.hasPrivacyDivider ?? false);
      setBizInductiveCharging(c.business.hasInductiveCharging ?? false);
    }
    
    // Prem
    if (c.premium) {
      setPremSeats(c.premium.seats ?? 0);
      setPremPitch(c.premium.pitch ?? 90);
      setPremType(c.premium.seatType ?? 'Standard');
      setPremIFE(c.premium.hasIFE ?? false);
      setPremPower(c.premium.hasPower ?? false);
      setPremCocktailTable(c.premium.hasCocktailTable ?? false);
      setPremCalfRest(c.premium.hasCalfRest ?? false);
      setPremFootrests(c.premium.hasFootrests ?? false);
      setPremGooseneckLight(c.premium.hasGooseneckLight ?? false);
      setPremUSBC(c.premium.hasUSBC ?? false);
    }
    
    // Eco
    if (c.economy) {
      // Don't set seats for eco, it's auto-calculated!
      setEcoPitch(c.economy.pitch ?? 74);
      setEcoType(c.economy.seatType ?? 'Standard');
      setEcoIFE(c.economy.hasIFE ?? false);
      setEcoPower(c.economy.hasPower ?? false);
      setEcoHooks(c.economy.hasHooks ?? false);
      setEcoMovableArmrests(c.economy.hasMovableArmrests ?? false);
      setEcoAdjHeadrests(c.economy.hasAdjHeadrests ?? false);
      setEcoFixedShell(c.economy.hasFixedShell ?? false);
      setEcoPedHolder(c.economy.hasPedHolder ?? false);
    }
    
    setShowLoadConfig(false);
  };

  const handleConfirm = () => {
    const output: ConfigOutput = {
      first: firstSeats,
      business: bizSeats,
      premium: premSeats,
      economy: ecoSeats,
      details: {
        first: classSetups.first,
        business: classSetups.business,
        premium: classSetups.premium,
        economy: { ...classSetups.economy, seats: ecoSeats },
        // Only what was actually paid for and fitted. A preset loaded in an
        // earlier year could carry Wi-Fi that was never charged, and
        // details.hasWifi is what unlocks the Wi-Fi cabin services.
        hasWifi: hasWifi && isWifiAvailable,
        hasAmbientLighting: hasAmbientLighting && isAmbientAvailable,
        hasPremiumCatering: hasPremiumCatering && isCateringAvailable,
        hasOnboardBar: hasOnboardBar && isBarAvailable,
        hasShower: hasShower && isShowerAvailable,
        // Both change the usable cabin space. They were not stored, so the
        // next refit started without them and silently changed the seat count.
        hasReducedGalley,
        hasMinimalServices
      } as any
    };
    onConfirmPurchase(initialPlane || aircraft, quantity, output, baseInteriorPop, totalPrice);
  };

  // Each class's details: seat type and pitch beside the soft product, or one
  // above the other on phones, where two half-width columns are too narrow.
  const renderClassDetails = () => {
    if (!selectedClass) return null;

    if (selectedClass === 'first') {
      return (
        <div className="w-full max-w-4xl relative z-10 flex flex-col md:flex-row border border-line bg-ground/60 rounded-sm">
          <div className="w-full md:w-1/2 p-4 border-b md:border-b-0 md:border-r border-line flex flex-col">
            <h3 className="font-label text-sm font-semibold text-ink border-b border-line pb-2 mb-4 text-center">Seat Type & Pitch</h3>
            <div className="flex flex-col gap-3 mb-3">
              <label className="text-xs font-label uppercase tracking-label text-muted">Seat Pitch ({firstPitch} cm)</label>
              <input type="range" min="150" max="220" value={firstPitch} onChange={(e) => setFirstPitch(parseInt(e.target.value))} className="w-full accent-accent" />
              <div className="flex justify-between text-2xs text-muted">
                <span>150 cm</span><span>220 cm</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-grow">
              {offers.seats.first.map((t, i) => {
                const disabled = !t.deliverable;
                return (
                  <label key={i} className={`flex items-center justify-between p-3 border rounded-sm transition-colors cursor-pointer ${disabled ? 'opacity-30 border-line pointer-events-none' : 'hover:bg-raised border-line'} ${firstType === t.key ? 'bg-surface border-accent/50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <input type="radio" checked={firstType === t.key} disabled={disabled} onChange={() => setFirstType(t.key)} className="accent-accent hidden" />
                      <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${firstType === t.key ? 'border-accent' : 'border-rule'}`}>
                        {firstType === t.key && <div className="w-1.5 h-1.5 bg-accent rounded-full" />}
                      </div>
                      <span className={`text-sm font-mono transition-colors ${firstType === t.key ? 'text-accent' : 'text-muted'}`}>{t.key}</span>
                      <SeatInfoTooltip title={t.key} desc={`${signedPts(t.points)}. Space multiplier: ${t.spaceFactor}x.`} hidden={disabled} />
                    </div>
                    <span className={`text-2xs uppercase font-label transition-colors ${firstType === t.key ? 'text-accent opacity-80' : 'text-muted'}`}>
                      {disabled ? `Avail. ${yearOf(t.availableFrom)}` : (t.price ? partSub(t, true) : 'Standard')}
                    </span>
                  </label>
                )
              })}
            </div>
            
          </div>
          <div className="w-full md:w-1/2 p-4 flex flex-col">
            <h3 className="font-label text-sm font-semibold text-ink border-b border-line pb-2 mb-4 text-center">Seat Extras</h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
              {[
                { id: 'ife', state: firstIFE, setter: setFirstIFE, ...feat('first', 'ife'), label: 'In-Flight Ent.', title: 'In-Flight Entertainment', desc: `Personal screens with movies and games. ${signedPts(feat('first', 'ife').points)}.` },
                { id: 'power', state: firstPower, setter: setFirstPower, ...feat('first', 'power'), label: 'In-Seat Power', title: 'In-Seat Power', desc: `Provides AC power/USB ports. ${signedPts(feat('first', 'power').points)}.` },
                { id: 'wardrobe', state: firstWardrobe, setter: setFirstWardrobe, ...feat('first', 'wardrobe'), label: 'Pers. Wardrobe', title: 'Personal Wardrobe', desc: `A slim locker built into the seat shell for suits and coats. ${signedPts(feat('first', 'wardrobe').points)}.` },
                { id: 'wood', state: firstWoodLeather, setter: setFirstWoodLeather, ...feat('first', 'wood'), label: 'Wood/Leather', title: 'Fine Wood & Leather', desc: `High-quality trim on consoles and armrests. ${signedPts(feat('first', 'wood').points)}.` },
                { id: 'mirror', state: firstMirrors, setter: setFirstMirrors, ...feat('first', 'mirror'), label: 'Vanity Mirror', title: 'Illuminated Vanity Mirror', desc: `A vanity mirror built into a fold-out stowage compartment. ${signedPts(feat('first', 'mirror').points)}.` },
                { id: 'minibar', state: firstMinibar, setter: setFirstMinibar, ...feat('first', 'minibar'), label: 'Personal Minibar', title: 'Integrated Minibar', desc: `A private, partly chilled drinks compartment in the side wall. ${signedPts(feat('first', 'minibar').points)}.` },
                { id: 'climate', state: firstActiveClimate, setter: setFirstActiveClimate, ...feat('first', 'climate'), label: 'Active Climate', title: 'Active Seat Climate', desc: `Heating mats and micro fans in cushion and backrest for individual temperature control. ${signedPts(feat('first', 'climate').points)}.` }
              ].sort((a, b) => {
                const aAvail = a.available;
                const bAvail = b.available;
                if (aAvail !== bAvail) return aAvail ? -1 : 1;
                return a.price - b.price;
              }).map(ext => {
                const available = ext.available;
                const activeColor = "text-accent";
                const activeBorder = "border-accent/50";
                const activeBg = "bg-surface";
                
                return (
                  <label key={ext.id} className={`flex items-center gap-3 p-3 transition-colors cursor-pointer rounded-sm border ${!available ? 'opacity-50 pointer-events-none border-line bg-ground/20' : (ext.state ? activeBg + ' ' + activeBorder : 'hover:bg-raised border-line')}`}>
                    <input type="checkbox" checked={ext.state} disabled={!available} onChange={(e) => ext.setter(e.target.checked)} className="accent-accent" />
                    <div className="flex flex-col w-full">
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-sm font-mono transition-colors ${ext.state ? activeColor : 'text-muted'}`}>{ext.label}</span>
                        <SeatInfoTooltip title={ext.title} desc={ext.desc} hidden={!available} />
                      </div>
                      <span className={`text-2xs font-mono mt-0.5 transition-colors ${ext.state ? activeColor + ' opacity-80' : 'text-muted'}`}>
                        {available ? `${signedPrice(ext.price)} / seat` : `Avail. ${yearOf(ext.req)}`}
                      </span>
                    </div>
                  </label>
                );
              })}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (selectedClass === 'business') {
      return (
        <div className="w-full max-w-4xl relative z-10 flex flex-col md:flex-row border border-line bg-ground/60 rounded-sm">
          <div className="w-full md:w-1/2 p-4 border-b md:border-b-0 md:border-r border-line flex flex-col">
            <h3 className="font-label text-sm font-semibold text-ink border-b border-line pb-2 mb-4 text-center">Seat Type & Pitch</h3>
            <div className="flex flex-col gap-3 mb-3">
              <label className="text-xs font-label uppercase tracking-label text-muted">Seat Pitch ({bizPitch} cm)</label>
              <input type="range" min="100" max="180" value={bizPitch} onChange={(e) => setBizPitch(parseInt(e.target.value))} className="w-full accent-accent" />
              <div className="flex justify-between text-2xs text-muted">
                <span>100 cm</span><span>180 cm</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-grow">
              {offers.seats.business.map((t, i) => {
                const disabled = !t.deliverable;
                return (
                  <label key={i} className={`flex items-center justify-between p-3 border rounded-sm transition-colors cursor-pointer ${disabled ? 'opacity-30 border-line pointer-events-none' : 'hover:bg-raised border-line'} ${bizType === t.key ? 'bg-surface border-line' : ''}`}>
                    <div className="flex items-center gap-3">
                      <input type="radio" checked={bizType === t.key} disabled={disabled} onChange={() => setBizType(t.key)} className="accent-accent hidden" />
                      <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${bizType === t.key ? 'border-rule' : 'border-rule'}`}>
                        {bizType === t.key && <div className="w-1.5 h-1.5 bg-raised rounded-full" />}
                      </div>
                      <span className={`text-sm font-mono transition-colors ${bizType === t.key ? 'text-ink' : 'text-muted'}`}>{t.key}</span>
                      <SeatInfoTooltip title={t.key} desc={`${signedPts(t.points)}. Space multiplier: ${t.spaceFactor}x.`} hidden={disabled} />
                    </div>
                    <span className={`text-2xs uppercase font-label transition-colors ${bizType === t.key ? 'text-ink opacity-80' : 'text-muted'}`}>
                      {disabled ? `Avail. ${yearOf(t.availableFrom)}` : (t.price ? partSub(t, true) : 'Standard')}
                    </span>
                  </label>
                )
              })}
            </div>
            
          </div>
          <div className="w-full md:w-1/2 p-4 flex flex-col">
            <h3 className="font-label text-sm font-semibold text-ink border-b border-line pb-2 mb-4 text-center">Seat Extras</h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
              {[
                { id: 'ife', state: bizIFE, setter: setBizIFE, ...feat('business', 'ife'), label: 'In-Flight Ent.', title: 'In-Flight Entertainment', desc: `Personal screens with movies and games. ${signedPts(feat('business', 'ife').points)}.` },
                { id: 'power', state: bizPower, setter: setBizPower, ...feat('business', 'power'), label: 'In-Seat Power', title: 'In-Seat Power', desc: `Provides AC power/USB ports. ${signedPts(feat('business', 'power').points)}.` },
                { id: 'lumbar', state: bizLumbarSupport, setter: setBizLumbarSupport, ...feat('business', 'lumbar'), label: 'Lumbar Support', title: 'Mechanical Lumbar Support', desc: `An adjustable cushion in the lower back for better support. ${signedPts(feat('business', 'lumbar').points)}.` },
                { id: 'control', state: bizElecSeatControl, setter: setBizElecSeatControl, ...feat('business', 'control'), label: 'Elec. Seat Control', title: 'Electric Seat Control', desc: `Continuous adjustment at the push of a button instead of mechanical levers. ${signedPts(feat('business', 'control').points)}.` },
                { id: 'massage', state: bizMassage, setter: setBizMassage, ...feat('business', 'massage'), label: 'Pneumatic Massage', title: 'Pneumatic Massage', desc: `Air cells in the backrest inflate and deflate rhythmically. ${signedPts(feat('business', 'massage').points)}.` },
                { id: 'divider', state: bizPrivacyDivider, setter: setBizPrivacyDivider, ...feat('business', 'divider'), label: 'Privacy Divider', title: 'Motorised Privacy Divider', desc: `A partition to the neighbouring seat that rises at the push of a button. ${signedPts(feat('business', 'divider').points)}.` },
                { id: 'charging', state: bizInductiveCharging, setter: setBizInductiveCharging, ...feat('business', 'charging'), label: 'Inductive Charging', title: 'Inductive Charging Pad', desc: `Wireless charging on the console beside the seat. ${signedPts(feat('business', 'charging').points)}.` }
              ].sort((a, b) => {
                const aAvail = a.available;
                const bAvail = b.available;
                if (aAvail !== bAvail) return aAvail ? -1 : 1;
                return a.price - b.price;
              }).map(ext => {
                const available = ext.available;
                const activeColor = "text-ink";
                const activeBorder = "border-line";
                const activeBg = "bg-surface";
                
                return (
                  <label key={ext.id} className={`flex items-center gap-3 p-3 transition-colors cursor-pointer rounded-sm border ${!available ? 'opacity-50 pointer-events-none border-line bg-ground/20' : (ext.state ? activeBg + ' ' + activeBorder : 'hover:bg-raised border-line')}`}>
                    <input type="checkbox" checked={ext.state} disabled={!available} onChange={(e) => ext.setter(e.target.checked)} className="accent-accent" />
                    <div className="flex flex-col w-full">
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-sm font-mono transition-colors ${ext.state ? activeColor : 'text-muted'}`}>{ext.label}</span>
                        <SeatInfoTooltip title={ext.title} desc={ext.desc} hidden={!available} />
                      </div>
                      <span className={`text-2xs font-mono mt-0.5 transition-colors ${ext.state ? activeColor + ' opacity-80' : 'text-muted'}`}>
                        {available ? `${signedPrice(ext.price)} / seat` : `Avail. ${yearOf(ext.req)}`}
                      </span>
                    </div>
                  </label>
                );
              })}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (selectedClass === 'premium') {
      return (
        <div className="w-full max-w-4xl relative z-10 flex flex-col md:flex-row border border-line bg-ground/60 rounded-sm">
          <div className="w-full md:w-1/2 p-4 border-b md:border-b-0 md:border-r border-line flex flex-col">
            <h3 className="font-label text-sm font-semibold text-ink border-b border-line pb-2 mb-4 text-center">Seat Type & Pitch</h3>
            <div className="flex flex-col gap-3 mb-3">
              <label className="text-xs font-label uppercase tracking-label text-muted">Seat Pitch ({premPitch} cm)</label>
              <input type="range" min="85" max="105" value={premPitch} onChange={(e) => setPremPitch(parseInt(e.target.value))} className="w-full accent-accent" />
              <div className="flex justify-between text-2xs text-muted">
                <span>85 cm</span><span>105 cm</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-grow">
              {offers.seats.premium.map((t, i) => {
                const disabled = !t.deliverable;
                return (
                  <label key={i} className={`flex items-center justify-between p-3 border rounded-sm transition-colors cursor-pointer ${disabled ? 'opacity-30 border-line pointer-events-none' : 'hover:bg-raised border-line'} ${premType === t.key ? 'bg-surface border-accent/50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <input type="radio" checked={premType === t.key} disabled={disabled} onChange={() => setPremType(t.key)} className="accent-accent hidden" />
                      <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${premType === t.key ? 'border-accent' : 'border-rule'}`}>
                        {premType === t.key && <div className="w-1.5 h-1.5 bg-accent rounded-full" />}
                      </div>
                      <span className={`text-sm font-mono transition-colors ${premType === t.key ? 'text-accent' : 'text-muted'}`}>{t.key}</span>
                      <SeatInfoTooltip title={t.key} desc={`${signedPts(t.points)}. Space multiplier: ${t.spaceFactor}x.`} hidden={disabled} />
                    </div>
                    <span className={`text-2xs uppercase font-label transition-colors ${premType === t.key ? 'text-accent opacity-80' : 'text-muted'}`}>
                      {disabled ? `Avail. ${yearOf(t.availableFrom)}` : (t.price ? partSub(t, true) : 'Standard')}
                    </span>
                  </label>
                )
              })}
            </div>
            
          </div>
          <div className="w-full md:w-1/2 p-4 flex flex-col">
            <h3 className="font-label text-sm font-semibold text-ink border-b border-line pb-2 mb-4 text-center">Seat Extras</h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
              {[
                { id: 'ife', state: premIFE, setter: setPremIFE, ...feat('premium', 'ife'), label: 'In-Flight Ent.', title: 'In-Flight Entertainment', desc: `Personal screens with movies and games. ${signedPts(feat('premium', 'ife').points)}.` },
                { id: 'power', state: premPower, setter: setPremPower, ...feat('premium', 'power'), label: 'In-Seat Power', title: 'In-Seat Power', desc: `Provides AC power/USB ports. ${signedPts(feat('premium', 'power').points)}.` },
                { id: 'table', state: premCocktailTable, setter: setPremCocktailTable, ...feat('premium', 'table'), label: 'Cocktail Table', title: 'Integrated Cocktail Table', desc: `A small fixed side table on the armrest. ${signedPts(feat('premium', 'table').points)}.` },
                { id: 'calf', state: premCalfRest, setter: setPremCalfRest, ...feat('premium', 'calf'), label: 'Calf Rest', title: 'Fold-out Calf Rest', desc: `A rest built into the seat that folds up. ${signedPts(feat('premium', 'calf').points)}.` },
                { id: 'foot', state: premFootrests, setter: setPremFootrests, ...feat('premium', 'foot'), label: 'Multi-Stage Footrest', title: 'Multi-Stage Footrest', desc: `Fold-out bars under the seat in front for the feet. ${signedPts(feat('premium', 'foot').points)}.` },
                { id: 'light', state: premGooseneckLight, setter: setPremGooseneckLight, ...feat('premium', 'light'), label: 'Gooseneck Lamp', title: 'Gooseneck Reading Lamp', desc: `An individually adjustable LED reading light at the seat. ${signedPts(feat('premium', 'light').points)}.` },
                { id: 'usbc', state: premUSBC, setter: setPremUSBC, ...feat('premium', 'usbc'), label: 'USB-C Fast Charge', title: 'USB-C Fast Charging', desc: `Fast-charging ports (e.g. 60 W) in the armrest. ${signedPts(feat('premium', 'usbc').points)}.` }
              ].sort((a, b) => {
                const aAvail = a.available;
                const bAvail = b.available;
                if (aAvail !== bAvail) return aAvail ? -1 : 1;
                return a.price - b.price;
              }).map(ext => {
                const available = ext.available;
                const activeColor = "text-accent";
                const activeBorder = "border-accent/50";
                const activeBg = "bg-surface";
                
                return (
                  <label key={ext.id} className={`flex items-center gap-3 p-3 transition-colors cursor-pointer rounded-sm border ${!available ? 'opacity-50 pointer-events-none border-line bg-ground/20' : (ext.state ? activeBg + ' ' + activeBorder : 'hover:bg-raised border-line')}`}>
                    <input type="checkbox" checked={ext.state} disabled={!available} onChange={(e) => ext.setter(e.target.checked)} className="accent-accent" />
                    <div className="flex flex-col w-full">
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-sm font-mono transition-colors ${ext.state ? activeColor : 'text-muted'}`}>{ext.label}</span>
                        <SeatInfoTooltip title={ext.title} desc={ext.desc} hidden={!available} />
                      </div>
                      <span className={`text-2xs font-mono mt-0.5 transition-colors ${ext.state ? activeColor + ' opacity-80' : 'text-muted'}`}>
                        {available ? `${signedPrice(ext.price)} / seat` : `Avail. ${yearOf(ext.req)}`}
                      </span>
                    </div>
                  </label>
                );
              })}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (selectedClass === 'economy') {
      return (
        <div className="w-full max-w-4xl relative z-10 flex flex-col md:flex-row border border-line bg-ground/60 rounded-sm">
          <div className="w-full md:w-1/2 p-4 border-b md:border-b-0 md:border-r border-line flex flex-col">
            <h3 className="font-label text-sm font-semibold text-ink border-b border-line pb-2 mb-4 text-center">Seat Type & Pitch</h3>
            <div className="flex flex-col gap-3 mb-3">
              <label className="text-xs font-label uppercase tracking-label text-muted">Seat Pitch ({ecoPitch} cm)</label>
              <input type="range" min="74" max="90" value={ecoPitch} onChange={(e) => setEcoPitch(parseInt(e.target.value))} className="w-full accent-accent" />
              <div className="flex justify-between text-2xs text-muted">
                <span>74 cm</span><span>90 cm</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-grow">
              {offers.seats.economy.map((t, i) => {
                const disabled = !t.deliverable;
                return (
                  <label key={i} className={`flex items-center justify-between p-3 border rounded-sm transition-colors cursor-pointer ${disabled ? 'opacity-30 border-line pointer-events-none' : 'hover:bg-raised border-line'} ${ecoType === t.key ? 'bg-surface border-rule' : ''}`}>
                    <div className="flex items-center gap-3">
                      <input type="radio" checked={ecoType === t.key} disabled={disabled} onChange={() => setEcoType(t.key)} className="accent-accent hidden" />
                      <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${ecoType === t.key ? 'border-rule' : 'border-rule'}`}>
                        {ecoType === t.key && <div className="w-1.5 h-1.5 bg-raised rounded-full" />}
                      </div>
                      <span className={`text-sm font-mono transition-colors ${ecoType === t.key ? 'text-muted' : 'text-muted'}`}>{t.key}</span>
                      <SeatInfoTooltip title={t.key} desc={`${signedPts(t.points)}. Space multiplier: ${t.spaceFactor}x.`} hidden={disabled} />
                    </div>
                    <span className={`text-2xs uppercase font-label transition-colors ${ecoType === t.key ? 'text-muted opacity-80' : 'text-muted'}`}>
                      {disabled ? `Avail. ${yearOf(t.availableFrom)}` : (t.price ? partSub(t, true) : 'Standard')}
                    </span>
                  </label>
                )
              })}
            </div>
            
          </div>
          <div className="w-full md:w-1/2 p-4 flex flex-col">
            <h3 className="font-label text-sm font-semibold text-ink border-b border-line pb-2 mb-4 text-center">Seat Extras</h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
              {[
                { id: 'ife', state: ecoIFE, setter: setEcoIFE, ...feat('economy', 'ife'), label: 'In-Flight Ent.', title: 'In-Flight Entertainment', desc: `Personal screens with movies and games. ${signedPts(feat('economy', 'ife').points)}.` },
                { id: 'power', state: ecoPower, setter: setEcoPower, ...feat('economy', 'power'), label: 'In-Seat Power', title: 'In-Seat Power', desc: `Provides AC power/USB ports. ${signedPts(feat('economy', 'power').points)}.` },
                { id: 'hooks', state: ecoHooks, setter: setEcoHooks, ...feat('economy', 'hooks'), label: 'Coat Hooks', title: 'Integrated Coat Hooks', desc: `Fixed to the seat back or the tray-table latch. ${signedPts(feat('economy', 'hooks').points)}.` },
                { id: 'armrests', state: ecoMovableArmrests, setter: setEcoMovableArmrests, ...feat('economy', 'armrests'), label: 'Mov. Armrests', title: 'Movable Armrests', desc: `Armrests that fold fully up for easier access. ${signedPts(feat('economy', 'armrests').points)}.` },
                { id: 'headrests', state: ecoAdjHeadrests, setter: setEcoAdjHeadrests, ...feat('economy', 'headrests'), label: 'Adj. Headrests', title: 'Adjustable Headrests', desc: `With bendable side wings to steady the head. ${signedPts(feat('economy', 'headrests').points)}.` },
                { id: 'shell', state: ecoFixedShell, setter: setEcoFixedShell, ...feat('economy', 'shell'), label: 'Fixed-Shell', title: 'Fixed-Shell Design', desc: `A rigid shell on the seat back: reclining slides the seat forward inside it, so the passenger behind keeps their space. ${signedPts(feat('economy', 'shell').points)}.` },
                { id: 'ped', state: ecoPedHolder, setter: setEcoPedHolder, ...feat('economy', 'ped'), label: 'PED Holder', title: 'Device Holder (PED)', desc: `A ledge or clip at eye level for your own tablet or phone. ${signedPts(feat('economy', 'ped').points)}.` }
              ].sort((a, b) => {
                const aAvail = a.available;
                const bAvail = b.available;
                if (aAvail !== bAvail) return aAvail ? -1 : 1;
                return a.price - b.price;
              }).map(ext => {
                const available = ext.available;
                const activeColor = "text-muted";
                const activeBorder = "border-rule";
                const activeBg = "bg-surface";
                
                return (
                  <label key={ext.id} className={`flex items-center gap-3 p-3 transition-colors cursor-pointer rounded-sm border ${!available ? 'opacity-50 pointer-events-none border-line bg-ground/20' : (ext.state ? activeBg + ' ' + activeBorder : 'hover:bg-raised border-line')}`}>
                    <input type="checkbox" checked={ext.state} disabled={!available} onChange={(e) => ext.setter(e.target.checked)} className="accent-accent" />
                    <div className="flex flex-col w-full">
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-sm font-mono transition-colors ${ext.state ? activeColor : 'text-muted'}`}>{ext.label}</span>
                        <SeatInfoTooltip title={ext.title} desc={ext.desc} hidden={!available} />
                      </div>
                      <span className={`text-2xs font-mono mt-0.5 transition-colors ${ext.state ? activeColor + ' opacity-80' : 'text-muted'}`}>
                        {available ? `${signedPrice(ext.price)} / seat` : `Avail. ${yearOf(ext.req)}`}
                      </span>
                    </div>
                  </label>
                );
              })}
              </div>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-ground/90 flex items-center justify-center p-2 md:p-4 short:p-1">
      <div className="bg-surface border border-line w-full h-full max-h-[90vh] short:max-h-full flex flex-col rounded-sm overflow-hidden text-ink font-sans">
        
        {/* Header. Wraps onto two lines on phones. */}
        <div className="md:h-16 short:h-auto px-3 md:px-4 py-2 md:py-0 short:py-1.5 bg-ground/40 border-b border-line flex flex-wrap md:flex-nowrap items-center shrink-0 justify-between gap-x-4 gap-y-1">
          <div className="flex items-center gap-4">
            
            <h2 className="font-label text-base md:text-xl short:text-sm font-semibold text-ink short:whitespace-nowrap">
              {isRenovating ? `Reconfigure / Renovate: ${initialPlane.registration}` : `Configure: ${aircraft.manufacturer} ${aircraft.type}`}
            </h2>
          </div>
          <div className="font-label text-muted text-2xs md:text-xs tracking-label uppercase flex flex-wrap gap-x-4">
            <div>Type appeal: {formatNumber(quote.typeAppeal)}</div>
            <div>Cabin space: {formatNumber(TOTAL_SPACE)} cm</div>
          </div>
        </div>

        {/* Content. Upright phones stack the work area above the cabin panel
            and scroll the two together; from md up, which includes most phones
            held sideways, they sit side by side as on the desktop and scroll
            separately, so the diagram stays in view while the sliders move. */}
        <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden flex flex-col md:flex-row relative bg-ground">
          
          {/* Main Work Area */}
          <div className="flex-none md:flex-1 md:min-h-0 min-w-0 flex flex-col items-center justify-start p-3 md:p-4 short:p-2 relative md:overflow-y-auto border-b md:border-b-0 md:border-r border-line">
            
             {/* Plane Schematic Container */}
             {/* Raised above the mode switcher (z-10) only while the zone details
                 show, since they overlap it; otherwise the switcher stays on top
                 of the fuselage's drop shadow, as before. */}
             <div className={`w-full relative ${shownZone ? 'z-20' : 'z-10'} mb-4 short:mb-2 shrink-0`} style={{ maxWidth: Math.max(800, Math.min(2048, 400 + CAPACITY * 5)) + 'px' }}>
               <div className="text-2xs uppercase font-label tracking-label text-muted mb-4 short:mb-1.5 text-center flex items-center justify-center gap-4">
                 <span>Cabin Layout ({aircraft.class})</span>
                 <span className={`flex items-center gap-1 ${isOverbooked ? 'text-accent font-semibold' : ''}`}>
                   <Info size={12}/> {((quote.usedSpace / TOTAL_SPACE) * 100).toFixed(0)}% Space Used
                 </span>
               </div>
               
               <div className="relative w-full flex justify-center py-0 sm:py-0">
                     {/* Fuselage Background */}
                   <div className={`absolute inset-0 z-0`} style={{ transform: 'scaleY(1.03)' }}>
                     <svg preserveAspectRatio="none" viewBox="0 0 1000 200" className="w-full h-full">
                        <path d="M 120,5 C 40,5 5,45 5,100 C 5,155 40,195 120,195 L 850,195 Q 880,195 910,170 L 980,115 Q 995,100 980,85 L 910,30 Q 880,5 850,5 Z" fill="#ebf0f5" stroke="rgba(0,0,0,0.05)" strokeWidth="3" />
                     </svg>
                   </div>
                   
                   {/* Main Container */}
                   <div className={`relative w-full overflow-hidden ${aircraft.class === 'Widebody' ? 'h-[150px]' : aircraft.class === 'Narrowbody' ? 'h-[110px]' : 'h-[80px]'} flex items-stretch py-0 z-10`}>
                      {/* Cockpit Windows */}
                      <div className={`absolute left-[3%] sm:left-[4%] ${aircraft.class === 'Widebody' ? 'top-[16%] bottom-[16%]' : aircraft.class === 'Narrowbody' ? 'top-[12%] bottom-[12%]' : 'top-[8%] bottom-[8%]'} w-[5%] sm:w-[5%] z-20 pointer-events-none flex items-center justify-center`}>
                         <svg viewBox="0 0 100 200" className="w-full h-full opacity-90" preserveAspectRatio="none">
                            <path d="M 59 15 C 20 25 5 50 5 100 C 5 150 20 175 59 185 L 68 161 C 35 150 30 130 30 100 C 30 70 35 50 68 39 Z" fill="#1a5a8a" />
                            <line x1="12" y1="50" x2="35" y2="60" stroke="#ebf0f5" strokeWidth="4" />
                            <line x1="5" y1="100" x2="30" y2="100" stroke="#ebf0f5" strokeWidth="4" />
                            <line x1="12" y1="150" x2="35" y2="140" stroke="#ebf0f5" strokeWidth="4" />
                         </svg>
                      </div>

                      {/* Cabin Windows: rows of fuselage windows along both sides, purely decorative */}
                      <div
                        className="absolute left-[12%] sm:left-[13%] right-[12%] sm:right-[15%] top-[4%] h-[2px] opacity-70 pointer-events-none z-0"
                        style={{ backgroundImage: 'radial-gradient(circle, rgba(180,220,245,0.9) 40%, transparent 65%)', backgroundSize: '10px 100%', backgroundRepeat: 'repeat-x' }}
                      />
                      <div
                        className="absolute left-[12%] sm:left-[13%] right-[12%] sm:right-[15%] bottom-[4%] h-[2px] opacity-70 pointer-events-none z-0"
                        style={{ backgroundImage: 'radial-gradient(circle, rgba(180,220,245,0.9) 40%, transparent 65%)', backgroundSize: '10px 100%', backgroundRepeat: 'repeat-x' }}
                      />

                      {/* Zones container */}
                      <div className="relative flex-1 flex ml-[12%] sm:ml-[13%] mr-[12%] sm:mr-[15%] my-0 rounded-none overflow-hidden bg-ground/5 border border-ground">
                         {pFirst > 0 && (
                           <div style={{ width: `${pFirst}%` }} className="group bg-accent/20 relative overflow-visible flex items-center justify-center border-r border-accent/50 cursor-pointer hover:bg-accent/40 transition-colors" role="button" tabIndex={0} onKeyDown={clickOnKey} onClick={() => setSelectedClass('first')} {...zonePointer('first')}>
                              <SeatBlock count={firstSeats} cls="first" type={firstType} acClass={aircraft.class} />
                              <span className={`font-mono text-xs font-semibold text-ink absolute ${shownZone === 'first' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity mix-blend-overlay z-10 pointer-events-none`}>First</span>
                           </div>
                         )}
                         {pBiz > 0 && (
                           <div style={{ width: `${pBiz}%` }} className={`group bg-surface relative overflow-visible flex items-center justify-center border-r border-line cursor-pointer hover:bg-raised transition-colors`} role="button" tabIndex={0} onKeyDown={clickOnKey} onClick={() => setSelectedClass('business')} {...zonePointer('business')}>
                              <SeatBlock count={bizSeats} cls="business" type={bizType} acClass={aircraft.class} />
                              <span className={`font-mono text-xs font-semibold text-ink absolute ${shownZone === 'business' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity mix-blend-overlay z-10 pointer-events-none`}>Business</span>
                           </div>
                         )}
                         {pPrem > 0 && (
                           <div style={{ width: `${pPrem}%` }} className={`group bg-accent/20 relative overflow-visible flex items-center justify-center border-r border-accent/50 cursor-pointer hover:bg-accent/40 transition-colors`} role="button" tabIndex={0} onKeyDown={clickOnKey} onClick={() => setSelectedClass('premium')} {...zonePointer('premium')}>
                              <SeatBlock count={premSeats} cls="premium" type={premType} acClass={aircraft.class} />
                              <span className={`font-mono text-xs font-semibold text-ink absolute ${shownZone === 'premium' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity mix-blend-overlay z-10 pointer-events-none`}>Premium</span>
                           </div>
                         )}
                         {pEco > 0 && (
                           <div style={{ width: `${pEco}%` }} className={`group bg-raised/20 relative overflow-visible flex items-center justify-center cursor-pointer hover:bg-raised/40 transition-colors`} role="button" tabIndex={0} onKeyDown={clickOnKey} onClick={() => setSelectedClass('economy')} {...zonePointer('economy')}>
                              <SeatBlock count={ecoSeats} cls="economy" type={ecoType} acClass={aircraft.class} />
                              <span className={`font-mono text-xs font-semibold text-ink absolute ${shownZone === 'economy' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity mix-blend-overlay z-10 pointer-events-none`}>Economy</span>
                           </div>
                         )}
                      </div>
                   </div>

                   {/* Details of the hovered or tapped zone. Kept out here, below
                       the diagram: inside the zones, whose containers clip their
                       overflow, a tooltip was cut off and never seen. On a phone
                       held sideways little of the page shows below the diagram, so
                       there it sits over the diagram instead. */}
                   {shownZone && (() => {
                     const zone = {
                       first: { title: 'First Class', seats: firstSeats, type: firstType, pitch: firstPitch, border: 'border-accent/50', color: 'text-accent' },
                       business: { title: 'Business Class', seats: bizSeats, type: bizType, pitch: bizPitch, border: 'border-line', color: 'text-ink' },
                       premium: { title: 'Premium Economy', seats: premSeats, type: premType, pitch: premPitch, border: 'border-accent/50', color: 'text-accent' },
                       economy: { title: 'Economy Class', seats: ecoSeats, type: ecoType, pitch: ecoPitch, border: 'border-rule', color: 'text-muted' },
                     }[shownZone];
                     return (
                       <div role="tooltip" className={`absolute top-full short:top-1/2 left-1/2 -translate-x-1/2 short:-translate-y-1/2 mt-2 short:mt-0 z-[100] pointer-events-none bg-ground border ${zone.border} text-ink p-3 rounded-sm flex flex-col items-center min-w-[140px] whitespace-nowrap`}>
                         <span className={`font-mono text-2xs ${zone.color} font-semibold uppercase tracking-label mb-1`}>{zone.title}</span>
                         <span className="font-mono text-sm">{zone.seats} Seats</span>
                         <span className="font-mono text-2xs text-muted">{zone.type} • {zone.pitch}cm Pitch</span>
                       </div>
                     );
                   })()}
               </div>
             </div>

             {/* Configuration Mode Switcher */}
             <div className="flex gap-2 md:gap-4 w-full max-w-4xl relative z-10 mb-3 short:mb-2 shrink-0 justify-center">
                <div 
                  id="general-settings-btn" role="button" tabIndex={0} onKeyDown={clickOnKey}
                  onClick={() => setActiveConfigTab('general')} 
                  className={`px-4 py-3 rounded-sm font-semibold uppercase tracking-label text-2xs cursor-pointer transition-all border ${activeConfigTab === 'general' ? 'bg-accent text-on-accent border-accent' : 'bg-ground/40 text-muted border-line hover:border-rule'}`}
                >
                   General Settings
                </div>
                <div 
                  id="class-settings-btn" role="button" tabIndex={0} onKeyDown={clickOnKey}
                  onClick={() => setActiveConfigTab('classes')} 
                  className={`px-4 py-3 rounded-sm font-semibold uppercase tracking-label text-2xs cursor-pointer transition-all border ${activeConfigTab === 'classes' ? 'bg-accent text-on-accent border-accent' : 'bg-ground/40 text-muted border-line hover:border-rule'}`}
                >
                   Class Settings
                </div>
             </div>

             {activeConfigTab === 'classes' ? (
               <>
                 {/* Clickable Stats Grid */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 short:gap-1.5 w-full max-w-4xl relative z-10 mb-4 short:mb-2 shrink-0">
                <div role="button" tabIndex={0} onKeyDown={clickOnKey} onClick={() => setSelectedClass('first')} className={`bg-ground/40 border p-4 bar:p-3 short:p-2 rounded-sm flex flex-col items-center cursor-pointer transition-all ${selectedClass === 'first' ? 'border-accent bg-accent/10' : 'border-accent/20 hover:border-accent/50'}`}>
                  <div className="text-accent text-2xl short:text-lg font-semibold">{firstSeats}</div>
                  <div className="text-2xs uppercase font-label tracking-label short:tracking-label text-muted mt-1 mb-2 short:mb-1 whitespace-nowrap">First Class</div>
                  <div className="text-2xs bg-accent/20 text-accent px-2 py-0.5 rounded-sm font-semibold">Interior {formatNumber(scoreOf('first'))}</div>
                </div>
                <div role="button" tabIndex={0} onKeyDown={clickOnKey} onClick={() => setSelectedClass('business')} className={`bg-ground/40 border p-4 bar:p-3 short:p-2 rounded-sm flex flex-col items-center cursor-pointer transition-all ${selectedClass === 'business' ? 'border-rule bg-surface' : 'border-line hover:border-line'}`}>
                  <div className="text-ink text-2xl short:text-lg font-semibold">{bizSeats}</div>
                  <div className="text-2xs uppercase font-label tracking-label short:tracking-label text-muted mt-1 mb-2 short:mb-1 whitespace-nowrap">Business</div>
                  <div className="text-2xs bg-surface text-ink px-2 py-0.5 rounded-sm font-semibold">Interior {formatNumber(scoreOf('business'))}</div>
                </div>
                <div role="button" tabIndex={0} onKeyDown={clickOnKey} onClick={() => setSelectedClass('premium')} className={`bg-ground/40 border p-4 bar:p-3 short:p-2 rounded-sm flex flex-col items-center cursor-pointer transition-all ${selectedClass === 'premium' ? 'border-accent bg-accent/10' : 'border-accent/20 hover:border-accent/50'}`}>
                  <div className="text-accent text-2xl short:text-lg font-semibold">{premSeats}</div>
                  <div className="text-2xs uppercase font-label tracking-label short:tracking-label text-muted mt-1 mb-2 short:mb-1 whitespace-nowrap">Premium Eco</div>
                  <div className="text-2xs bg-accent/20 text-accent px-2 py-0.5 rounded-sm font-semibold">Interior {formatNumber(scoreOf('premium'))}</div>
                </div>
                <div role="button" tabIndex={0} onKeyDown={clickOnKey} onClick={() => setSelectedClass('economy')} className={`bg-ground/40 border p-4 bar:p-3 short:p-2 rounded-sm flex flex-col items-center cursor-pointer transition-all ${selectedClass === 'economy' ? 'border-rule bg-raised/10' : 'border-rule hover:border-rule'}`}>
                  <div className="text-muted text-2xl short:text-lg font-semibold">{ecoSeats}</div>
                  <div className="text-2xs uppercase font-label tracking-label short:tracking-label text-muted mt-1 mb-2 short:mb-1 whitespace-nowrap">Economy</div>
                  <div className="text-2xs bg-raised/20 text-muted px-2 py-0.5 rounded-sm font-semibold">Interior {formatNumber(scoreOf('economy'))}</div>
                </div>
             </div>

             {/* Dynamic Class Details Panel */}
             {renderClassDetails()}
               </>
             ) : (
               <div className="w-full max-w-4xl relative z-10 flex flex-col border border-line bg-ground/60 rounded-sm p-4">
                  <div className="flex items-center gap-3 mb-4 border-b border-line pb-4">
                     <Settings className="text-accent" size={24} />
                     <h3 className="font-label text-xl font-semibold text-ink">General Aircraft Settings</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 text-ink">
                     <div className="flex flex-col gap-3">
                        <h4 className="font-label text-2xs uppercase font-semibold tracking-label text-ink mb-2">Service Expansion</h4>
                        {[
                          { id: 'wifi', state: hasWifi, setter: setHasWifi, available: isWifiAvailable, label: 'In-Flight Wi-Fi', sub: partSub(extraOffer.wifi, false) },
                          { id: 'ambient', state: hasAmbientLighting, setter: setHasAmbientLighting, available: isAmbientAvailable, label: 'Ambient LED Lighting', sub: partSub(extraOffer.ambient, false) },
                          { id: 'catering', state: hasPremiumCatering, setter: setHasPremiumCatering, available: isCateringAvailable, label: 'Premium Catering Facilities', sub: partSub(extraOffer.catering, false) },
                        ].map(ext => (
                          <label key={ext.id} className={`flex items-center justify-between p-4 border rounded-sm transition-all cursor-pointer ${ext.available ? 'border-line hover:bg-raised' : 'opacity-30 border-line pointer-events-none'} ${ext.state ? 'bg-accent/5 border-accent/50' : ''}`}>
                             <div className="flex items-center gap-4">
                                <input type="checkbox" checked={ext.state} onChange={(e) => ext.setter(e.target.checked)} className="accent-accent" />
                                <div className="flex flex-col">
                                   <span className={`text-sm font-mono ${ext.state ? 'text-accent' : 'text-ink'}`}>{ext.label}</span>
                                   <span className="text-2xs uppercase tracking-label text-muted">{ext.sub}</span>
                                </div>
                             </div>
                          </label>
                        ))}
                     </div>

                     <div className="flex flex-col gap-3">
                        <h4 className="font-label text-2xs uppercase font-semibold tracking-label text-ink mb-2">Luxury & Efficiency</h4>
                        {[
                          { id: 'bar', state: hasOnboardBar, setter: setHasOnboardBar, available: isBarAvailable, label: 'Onboard Lounge & Bar', sub: partSub(extraOffer.bar, false) },
                          { id: 'shower', state: hasShower, setter: setHasShower, available: isShowerAvailable, label: 'Shower Spa & Wellness', sub: partSub(extraOffer.shower, false) },
                          { id: 'minimal', state: hasMinimalServices, setter: (v: boolean) => { setHasMinimalServices(v); if(v) setHasReducedGalley(false); }, available: extraOffer.minimal.deliverable, label: 'Ultra-High Density Mode', sub: partSub(extraOffer.minimal, false) },
                        ].map(ext => (
                          <label key={ext.id} className={`flex items-center justify-between p-4 border rounded-sm transition-all cursor-pointer ${ext.available ? 'border-line hover:bg-raised' : 'opacity-30 border-line pointer-events-none'} ${ext.state ? 'bg-accent/5 border-accent/50' : ''}`}>
                             <div className="flex items-center gap-4">
                                <input type="checkbox" checked={ext.state} onChange={(e) => ext.setter(e.target.checked)} className="accent-accent" />
                                <div className="flex flex-col">
                                   <span className={`text-sm font-mono ${ext.state ? 'text-accent' : 'text-ink'}`}>{ext.label}</span>
                                   <span className="text-2xs uppercase tracking-label text-muted">{ext.sub}</span>
                                </div>
                             </div>
                          </label>
                        ))}
                     </div>
                  </div>
               </div>
             )}

          </div>

          {/* Right Side: Narrow Regulators & Extras */}
          <div className="w-full md:w-[350px] short:w-[280px] md:min-h-0 shrink-0 bg-ground/20 p-4 short:p-2.5 flex flex-col md:overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3 mb-3">
              <h3 className="font-label text-sm font-semibold text-ink flex items-center gap-2">
                <Settings size={16} className="text-accent" />
                Cabin Layout
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowSaveConfig(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-line hover:bg-accent/10 hover:border-accent/30 text-muted hover:text-accent rounded-sm text-2xs font-label uppercase tracking-label transition-all"
                >
                  Save
                </button>
                <button 
                  onClick={() => setShowLoadConfig(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-line hover:bg-accent/10 hover:border-accent/30 text-muted hover:text-accent rounded-sm text-2xs font-label uppercase tracking-label transition-all group"
                >
                  <Download size={12} className="group-hover:translate-y-[1px] transition-transform" /> Load
                </button>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-2xs uppercase tracking-label">
                  <span className="text-accent font-semibold">First</span>
                  <span className="text-muted">{firstSeats}</span>
                </div>
                <input 
                  type="range" min="0" max={maxFirstSeats} step="1" value={firstSeats}
                  onChange={(e) => setFirstSeats(parseInt(e.target.value))}
                  className="w-full accent-accent cursor-pointer h-1.5 bg-raised rounded-full appearance-none"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-2xs uppercase tracking-label">
                  <span className="text-ink font-semibold">Business</span>
                  <span className="text-muted">{bizSeats}</span>
                </div>
                <input 
                  type="range" min="0" max={maxBizSeats} step="1" value={bizSeats}
                  onChange={(e) => setBizSeats(parseInt(e.target.value))}
                  className="w-full accent-accent cursor-pointer h-1.5 bg-raised rounded-full appearance-none"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-2xs uppercase tracking-label">
                  <span className="text-accent font-semibold">Premium Eco</span>
                  <span className="text-muted">{premSeats}</span>
                </div>
                <input 
                  type="range" min="0" max={maxPremSeats} step="1" value={premSeats}
                  onChange={(e) => setPremSeats(parseInt(e.target.value))}
                  className="w-full accent-accent cursor-pointer h-1.5 bg-raised rounded-full appearance-none"
                />
              </div>

              <div className="flex flex-col gap-2 opacity-50 block cursor-not-allowed">
                <div className="flex justify-between text-2xs uppercase tracking-label">
                  <span className="text-muted font-semibold">Economy (Auto)</span>
                  <span className="text-muted">{ecoSeats}</span>
                </div>
                <input 
                  type="range" min="0" max={CAPACITY} value={ecoSeats} readOnly
                  className="w-full accent-accent h-1.5 bg-raised rounded-full appearance-none pointer-events-none"
                />
              </div>
            </div>

            {/* Aircraft-Wide Extras */}
            <h3 className="font-label text-sm font-semibold text-ink border-b border-line pb-3 mb-4 mt-8 flex justify-between items-center">
              Aircraft Extras
              {extrasSpace > 0 && <span className="text-2xs text-muted">-{formatNumber(extrasSpace)} cm</span>}
            </h3>
            <div className="flex flex-col gap-2 relative">
              {[
                { id: 'wifi', state: hasWifi, setter: setHasWifi, available: extraOffer.wifi.deliverable, price: extraOffer.wifi.price, label: 'In-Flight Wi-Fi', title: 'In-Flight Wi-Fi', desc: `Satellite broadband connection for passengers. Crucial for modern business travelers.${extraDetails(extraOffer.wifi)}`, sub: partSub(extraOffer.wifi, false) },
                { id: 'ambient', state: hasAmbientLighting, setter: setHasAmbientLighting, available: extraOffer.ambient.deliverable, price: extraOffer.ambient.price, label: 'Ambient Lighting', title: 'Ambient Lighting', desc: `Dynamic LED mood lighting that reduces jet lag and improves cabin aesthetics.${extraDetails(extraOffer.ambient)}`, sub: partSub(extraOffer.ambient, false) },
                { id: 'catering', state: hasPremiumCatering, setter: setHasPremiumCatering, available: extraOffer.catering.deliverable, price: extraOffer.catering.price, label: 'Prem. Catering Fac.', title: 'Premium Catering', desc: `Expanded galley with ovens and chillers for multi-course hot meals. Takes up floor space.${extraDetails(extraOffer.catering)}`, sub: partSub(extraOffer.catering, false) },
                { id: 'bar', state: hasOnboardBar, setter: setHasOnboardBar, available: extraOffer.bar.deliverable, price: extraOffer.bar.price, label: 'Onboard Bar', title: 'Onboard Bar & Lounge', desc: `A luxurious standing bar and lounge area for premium passengers. Massive satisfaction boost but consumes extreme floor space.${extraDetails(extraOffer.bar)}`, sub: partSub(extraOffer.bar, false) },
                { id: 'shower', state: hasShower, setter: setHasShower, available: extraOffer.shower.deliverable, price: extraOffer.shower.price, label: 'Shower Spa', title: 'Shower Spa', desc: `The ultimate luxury. Allows first-class passengers to arrive refreshed. Carries large water tanks decreasing usable space dramatically.${extraDetails(extraOffer.shower)}`, sub: partSub(extraOffer.shower, false) },
                { id: 'reduced', state: hasReducedGalley, setter: (v: boolean) => { setHasReducedGalley(v); if(v) setHasMinimalServices(false); }, available: extraOffer.reduced.deliverable, price: extraOffer.reduced.price, label: 'Reduced Galley', title: 'Reduced Galley', desc: `Shrink the kitchen areas to cram in more seats. Saves money but passengers will notice the reduced service.${extraDetails(extraOffer.reduced)}`, sub: partSub(extraOffer.reduced, false) },
                { id: 'minimal', state: hasMinimalServices, setter: (v: boolean) => { setHasMinimalServices(v); if(v) setHasReducedGalley(false); }, available: extraOffer.minimal.deliverable, price: extraOffer.minimal.price, label: 'Minimal Services', title: 'Minimal Services', desc: `Remove nearly all service areas (galleys, closets, extra bathrooms) to maximize passenger density. Expect complaints.${extraDetails(extraOffer.minimal)}`, sub: partSub(extraOffer.minimal, false) }
              ].sort((a, b) => {
                const aAvail = a.available;
                const bAvail = b.available;
                if (aAvail !== bAvail) return aAvail ? -1 : 1;
                return a.price - b.price;
              }).map(ext => {
                const isRed = ext.price < 0;
                const activeColor = isRed ? "text-accent" : "text-accent";
                const activeBorder = isRed ? "border-rule" : "border-accent/50";
                const activeBg = isRed ? "bg-surface" : "bg-surface";
                const checkboxColor = isRed ? "accent-accent" : "accent-accent";
                
                return (
                  <label key={ext.id} className={`group relative flex items-center gap-3 p-3 border rounded-sm transition-colors ${ext.available ? 'border-line hover:bg-raised cursor-pointer' : 'border-line opacity-40 cursor-not-allowed'} ${ext.state ? activeBg + ' ' + activeBorder : ''}`}>
                    <input type="checkbox" checked={ext.state} disabled={!ext.available} onChange={(e) => ext.setter(e.target.checked)} className={checkboxColor} />
                    <div className="flex flex-col w-full">
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-xs font-mono transition-colors ${ext.state ? activeColor : 'text-ink'}`}>{ext.label}</span>
                        <SeatInfoTooltip title={ext.title} desc={ext.desc} hidden={!ext.available} />
                      </div>
                      <span className={`text-2xs mt-0.5 uppercase tracking-label transition-colors ${ext.state ? activeColor + ' opacity-80' : 'text-muted'}`}>{ext.sub}</span>
                    </div>
                  </label>
                );
              })}
            </div>


            {/* Config Impact Info */}
            <div className="mt-auto pt-6 border-t border-line flex flex-col gap-4">
              <h4 className="text-2xs font-label tracking-label text-muted uppercase mb-2">Quality Estimate</h4>
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-2xs font-label text-muted uppercase tracking-label">Total Seats</span>
                <span className="text-sm font-semibold font-mono">{totalSeats}</span>
              </div>
              
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-2xs font-label text-muted uppercase tracking-label">Type appeal</span>
                <span className="text-sm font-semibold font-mono text-ink">{formatNumber(quote.typeAppeal)}</span>
              </div>

              <div className="flex flex-col border-b border-line pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-label text-muted uppercase tracking-label">Cabin rating (avg.)</span>
                  <span className="text-sm font-semibold text-accent font-mono">{totalSeats > 0 ? formatNumber(quote.averageCabinRating) : '–'}</span>
                </div>
              </div>

              {/* What each cabin is rated by on a route: its own seats, not the average (SPEZIFIKATION 2.3, 2.4). */}
              <div className="flex flex-col gap-2 pb-2">
                <span className="text-2xs font-label text-muted uppercase tracking-label">Per class: interior score · cabin rating (expected)</span>
                {CABIN_CLASSES.filter(c => quote.seats[c] > 0).map(c => {
                  const parts = quote.interior[c];
                  const rating = quote.cabinRating[c];
                  const expected = CABIN_EXPECTATION[c];
                  return (
                    <div key={c} className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="text-2xs font-label text-muted uppercase tracking-label">{c}</span>
                        <span className="text-xs font-mono">
                          <span className="text-ink">{formatNumber(parts.total)}</span>
                          {' · '}
                          <span className={rating >= expected ? 'text-accent' : 'text-bad'}>{formatNumber(rating)}</span>
                          <span className="text-muted"> ({expected})</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
                {totalSeats > 0 && (
                  <Details summary="How the rating is worked out">
                    <div className="flex flex-col gap-1 text-2xs font-mono text-muted">
                      <span>
                        Cabin rating = type appeal × {formatNumber(TYPE_APPEAL_SHARE * 100)}% + interior score × {formatNumber(INTERIOR_SHARE * 100)}%
                        {quote.cabinCondition < 100 ? `, at ${formatNumber(quote.cabinCondition)}% cabin condition` : ''}
                      </span>
                      {CABIN_CLASSES.filter(c => quote.seats[c] > 0).map(c => {
                        const parts = quote.interior[c];
                        const pt = (v: number) => `${v >= 0 ? '+' : ''}${formatNumber(v, Number.isInteger(v) ? 0 : 1)}`;
                        return (
                          <span key={c}>
                            <span className="uppercase">{c}</span>: base {formatNumber(parts.base)} · seat {pt(parts.seatType)} · pitch {pt(parts.pitch)} · extras {pt(parts.features)} · cabin {pt(parts.cabinExtras)}
                          </span>
                        );
                      })}
                    </div>
                  </Details>
                )}
              </div>

              {/* Where the price comes from (SPEZIFIKATION 5.13, 8.12, 8.13). */}
              <div className="flex flex-col gap-1 border-t border-line pt-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-2xs font-label text-muted uppercase tracking-label">{isRenovating ? 'Refit price' : 'Unit price'}</span>
                  <span className="text-ink font-semibold">{formatCurrency(unitPrice)}</span>
                </div>
                <Details summary="Price breakdown">
                <div className="flex flex-col gap-1">
                {!isRenovating && (
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted">Aircraft</span><span>{formatCurrency(quote.typePrice)}</span>
                  </div>
                )}
                {CABIN_CLASSES.filter(c => quote.classPrice[c] !== 0).map(c => (
                  <div key={c} className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted capitalize">{c} seats</span><span>{formatCurrency(quote.classPrice[c])}</span>
                  </div>
                ))}
                {quote.extrasPrice !== 0 && (
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted">Cabin extras</span><span>{formatCurrency(quote.extrasPrice)}</span>
                  </div>
                )}
                {isRenovating && (
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted">Labour ({formatNumber(totalSeats)} seats)</span><span>{formatCurrency(quote.labour)}</span>
                  </div>
                )}
                {isRenovating && (
                  <span className="text-2xs text-muted">The labour adds no value to the aircraft; it shows under “Aircraft trades”.</span>
                )}
                </div>
                </Details>
              </div>
            </div>

          </div>

        </div>

        {/* Footer */}
        {/* Footer. Upright phones use two rows: quantity and total, then Cancel
            beside Confirm (the button group is display: contents there so its
            parts can be ordered in with Cancel; the unit price steps aside, the
            total says it). Sideways it fits one row where the width allows. */}
        <div className="md:h-24 short:h-auto px-3 md:px-4 py-3 md:py-0 bar:py-2 short:py-2 bg-ground/80 border-t border-line flex flex-wrap items-center justify-between shrink-0 gap-3 md:gap-4 relative z-20">
          
          <button onClick={onCancel} className="bar:order-3 border border-rule text-muted font-semibold text-sm py-3 md:py-4 bar:py-2.5 px-4 md:px-6 rounded-sm hover:text-ink hover:bg-raised transition-all mr-auto bar:mr-0 short:py-2">Cancel</button>
          {/* The unit price steps aside on a phone held sideways, so the rest of
              the footer fits one row; the total next to the quantity says it. */}
          <div className="flex items-center gap-3 bar:hidden short:hidden">
             <div className="flex flex-col">
               <span className="text-2xs uppercase font-label tracking-label text-muted">
                 {isRenovating ? 'Renovation Unit Cost' : 'Unit Price'}
               </span>
               <span className={`text-sm font-mono ${!canAfford ? 'text-accent' : ''}`}>
                 {formatCurrency(unitPrice)}
               </span>
             </div>
          </div>

          <div className="flex flex-wrap items-center justify-between md:justify-start gap-3 w-full md:w-auto short:w-auto bar:contents">
            {!isRenovating && (
              <div className="bar:order-1 flex items-center gap-4 bar:gap-2 short:gap-2 bg-surface border border-line rounded-sm p-1">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  className="w-10 h-10 bar:w-9 bar:h-9 short:w-8 short:h-8 flex items-center justify-center bg-ground/40 hover:bg-raised transition-colors disabled:opacity-30 disabled:hover:bg-ground/40"
                >
                  <Minus size={16} />
                </button>
                <div className="text-xl font-semibold w-12 text-center text-accent">{quantity}</div>
                <button 
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 bar:w-9 bar:h-9 short:w-8 short:h-8 flex items-center justify-center bg-ground/40 hover:bg-raised transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            )}

            <div className="bar:order-2 bar:flex-1 flex flex-col items-end pr-4 bar:pr-0 border-r bar:border-r-0 border-line">
              <span className="text-2xs uppercase font-label tracking-label text-muted">Total Cost</span>
              <span className={`text-sm font-semibold ${!canAfford ? 'text-bad' : 'text-accent'}`}>
                {formatCurrency(totalPrice)}
              </span>
              {/* The confirm button is disabled in these two cases. Without a reason
                  beside it, a dimmed button is indistinguishable from a broken one. */}
              {!canAfford && (
                <span className="text-2xs font-mono text-bad mt-0.5 whitespace-nowrap">
                  {formatCurrency(totalPrice - capital)} short
                </span>
              )}
              {canAfford && isOverbooked && (
                <span className="text-2xs text-bad mt-0.5 whitespace-nowrap">
                  Cabin exceeds available space
                </span>
              )}
            </div>

            <button 
              onClick={handleConfirm}
              disabled={!canAfford || isOverbooked}
              className="bar:order-4 bar:flex-1 w-full md:w-auto short:w-auto bar:w-auto bg-accent text-on-accent font-semibold text-sm px-4 py-4 bar:py-2.5 short:py-2.5 rounded-sm hover:bg-ink transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-accent disabled:transform-none"
            >
              {isRenovating ? 'CONFIRM RENOVATION' : 'CONFIRM PURCHASE'}
            </button>
          </div>
        </div>
      </div>

      
      {showSaveConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-4 bg-ground/80 pointer-events-auto" onClick={(e) => { if(e.target === e.currentTarget) setShowSaveConfig(false); }}>
          <div role="dialog" aria-modal="true" className="relative w-full max-w-sm bg-surface border border-rule flex flex-col p-4">
            <button onClick={() => setShowSaveConfig(false)} className="absolute top-4 right-6 text-muted hover:text-ink transition-colors">
              <X size={24} />
            </button>
            <h3 className="font-label text-xl font-semibold text-ink mb-2 border-b border-line pb-4">Save Preset</h3>
            <p className="text-2xs text-muted font-label mb-3 uppercase tracking-label">{aircraft.manufacturer} {aircraft.type}</p>
            
            <div className="flex flex-col gap-4">
              {/* Only presets of this aircraft type: a preset is tied to one type. */}
              <OverwritePicker
                items={savedPresets.filter(p => p.aircraftId === aircraft.id)}
                value={overwritePresetId}
                onChange={item => {
                  setOverwritePresetId(item?.id ?? null);
                  if (item) setSavePresetName(item.name);
                }}
              />
              <div>
                <label className="text-2xs uppercase tracking-label text-muted mb-2 block font-semibold">Preset Name</label>
                <input 
                  type="text" 
                  value={savePresetName}
                  onChange={(e) => setSavePresetName(e.target.value)}
                  placeholder="e.g. High Density Eco"
                  className="w-full bg-ground/40 border border-line p-3 text-sm text-ink focus:border-accent/50 outline-none"
                  autoFocus
                />
              </div>
              <button 
                onClick={handleSavePreset}
                disabled={!savePresetName.trim()}
                className="w-full bg-accent text-on-accent font-semibold uppercase tracking-label py-3 mt-2 hover:bg-accent transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                {overwritePresetId ? 'Overwrite Configuration' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoadConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-4 bg-ground/80 pointer-events-auto" onClick={(e) => { if(e.target === e.currentTarget) setShowLoadConfig(false); }}>
          <div role="dialog" aria-modal="true" className="relative w-full max-w-2xl bg-surface border border-rule flex flex-col p-4 max-h-[80vh]">
            <button onClick={() => setShowLoadConfig(false)} className="absolute top-4 right-6 text-muted hover:text-ink transition-colors">
              <X size={24} />
            </button>
            <h3 className="font-label text-xl font-semibold text-ink mb-2 border-b border-line pb-4">Load Configuration</h3>
            <p className="text-2xs text-muted font-label mb-3 uppercase tracking-label">{aircraft.manufacturer} {aircraft.type} Configurations</p>
            
            <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
              {savedPresets.filter(p => p.aircraftId === aircraft.id).length > 0 && (
                <>
                  <h4 className="font-label text-xs font-semibold text-ink uppercase tracking-label mb-2 mt-4">Global Presets</h4>
                  {savedPresets.filter(p => p.aircraftId === aircraft.id).map(preset => {
                    const c = preset.config;
                    const totalSeats = (c.first || 0) + (c.business || 0) + (c.premium || 0) + (c.economy || 0);
                    return (
                      <div key={preset.id} className="bg-accent/5 border border-accent/20 p-4 flex justify-between items-center hover:bg-accent/10 transition-colors cursor-pointer group" role="button" tabIndex={0} onKeyDown={clickOnKey} onClick={() => handleLoadConfig(preset)}>
                        <div>
                          <div className="font-semibold text-ink mb-1 uppercase tracking-label flex items-center gap-2">
                            {preset.name}
                            <span className="font-label text-2xs uppercase font-normal text-muted border border-line px-1 rounded-sm">{totalSeats} SEATS</span>
                          </div>
                          <div className="flex gap-4 text-xs font-semibold">
                            {c.first > 0 && <span className="text-accent">F{c.first}</span>}
                            {c.business > 0 && <span className="text-ink">J{c.business}</span>}
                            {c.premium > 0 && <span className="text-accent">W{c.premium}</span>}
                            {c.economy > 0 && <span className="text-muted">Y{c.economy}</span>}
                            <span className="text-accent ml-2 before:content-['•'] before:mr-2 before:text-muted">Interior {formatNumber(preset.baseInteriorPop)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => handleDeletePreset(preset.id, e)}
                            className="p-2 border border-rule text-accent hover:bg-raised hover:text-ink hover:border-line transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                          <div className="px-4 py-2 border border-accent/30 text-muted text-2xs font-label uppercase tracking-label group-hover:bg-accent group-hover:text-on-accent group-hover:border-accent transition-all">
                            Load
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <h4 className="font-label text-xs font-semibold text-ink uppercase tracking-label mb-2 mt-6">Fleet Configurations</h4>
                </>
              )}

              {fleet.filter(f => f.id === aircraft.id).length === 0 && (
                <div className="text-center font-label text-muted py-4 uppercase tracking-label text-xs">
                  No previous configurations found.
                </div>
              )}
              {fleet.filter(f => f.id === aircraft.id).slice().sort((a,b) => b.baseInteriorPop - a.baseInteriorPop).map((plane, index) => {
                const c = plane.config;
                const totalSeats = (c.first || 0) + (c.business || 0) + (c.premium || 0) + (c.economy || 0);
                return (
                  <div key={plane.id + index} className="bg-surface border border-line p-4 flex justify-between items-center hover:border-accent/50 hover:bg-raised transition-colors cursor-pointer group" role="button" tabIndex={0} onKeyDown={clickOnKey} onClick={() => handleLoadConfig(plane)}>
                    <div>
                      <div className="font-semibold text-ink mb-1 uppercase tracking-label flex items-center gap-2">
                        {plane.registration}
                        <span className="font-label text-2xs uppercase font-normal text-muted border border-line px-1 rounded-sm">{totalSeats} SEATS</span>
                      </div>
                      <div className="flex gap-4 text-xs font-semibold">
                        {c.first > 0 && <span className="text-accent">F{c.first}</span>}
                        {c.business > 0 && <span className="text-ink">J{c.business}</span>}
                        {c.premium > 0 && <span className="text-accent">W{c.premium}</span>}
                        {c.economy > 0 && <span className="text-muted">Y{c.economy}</span>}
                        <span className="text-accent ml-2 before:content-['•'] before:mr-2 before:text-muted">Interior {formatNumber(plane.baseInteriorPop)}</span>
                      </div>
                    </div>
                    <div className="px-4 py-2 border border-rule text-muted text-2xs font-label uppercase tracking-label group-hover:bg-ink group-hover:text-on-accent group-hover:border-ink transition-all">
                      Load
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
