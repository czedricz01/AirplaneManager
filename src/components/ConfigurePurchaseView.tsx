import React, { useState, useMemo } from 'react';
import { formatCurrency } from '../lib/format';
import { Aircraft } from '../data/aircraft';
import type { OwnedAircraft } from './MyFleetView';
import { Minus, Plus, ChevronLeft, Info, Settings, Wifi, Tv, X, Download, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
// The shared version of what used to be a local SeatInfoTooltip here; the rest of
// the interface needs the same affordance, so it now lives in its own module.
import { InfoTooltip as SeatInfoTooltip } from './InfoTooltip';
import { useTapReveal } from './ui/useTapReveal';
import { readJson, writeJson } from '../lib/safeStorage';

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

/**
 * Interior SAT points per seat feature, per cabin. The calculation below and the
 * tooltips both read these; the tooltips used to state twice the real value.
 */
const FEATURE_POP = {
  economy: { ife: 5, power: 5, hooks: 1, armrests: 2.5, headrests: 2.5, shell: 5, ped: 4 },
  premium: { ife: 5, power: 5, table: 2.5, calf: 5, foot: 4, light: 2.5, usbc: 4 },
  business: { ife: 7.5, power: 5, lumbar: 4, control: 7.5, massage: 10, divider: 12.5, charging: 5 },
  first: { ife: 10, power: 7.5, wardrobe: 7.5, wood: 12.5, mirror: 5, minibar: 15, climate: 17.5 }
} as const;

/** Interior SAT points of the cabin-wide extras. */
const CABIN_EXTRA_POP = { wifi: 5, ambient: 2.5, catering: 2.5, bar: 7.5, shower: 10, reduced: -2.5, minimal: -7.5 } as const;

/** A seat type's `pop` counts double in the interior score. */
const SEAT_TYPE_POP_FACTOR = 2;

const signedPts = (v: number) => `${v > 0 ? '+' : ''}${v} interior SAT pts`;

export function ConfigurePurchaseView({ aircraft, capital, currentDateOffset, initialPlane, fleet = [], onCancel, onConfirmPurchase }: Props) {
  const isRenovating = !!initialPlane;

  const [quantity, setQuantity] = useState(1);
  const [showLoadConfig, setShowLoadConfig] = useState(false);
  const [showSaveConfig, setShowSaveConfig] = useState(false);
  const [savePresetName, setSavePresetName] = useState("");
  const [savedPresets, setSavedPresets] = useState<any[]>(() => readJson<any[]>('aero_saved_presets', []));
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

  const SEAT_DEFS = {
    first: [
      { n: 'Standard', c: 0, pop: 0, m: 1, req: 0 },
      { n: 'Recliner', c: 500, pop: 10, m: 1.2, req: 0 },
      { n: 'Flat Bed', c: 1500, pop: 20, m: 1.5, req: 360 },
      { n: 'Open Suite', c: 3000, pop: 30, m: 1.8, req: 420 },
      { n: 'Closed Suite', c: 8000, pop: 50, m: 2.2, req: 540 },
      { n: 'Residence', c: 25000, pop: 80, m: 3, req: 648 }
    ],
    business: [
      { n: 'Standard', c: 0, pop: 0, m: 1, req: 0 },
      { n: 'Recliner', c: 300, pop: 10, m: 1.1, req: 0 },
      { n: 'Angled Flat', c: 1000, pop: 20, m: 1.3, req: 480 },
      { n: 'Lie-Flat', c: 2500, pop: 35, m: 1.6, req: 540 },
      { n: 'Suites', c: 5000, pop: 50, m: 2.0, req: 660 }
    ],
    premium: [
      { n: 'Standard', c: 0, pop: 0, m: 1, req: 0 },
      { n: 'Recliner', c: 400, pop: 20, m: 1.2, req: 0 },
      { n: 'Cradle', c: 800, pop: 35, m: 1.4, req: 600 }
    ],
    economy: [
      { n: 'Standard', c: 0, pop: 0, m: 1, req: 0 },
      { n: 'Comfort', c: 80, pop: 5, m: 1.05, req: 0 },
      { n: 'Ergonomic', c: 150, pop: 15, m: 1.0, req: 600 },
      { n: 'Premium-Eco', c: 300, pop: 25, m: 1.1, req: 660 }
    ]
  };

  const getDef = (cat: 'first'|'business'|'premium'|'economy', type: string) => {
    return SEAT_DEFS[cat].find(d => d.n === type) || SEAT_DEFS[cat][0];
  };

  const CAPACITY = aircraft.capacity; // Total economy seats at 74cm
  
  let spaceMultiplier = 1.0;
  if (hasReducedGalley) spaceMultiplier += 0.03;
  if (hasMinimalServices) spaceMultiplier += 0.06;
  
  const TOTAL_SPACE = CAPACITY * 74 * spaceMultiplier;

  const firstMultiplier = getDef('first', firstType).m;
  const bizMultiplier = getDef('business', bizType).m;
  const premMultiplier = getDef('premium', premType).m;
  const ecoMultiplier = getDef('economy', ecoType).m;

  const extrasSpace = (hasPremiumCatering ? 200 : 0) + (hasOnboardBar ? 400 : 0) + (hasShower ? 800 : 0);

  const usedSpaceWithoutEcoRaw = (firstSeats * firstPitch * firstMultiplier) + (bizSeats * bizPitch * bizMultiplier) + (premSeats * premPitch * premMultiplier) + extrasSpace;
  const remainingSpace = TOTAL_SPACE - usedSpaceWithoutEcoRaw;
  
  // Calculate Economy Seats
  const ecoSeats = Math.max(0, Math.floor(remainingSpace / (ecoPitch * ecoMultiplier)));
  const isOverbooked = remainingSpace < 0;

  const maxFirstSeats = firstSeats + Math.max(0, Math.floor(remainingSpace / (firstPitch * firstMultiplier)));
  const maxBizSeats = bizSeats + Math.max(0, Math.floor(remainingSpace / (bizPitch * bizMultiplier)));
  const maxPremSeats = premSeats + Math.max(0, Math.floor(remainingSpace / (premPitch * premMultiplier)));

  // Pricing Limits
  const isWifiAvailable = currentDateOffset >= 480; 
  const isAmbientAvailable = currentDateOffset >= 540;
  const isBarAvailable = currentDateOffset >= 120 && CAPACITY >= 200; // Require decent sized plane
  const isShowerAvailable = currentDateOffset >= 576 && CAPACITY >= 300; // Require very large plane

  const wifiCost = hasWifi && isWifiAvailable ? 150000 : 0;
  const ambientCost = hasAmbientLighting && isAmbientAvailable ? 100000 : 0;
  const cateringCost = hasPremiumCatering ? 300000 : 0;
  const barCost = hasOnboardBar && isBarAvailable ? 500000 : 0;
  const showerCost = hasShower && isShowerAvailable ? 1000000 : 0;
  const reducedGalleyCost = hasReducedGalley ? -25000 : 0;
  const minimalServicesCost = hasMinimalServices ? -50000 : 0;

  const totalExtrasCost = wifiCost + ambientCost + cateringCost + barCost + showerCost + reducedGalleyCost + minimalServicesCost;

  // Pop Calcs
  const getEcoPop = () => {
    let p = 50 + getDef('economy', ecoType).pop * SEAT_TYPE_POP_FACTOR; // base lower
    p += (ecoPitch - 74) * 4;
    if (ecoIFE && currentDateOffset >= 240) p += FEATURE_POP.economy.ife;
    if (ecoPower && currentDateOffset >= 420) p += FEATURE_POP.economy.power;
    if (ecoHooks && currentDateOffset >= 180) p += FEATURE_POP.economy.hooks;
    if (ecoMovableArmrests && currentDateOffset >= 300) p += FEATURE_POP.economy.armrests;
    if (ecoAdjHeadrests && currentDateOffset >= 420) p += FEATURE_POP.economy.headrests;
    if (ecoFixedShell && currentDateOffset >= 540) p += FEATURE_POP.economy.shell;
    if (ecoPedHolder && currentDateOffset >= 660) p += FEATURE_POP.economy.ped;
    return Math.max(0, p);
  };

  const getPremPop = () => {
    let p = 55 + getDef('premium', premType).pop * SEAT_TYPE_POP_FACTOR;
    p += (premPitch - 85) * 3;
    if (premIFE && currentDateOffset >= 240) p += FEATURE_POP.premium.ife;
    if (premPower && currentDateOffset >= 420) p += FEATURE_POP.premium.power;
    if (premCocktailTable && currentDateOffset >= 180) p += FEATURE_POP.premium.table;
    if (premCalfRest && currentDateOffset >= 300) p += FEATURE_POP.premium.calf;
    if (premFootrests && currentDateOffset >= 420) p += FEATURE_POP.premium.foot;
    if (premGooseneckLight && currentDateOffset >= 600) p += FEATURE_POP.premium.light;
    if (premUSBC && currentDateOffset >= 720) p += FEATURE_POP.premium.usbc;
    return Math.max(0, p);
  };

  const getBizPop = () => {
    let p = 60 + getDef('business', bizType).pop * SEAT_TYPE_POP_FACTOR;
    p += (bizPitch - 100) * 2.4;
    if (bizIFE && currentDateOffset >= 240) p += FEATURE_POP.business.ife;
    if (bizPower && currentDateOffset >= 360) p += FEATURE_POP.business.power;
    if (bizLumbarSupport && currentDateOffset >= 180) p += FEATURE_POP.business.lumbar;
    if (bizElecSeatControl && currentDateOffset >= 300) p += FEATURE_POP.business.control;
    if (bizMassage && currentDateOffset >= 420) p += FEATURE_POP.business.massage;
    if (bizPrivacyDivider && currentDateOffset >= 540) p += FEATURE_POP.business.divider;
    if (bizInductiveCharging && currentDateOffset >= 720) p += FEATURE_POP.business.charging;
    return Math.max(0, p);
  };

  const getFirstPop = () => {
    let p = 70 + getDef('first', firstType).pop * SEAT_TYPE_POP_FACTOR;
    p += (firstPitch - 150) * 1.6;
    if (firstIFE && currentDateOffset >= 240) p += FEATURE_POP.first.ife;
    if (firstPower && currentDateOffset >= 360) p += FEATURE_POP.first.power;
    if (firstWardrobe && currentDateOffset >= 240) p += FEATURE_POP.first.wardrobe;
    if (firstWoodLeather && currentDateOffset >= 360) p += FEATURE_POP.first.wood;
    if (firstMirrors && currentDateOffset >= 480) p += FEATURE_POP.first.mirror;
    if (firstMinibar && currentDateOffset >= 600) p += FEATURE_POP.first.minibar;
    if (firstActiveClimate && currentDateOffset >= 720) p += FEATURE_POP.first.climate;
    return Math.max(0, p);
  };

  const totalSeats = firstSeats + bizSeats + premSeats + ecoSeats;

  const interiorPopRaw = totalSeats > 0 ? (
      (firstSeats * getFirstPop() + 
       bizSeats * getBizPop() + 
       premSeats * getPremPop() + 
       ecoSeats * getEcoPop()) / totalSeats
  ) : 0;

  const baseInteriorPop = useMemo(() => {
    if (totalSeats === 0) return 0;
    let score = interiorPopRaw;
    if (hasWifi && isWifiAvailable) score += CABIN_EXTRA_POP.wifi;
    if (hasAmbientLighting && isAmbientAvailable) score += CABIN_EXTRA_POP.ambient;
    if (hasPremiumCatering) score += CABIN_EXTRA_POP.catering;
    if (hasOnboardBar && isBarAvailable) score += CABIN_EXTRA_POP.bar;
    if (hasShower && isShowerAvailable) score += CABIN_EXTRA_POP.shower;
    if (hasReducedGalley) score += CABIN_EXTRA_POP.reduced;
    if (hasMinimalServices) score += CABIN_EXTRA_POP.minimal;
    return Math.round(score);
  }, [interiorPopRaw, hasWifi, isWifiAvailable, hasAmbientLighting, isAmbientAvailable, hasPremiumCatering, hasOnboardBar, isBarAvailable, hasShower, isShowerAvailable, hasReducedGalley, hasMinimalServices]);

  // Overall Plane Pop
  const totalPopularity = Math.round((aircraft.popularity * 0.33) + (baseInteriorPop * 0.67));

  // Cost Calc
  const getClassCost = () => {
    let cost = 0;
    let eC = getDef('economy', ecoType).c;
    if (ecoIFE && currentDateOffset >= 240) eC += 300;
    if (ecoPower && currentDateOffset >= 420) eC += 100;
    if (ecoHooks && currentDateOffset >= 180) eC += 20;
    if (ecoMovableArmrests && currentDateOffset >= 300) eC += 50;
    if (ecoAdjHeadrests && currentDateOffset >= 420) eC += 80;
    if (ecoFixedShell && currentDateOffset >= 540) eC += 200;
    if (ecoPedHolder && currentDateOffset >= 660) eC += 60;
    cost += eC * ecoSeats;
 
    let pC = getDef('premium', premType).c;
    if (premIFE && currentDateOffset >= 240) pC += 400;
    if (premPower && currentDateOffset >= 420) pC += 150;
    if (premCocktailTable && currentDateOffset >= 180) pC += 50;
    if (premCalfRest && currentDateOffset >= 300) pC += 150;
    if (premFootrests && currentDateOffset >= 420) pC += 100;
    if (premGooseneckLight && currentDateOffset >= 600) pC += 80;
    if (premUSBC && currentDateOffset >= 720) pC += 100;
    cost += pC * premSeats;
 
    let bC = getDef('business', bizType).c;
    if (bizIFE && currentDateOffset >= 240) bC += 600;
    if (bizPower && currentDateOffset >= 360) bC += 200;
    if (bizLumbarSupport && currentDateOffset >= 180) bC += 200;
    if (bizElecSeatControl && currentDateOffset >= 300) bC += 800;
    if (bizMassage && currentDateOffset >= 420) bC += 1200;
    if (bizPrivacyDivider && currentDateOffset >= 540) bC += 1500;
    if (bizInductiveCharging && currentDateOffset >= 720) bC += 300;
    cost += bC * bizSeats;
 
    let fC = getDef('first', firstType).c;
    if (firstIFE && currentDateOffset >= 240) fC += 1000;
    if (firstPower && currentDateOffset >= 360) fC += 300;
    if (firstWardrobe && currentDateOffset >= 240) fC += 800;
    if (firstWoodLeather && currentDateOffset >= 360) fC += 3000;
    if (firstMirrors && currentDateOffset >= 480) fC += 400;
    if (firstMinibar && currentDateOffset >= 600) fC += 2500;
    if (firstActiveClimate && currentDateOffset >= 720) fC += 4000;
    cost += fC * firstSeats;
 
    return cost;
  };

  const configExtrasCost = getClassCost();
  const renovateCost = isRenovating ? ((CAPACITY * 1000) + totalExtrasCost + configExtrasCost) : 0;
  const unitPrice = isRenovating ? renovateCost : aircraft.basePrice + totalExtrasCost + configExtrasCost;
  const totalPrice = unitPrice * quantity;
  const canAfford = capital >= totalPrice;


  const pFirstRaw = ((firstSeats * firstPitch * firstMultiplier) / TOTAL_SPACE) * 100;
  const pBizRaw = ((bizSeats * bizPitch * bizMultiplier) / TOTAL_SPACE) * 100;
  const pPremRaw = ((premSeats * premPitch * premMultiplier) / TOTAL_SPACE) * 100;
  const pEcoRaw = ((ecoSeats * ecoPitch * ecoMultiplier) / TOTAL_SPACE) * 100;

  const totalUsedP = pFirstRaw + pBizRaw + pPremRaw + pEcoRaw;
  const pFirst = totalUsedP > 0 ? (pFirstRaw / totalUsedP) * 100 : 0;
  const pBiz = totalUsedP > 0 ? (pBizRaw / totalUsedP) * 100 : 0;
  const pPrem = totalUsedP > 0 ? (pPremRaw / totalUsedP) * 100 : 0;
  const pEco = totalUsedP > 0 ? (pEcoRaw / totalUsedP) * 100 : 0;


  const handleSavePreset = () => {
    if (!savePresetName.trim()) return;
    
    const preset = {
      id: Math.random().toString(36).substring(7),
      aircraftId: aircraft.id,
      name: savePresetName.trim(),
      // The score the purchase itself uses. Presets used to store a different
      // formula (weighted by cabin space, other extra values).
      baseInteriorPop,
      config: {
        first: firstSeats, business: bizSeats, premium: premSeats, economy: ecoSeats,
        details: {
          hasWifi, hasAmbientLighting, hasPremiumCatering, hasOnboardBar, hasShower, hasReducedGalley, hasMinimalServices,
          first: { seats: firstSeats, pitch: firstPitch, seatType: firstType, hasIFE: firstIFE, hasPower: firstPower, hasWardrobe: firstWardrobe, hasWoodLeather: firstWoodLeather, hasMirrors: firstMirrors, hasMinibar: firstMinibar, hasActiveClimate: firstActiveClimate },
          business: { seats: bizSeats, pitch: bizPitch, seatType: bizType, hasIFE: bizIFE, hasPower: bizPower, hasLumbarSupport: bizLumbarSupport, hasElecSeatControl: bizElecSeatControl, hasMassage: bizMassage, hasPrivacyDivider: bizPrivacyDivider, hasInductiveCharging: bizInductiveCharging },
          premium: { seats: premSeats, pitch: premPitch, seatType: premType, hasIFE: premIFE, hasPower: premPower, hasCocktailTable: premCocktailTable, hasCalfRest: premCalfRest, hasFootrests: premFootrests, hasGooseneckLight: premGooseneckLight, hasUSBC: premUSBC },
          economy: { seats: ecoSeats, pitch: ecoPitch, seatType: ecoType, hasIFE: ecoIFE, hasPower: ecoPower, hasHooks: ecoHooks, hasMovableArmrests: ecoMovableArmrests, hasAdjHeadrests: ecoAdjHeadrests, hasFixedShell: ecoFixedShell, hasPedHolder: ecoPedHolder }
        }
      },
      createdAt: Date.now()
    };
    const newPresets = [...savedPresets, preset];
    setSavedPresets(newPresets);
    writeJson('aero_saved_presets', newPresets);
    setSavePresetName("");
    setShowSaveConfig(false);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newPresets = savedPresets.filter(p => p.id !== id);
    setSavedPresets(newPresets);
    writeJson('aero_saved_presets', newPresets);
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
        first: { seats: firstSeats, pitch: firstPitch, seatType: firstType, hasIFE: firstIFE, hasPower: firstPower, hasWardrobe: firstWardrobe, hasWoodLeather: firstWoodLeather, hasMirrors: firstMirrors, hasMinibar: firstMinibar, hasActiveClimate: firstActiveClimate },
        business: { seats: bizSeats, pitch: bizPitch, seatType: bizType, hasIFE: bizIFE, hasPower: bizPower, hasLumbarSupport: bizLumbarSupport, hasElecSeatControl: bizElecSeatControl, hasMassage: bizMassage, hasPrivacyDivider: bizPrivacyDivider, hasInductiveCharging: bizInductiveCharging },
        premium: { seats: premSeats, pitch: premPitch, seatType: premType, hasIFE: premIFE, hasPower: premPower, hasCocktailTable: premCocktailTable, hasCalfRest: premCalfRest, hasFootrests: premFootrests, hasGooseneckLight: premGooseneckLight, hasUSBC: premUSBC },
        economy: { seats: ecoSeats, pitch: ecoPitch, seatType: ecoType, hasIFE: ecoIFE, hasPower: ecoPower, hasHooks: ecoHooks, hasMovableArmrests: ecoMovableArmrests, hasAdjHeadrests: ecoAdjHeadrests, hasFixedShell: ecoFixedShell, hasPedHolder: ecoPedHolder },
        // Only what was actually paid for and fitted. A preset loaded in an
        // earlier year could carry Wi-Fi that was never charged, and
        // details.hasWifi is what unlocks the Wi-Fi cabin services.
        hasWifi: hasWifi && isWifiAvailable,
        hasAmbientLighting: hasAmbientLighting && isAmbientAvailable,
        hasPremiumCatering,
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

  const renderSeatDots = (count: number, cls: string, type: string, cap: number, acClass: string) => {
    let abreast = 6;
    if (acClass === 'Widebody') abreast = cls === 'first' ? 4 : (cls === 'business' ? 6 : (cls === 'premium' ? 8 : 10));
    else if (acClass === 'Narrowbody') abreast = cls === 'first' ? 2 : (cls === 'business' ? 4 : (cls === 'premium' ? 5 : 6));
    else abreast = cls === 'first' ? 2 : (cls === 'business' ? 3 : (cls === 'premium' ? 4 : 4));

    const innerHeight = acClass === 'Widebody' ? 150 : (acClass === 'Narrowbody' ? 110 : 80);

    let numAisles = 0;
    for(let c=0; c<abreast; c++) {
       if (abreast === 10 && (c === 2 || c === 6)) numAisles++;
       else if (abreast === 9 && (c === 2 || c === 5)) numAisles++;
       else if (abreast === 8 && (c === 1 || c === 5)) numAisles++;
       else if (abreast === 7 && (c === 1 || c === 4)) numAisles++;
       else if (abreast === 6 && acClass === 'Widebody' && (c === 1 || c === 3)) numAisles++;
       else if (abreast === 6 && acClass !== 'Widebody' && acClass !== 'Narrowbody' && c === 2) numAisles++;
       else if (abreast === 6 && acClass === 'Narrowbody' && c === 2) numAisles++;
       else if (abreast === 5 && c === 1) numAisles++;
       else if (abreast === 4 && acClass === 'Widebody' && (c === 0 || c === 2)) numAisles++;
       else if (abreast === 4 && acClass !== 'Widebody' && c === 1) numAisles++;
       else if (abreast === 3 && c === 0) numAisles++;
       else if (abreast === 2 && c === 0) numAisles++;
    }

    const aislePx = acClass === 'Widebody' ? 16 : (acClass === 'Narrowbody' ? 14 : 12);
    const aisleWidth = `${aislePx}px`;
    const nonSeatSpace = numAisles * aislePx;
    // Calculate size perfectly to fill 100% of height. Subtracted nonSeatSpace for aisles.
    const calculatedSize = Math.max(8, Math.floor((innerHeight - nonSeatSpace) / abreast));
    
    let sizeStyle = { width: `${calculatedSize}px`, height: `${calculatedSize}px` };

    let seatColor = "bg-aero-yellow";
    let backColor = "bg-aero-yellow";
    let bodyColor = "bg-aero-yellow/80";

    if (cls === 'first') {
      sizeStyle = { width: `${calculatedSize + 4}px`, height: `${calculatedSize}px` };
    }
    else if (cls === 'business') {
      seatColor = "bg-white/10"; backColor = "bg-white/10"; bodyColor = "bg-white/5";
      sizeStyle = { width: `${calculatedSize + 2}px`, height: `${calculatedSize}px` };
    }
    else if (cls === 'premium') {
      seatColor = "bg-aero-yellow"; backColor = "bg-aero-yellow"; bodyColor = "bg-aero-yellow/80";
    }
    else if (cls === 'economy') {
      seatColor = "bg-aero-carbon"; backColor = "bg-aero-carbon"; bodyColor = "bg-aero-carbon/80";
    }

    const isSuite = type.includes('Suite') || type === 'Residence';
    const isFlatBed = type.includes('Flat') || type === 'Sleeper';

    const rows = Math.ceil(count / abreast);

    return (
       <div className="absolute inset-0 flex flex-row items-stretch justify-start overflow-hidden pointer-events-none gap-[1px]">
          {Array.from({length: rows}).map((_, r) => {
             const seatsInRow = Math.min(abreast, count - (r * abreast));
             return (
               <div key={r} className="flex-1 flex flex-col items-stretch justify-between h-full gap-0">
                   {Array.from({length: abreast}).map((_, c) => {
                       let isAisle = false;
                       if (abreast === 10 && (c === 2 || c === 6)) isAisle = true;
                       else if (abreast === 9 && (c === 2 || c === 5)) isAisle = true;
                       else if (abreast === 8 && (c === 1 || c === 5)) isAisle = true;
                       else if (abreast === 7 && (c === 1 || c === 4)) isAisle = true;
                       else if (abreast === 6 && acClass === 'Widebody' && (c === 1 || c === 3)) isAisle = true;
                       else if (abreast === 6 && acClass !== 'Widebody' && c === 2) isAisle = true;
                       else if (abreast === 5 && c === 1) isAisle = true;
                       else if (abreast === 4 && acClass === 'Widebody' && (c === 0 || c === 2)) isAisle = true;
                       else if (abreast === 4 && acClass !== 'Widebody' && c === 1) isAisle = true;
                       else if (abreast === 3 && c === 0) isAisle = true;
                       else if (abreast === 2 && c === 0) isAisle = true;

                       const isVisible = c < seatsInRow;

                       return (
                           <div key={c}
                                className={`relative flex-1 flex flex-col justify-between overflow-hidden shadow-sm rounded-[1.5px] ${
                                  isSuite ? 'border border-white/40 bg-aero-carbon' : `${bodyColor} border border-white/10`
                                }`}
                                style={{
                                   marginBottom: isAisle ? (cls === 'first' && !isSuite ? (acClass === 'Regional' ? '24px' : '44px') : (acClass === 'Regional' ? '8px' : '14px')) : '1px',
                                   visibility: isVisible ? 'visible' : 'hidden',
                                   marginRight: '45%'
                                }}>
                               {isSuite ? (
                                 <div className="absolute inset-[1px] flex items-center justify-center">
                                    <div className={`w-full h-full ${backColor} rounded-[1px]`} />
                                    <div className={`absolute left-0 w-[40%] h-full ${seatColor} rounded-l-[1px]`} />
                                 </div>
                               ) : isFlatBed ? (
                                 <div className="w-full h-full flex flex-row">
                                    <div className={`w-[70%] h-full ${seatColor} rounded-l-[1px]`} />
                                    <div className={`w-[30%] h-full ${backColor} rounded-r-[1px]`} />
                                 </div>
                               ) : (
                                 <>
                                   {/* Seat Cushion: rounded at the front (nose-facing) edge, shaded towards the back */}
                                   <div className={`absolute inset-y-0 left-[6%] right-[26%] rounded-l-[1px] ${seatColor} shadow-inner bg-gradient-to-r from-transparent to-black/25`} />
                                   {/* Seat Back */}
                                   <div className={`absolute inset-y-0 right-0 w-[26%] ${backColor} shadow-md border-l border-white/5 rounded-r-[1.5px]`} />
                                   {/* Headrest, narrower than the backrest so its curve reads as a headrest bump */}
                                   <div className="absolute right-[3%] top-[18%] bottom-[18%] w-[14%] bg-white/15 rounded-full" />
                                   {/* Armrests separating neighbouring seats */}
                                   <div className={`absolute top-0 left-[4%] right-[24%] h-[1px] ${cls === 'economy' ? 'bg-white/10' : 'bg-white/20'}`} />
                                   <div className={`absolute bottom-0 left-[4%] right-[24%] h-[1px] ${cls === 'economy' ? 'bg-white/10' : 'bg-white/20'}`} />
                                 </>
                               )}
                           </div>
                       )
                   })}
               </div>
             )
          })}
       </div>
    );
  };

  // Each class's details: seat type and pitch beside the soft product, or one
  // above the other on phones, where two half-width columns are too narrow.
  const renderClassDetails = () => {
    if (!selectedClass) return null;

    if (selectedClass === 'first') {
      return (
        <div className="w-full max-w-4xl relative z-10 flex flex-col md:flex-row border border-white/10 bg-black/60 rounded-sm">
          <div className="w-full md:w-1/2 p-4 border-b md:border-b-0 md:border-r border-white/5 flex flex-col">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white/80 border-b border-white/10 pb-2 mb-4 text-center">Seat Type & Pitch</h3>
            <div className="flex flex-col gap-3 mb-3">
              <label className="text-xs font-mono uppercase tracking-widest text-white/60">Seat Pitch ({firstPitch} cm)</label>
              <input type="range" min="150" max="220" value={firstPitch} onChange={(e) => setFirstPitch(parseInt(e.target.value))} className="w-full accent-amber-500" />
              <div className="flex justify-between text-2xs font-mono text-white/40">
                <span>150 cm</span><span>220 cm</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-grow">
              {SEAT_DEFS.first.map((t, i) => {
                const disabled = currentDateOffset < t.req;
                return (
                  <label key={i} className={`flex items-center justify-between p-3 border rounded-sm transition-colors cursor-pointer ${disabled ? 'opacity-30 border-white/5 pointer-events-none' : 'hover:bg-white/5 border-white/10'} ${firstType === t.n ? 'bg-white/5 border-amber-500/50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <input type="radio" checked={firstType === t.n} disabled={disabled} onChange={() => setFirstType(t.n)} className="accent-amber-500 hidden" />
                      <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${firstType === t.n ? 'border-amber-500' : 'border-white/20'}`}>
                        {firstType === t.n && <div className="w-1.5 h-1.5 bg-aero-yellow rounded-full" />}
                      </div>
                      <span className={`text-sm font-mono transition-colors ${firstType === t.n ? 'text-aero-yellow' : 'text-white/70'}`}>{t.n}</span>
                      <SeatInfoTooltip title={t.n} desc={`${signedPts(t.pop * SEAT_TYPE_POP_FACTOR)}. Space multiplier: ${t.m}x.`} hidden={disabled} />
                    </div>
                    <span className={`text-2xs uppercase font-mono transition-colors ${firstType === t.n ? 'text-aero-yellow opacity-80' : 'text-white/40'}`}>
                      {disabled ? `Avail. ${1960 + Math.floor(t.req / 12)}` : (t.c ? `${t.c > 0 ? '+' : ''}$${t.c}` : 'Standard')}
                    </span>
                  </label>
                )
              })}
            </div>
            
          </div>
          <div className="w-full md:w-1/2 p-4 flex flex-col">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white/80 border-b border-white/10 pb-2 mb-4 text-center">Seat Extras</h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
              {[
                { id: 'ife', state: firstIFE, setter: setFirstIFE, req: 240, price: 1000, label: 'In-Flight Ent.', title: 'In-Flight Entertainment', desc: `Personal screens with movies and games. ${signedPts(FEATURE_POP.first.ife)}.` },
                { id: 'power', state: firstPower, setter: setFirstPower, req: 360, price: 300, label: 'In-Seat Power', title: 'In-Seat Power', desc: `Provides AC power/USB ports. ${signedPts(FEATURE_POP.first.power)}.` },
                { id: 'wardrobe', state: firstWardrobe, setter: setFirstWardrobe, req: 240, price: 800, label: 'Pers. Wardrobe', title: 'Personal Wardrobe', desc: `A slim locker built into the seat shell for suits and coats. ${signedPts(FEATURE_POP.first.wardrobe)}.` },
                { id: 'wood', state: firstWoodLeather, setter: setFirstWoodLeather, req: 360, price: 3000, label: 'Wood/Leather', title: 'Fine Wood & Leather', desc: `High-quality trim on consoles and armrests. ${signedPts(FEATURE_POP.first.wood)}.` },
                { id: 'mirror', state: firstMirrors, setter: setFirstMirrors, req: 480, price: 400, label: 'Vanity Mirror', title: 'Illuminated Vanity Mirror', desc: `A vanity mirror built into a fold-out stowage compartment. ${signedPts(FEATURE_POP.first.mirror)}.` },
                { id: 'minibar', state: firstMinibar, setter: setFirstMinibar, req: 600, price: 2500, label: 'Personal Minibar', title: 'Integrated Minibar', desc: `A private, partly chilled drinks compartment in the side wall. ${signedPts(FEATURE_POP.first.minibar)}.` },
                { id: 'climate', state: firstActiveClimate, setter: setFirstActiveClimate, req: 720, price: 4000, label: 'Active Climate', title: 'Active Seat Climate', desc: `Heating mats and micro fans in cushion and backrest for individual temperature control. ${signedPts(FEATURE_POP.first.climate)}.` }
              ].sort((a, b) => {
                const aAvail = currentDateOffset >= a.req;
                const bAvail = currentDateOffset >= b.req;
                if (aAvail !== bAvail) return aAvail ? -1 : 1;
                return a.price - b.price;
              }).map(ext => {
                const available = currentDateOffset >= ext.req;
                const activeColor = "text-aero-yellow";
                const activeBorder = "border-amber-500/50";
                const activeBg = "bg-white/5";
                
                return (
                  <label key={ext.id} className={`flex items-center gap-3 p-3 transition-colors cursor-pointer rounded-sm border ${!available ? 'opacity-50 pointer-events-none border-white/5 bg-black/20' : (ext.state ? activeBg + ' ' + activeBorder : 'hover:bg-white/5 border-white/5')}`}>
                    <input type="checkbox" checked={ext.state} disabled={!available} onChange={(e) => ext.setter(e.target.checked)} className="accent-amber-500" />
                    <div className="flex flex-col w-full">
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-sm font-mono transition-colors ${ext.state ? activeColor : 'text-white/70'}`}>{ext.label}</span>
                        <SeatInfoTooltip title={ext.title} desc={ext.desc} hidden={!available} />
                      </div>
                      <span className={`text-2xs font-mono mt-0.5 transition-colors ${ext.state ? activeColor + ' opacity-80' : 'text-white/40'}`}>
                        {available ? `+$${ext.price.toLocaleString()}` : `Avail. ${1960 + Math.floor(ext.req / 12)}`}
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
        <div className="w-full max-w-4xl relative z-10 flex flex-col md:flex-row border border-white/10 bg-black/60 rounded-sm">
          <div className="w-full md:w-1/2 p-4 border-b md:border-b-0 md:border-r border-white/5 flex flex-col">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white/80 border-b border-white/10 pb-2 mb-4 text-center">Seat Type & Pitch</h3>
            <div className="flex flex-col gap-3 mb-3">
              <label className="text-xs font-mono uppercase tracking-widest text-white/60">Seat Pitch ({bizPitch} cm)</label>
              <input type="range" min="100" max="180" value={bizPitch} onChange={(e) => setBizPitch(parseInt(e.target.value))} className="w-full accent-blue-500" />
              <div className="flex justify-between text-2xs font-mono text-white/40">
                <span>100 cm</span><span>180 cm</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-grow">
              {SEAT_DEFS.business.map((t, i) => {
                const disabled = currentDateOffset < t.req;
                return (
                  <label key={i} className={`flex items-center justify-between p-3 border rounded-sm transition-colors cursor-pointer ${disabled ? 'opacity-30 border-white/5 pointer-events-none' : 'hover:bg-white/5 border-white/10'} ${bizType === t.n ? 'bg-white/5 border-white/10' : ''}`}>
                    <div className="flex items-center gap-3">
                      <input type="radio" checked={bizType === t.n} disabled={disabled} onChange={() => setBizType(t.n)} className="accent-blue-500 hidden" />
                      <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${bizType === t.n ? 'border-white/20' : 'border-white/20'}`}>
                        {bizType === t.n && <div className="w-1.5 h-1.5 bg-white/10 rounded-full" />}
                      </div>
                      <span className={`text-sm font-mono transition-colors ${bizType === t.n ? 'text-white/80' : 'text-white/70'}`}>{t.n}</span>
                      <SeatInfoTooltip title={t.n} desc={`${signedPts(t.pop * SEAT_TYPE_POP_FACTOR)}. Space multiplier: ${t.m}x.`} hidden={disabled} />
                    </div>
                    <span className={`text-2xs uppercase font-mono transition-colors ${bizType === t.n ? 'text-white/80 opacity-80' : 'text-white/40'}`}>
                      {disabled ? `Avail. ${1960 + Math.floor(t.req / 12)}` : (t.c ? `${t.c > 0 ? '+' : ''}$${t.c}` : 'Standard')}
                    </span>
                  </label>
                )
              })}
            </div>
            
          </div>
          <div className="w-full md:w-1/2 p-4 flex flex-col">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white/80 border-b border-white/10 pb-2 mb-4 text-center">Seat Extras</h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
              {[
                { id: 'ife', state: bizIFE, setter: setBizIFE, req: 240, price: 600, label: 'In-Flight Ent.', title: 'In-Flight Entertainment', desc: `Personal screens with movies and games. ${signedPts(FEATURE_POP.business.ife)}.` },
                { id: 'power', state: bizPower, setter: setBizPower, req: 360, price: 200, label: 'In-Seat Power', title: 'In-Seat Power', desc: `Provides AC power/USB ports. ${signedPts(FEATURE_POP.business.power)}.` },
                { id: 'lumbar', state: bizLumbarSupport, setter: setBizLumbarSupport, req: 180, price: 200, label: 'Lumbar Support', title: 'Mechanical Lumbar Support', desc: `An adjustable cushion in the lower back for better support. ${signedPts(FEATURE_POP.business.lumbar)}.` },
                { id: 'control', state: bizElecSeatControl, setter: setBizElecSeatControl, req: 300, price: 800, label: 'Elec. Seat Control', title: 'Electric Seat Control', desc: `Continuous adjustment at the push of a button instead of mechanical levers. ${signedPts(FEATURE_POP.business.control)}.` },
                { id: 'massage', state: bizMassage, setter: setBizMassage, req: 420, price: 1200, label: 'Pneumatic Massage', title: 'Pneumatic Massage', desc: `Air cells in the backrest inflate and deflate rhythmically. ${signedPts(FEATURE_POP.business.massage)}.` },
                { id: 'divider', state: bizPrivacyDivider, setter: setBizPrivacyDivider, req: 540, price: 1500, label: 'Privacy Divider', title: 'Motorised Privacy Divider', desc: `A partition to the neighbouring seat that rises at the push of a button. ${signedPts(FEATURE_POP.business.divider)}.` },
                { id: 'charging', state: bizInductiveCharging, setter: setBizInductiveCharging, req: 720, price: 300, label: 'Inductive Charging', title: 'Inductive Charging Pad', desc: `Wireless charging on the console beside the seat. ${signedPts(FEATURE_POP.business.charging)}.` }
              ].sort((a, b) => {
                const aAvail = currentDateOffset >= a.req;
                const bAvail = currentDateOffset >= b.req;
                if (aAvail !== bAvail) return aAvail ? -1 : 1;
                return a.price - b.price;
              }).map(ext => {
                const available = currentDateOffset >= ext.req;
                const activeColor = "text-white/80";
                const activeBorder = "border-white/10";
                const activeBg = "bg-white/5";
                
                return (
                  <label key={ext.id} className={`flex items-center gap-3 p-3 transition-colors cursor-pointer rounded-sm border ${!available ? 'opacity-50 pointer-events-none border-white/5 bg-black/20' : (ext.state ? activeBg + ' ' + activeBorder : 'hover:bg-white/5 border-white/5')}`}>
                    <input type="checkbox" checked={ext.state} disabled={!available} onChange={(e) => ext.setter(e.target.checked)} className="accent-blue-500" />
                    <div className="flex flex-col w-full">
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-sm font-mono transition-colors ${ext.state ? activeColor : 'text-white/70'}`}>{ext.label}</span>
                        <SeatInfoTooltip title={ext.title} desc={ext.desc} hidden={!available} />
                      </div>
                      <span className={`text-2xs font-mono mt-0.5 transition-colors ${ext.state ? activeColor + ' opacity-80' : 'text-white/40'}`}>
                        {available ? `+$${ext.price.toLocaleString()}` : `Avail. ${1960 + Math.floor(ext.req / 12)}`}
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
        <div className="w-full max-w-4xl relative z-10 flex flex-col md:flex-row border border-white/10 bg-black/60 rounded-sm">
          <div className="w-full md:w-1/2 p-4 border-b md:border-b-0 md:border-r border-white/5 flex flex-col">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white/80 border-b border-white/10 pb-2 mb-4 text-center">Seat Type & Pitch</h3>
            <div className="flex flex-col gap-3 mb-3">
              <label className="text-xs font-mono uppercase tracking-widest text-white/60">Seat Pitch ({premPitch} cm)</label>
              <input type="range" min="85" max="105" value={premPitch} onChange={(e) => setPremPitch(parseInt(e.target.value))} className="w-full accent-emerald-500" />
              <div className="flex justify-between text-2xs font-mono text-white/40">
                <span>85 cm</span><span>105 cm</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-grow">
              {SEAT_DEFS.premium.map((t, i) => {
                const disabled = currentDateOffset < t.req;
                return (
                  <label key={i} className={`flex items-center justify-between p-3 border rounded-sm transition-colors cursor-pointer ${disabled ? 'opacity-30 border-white/5 pointer-events-none' : 'hover:bg-white/5 border-white/10'} ${premType === t.n ? 'bg-white/5 border-aero-yellow/50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <input type="radio" checked={premType === t.n} disabled={disabled} onChange={() => setPremType(t.n)} className="accent-emerald-500 hidden" />
                      <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${premType === t.n ? 'border-aero-yellow' : 'border-white/20'}`}>
                        {premType === t.n && <div className="w-1.5 h-1.5 bg-aero-yellow rounded-full" />}
                      </div>
                      <span className={`text-sm font-mono transition-colors ${premType === t.n ? 'text-aero-yellow' : 'text-white/70'}`}>{t.n}</span>
                      <SeatInfoTooltip title={t.n} desc={`${signedPts(t.pop * SEAT_TYPE_POP_FACTOR)}. Space multiplier: ${t.m}x.`} hidden={disabled} />
                    </div>
                    <span className={`text-2xs uppercase font-mono transition-colors ${premType === t.n ? 'text-aero-yellow opacity-80' : 'text-white/40'}`}>
                      {disabled ? `Avail. ${1960 + Math.floor(t.req / 12)}` : (t.c ? `${t.c > 0 ? '+' : ''}$${t.c}` : 'Standard')}
                    </span>
                  </label>
                )
              })}
            </div>
            
          </div>
          <div className="w-full md:w-1/2 p-4 flex flex-col">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white/80 border-b border-white/10 pb-2 mb-4 text-center">Seat Extras</h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
              {[
                { id: 'ife', state: premIFE, setter: setPremIFE, req: 240, price: 400, label: 'In-Flight Ent.', title: 'In-Flight Entertainment', desc: `Personal screens with movies and games. ${signedPts(FEATURE_POP.premium.ife)}.` },
                { id: 'power', state: premPower, setter: setPremPower, req: 420, price: 150, label: 'In-Seat Power', title: 'In-Seat Power', desc: `Provides AC power/USB ports. ${signedPts(FEATURE_POP.premium.power)}.` },
                { id: 'table', state: premCocktailTable, setter: setPremCocktailTable, req: 180, price: 50, label: 'Cocktail Table', title: 'Integrated Cocktail Table', desc: `A small fixed side table on the armrest. ${signedPts(FEATURE_POP.premium.table)}.` },
                { id: 'calf', state: premCalfRest, setter: setPremCalfRest, req: 300, price: 150, label: 'Calf Rest', title: 'Fold-out Calf Rest', desc: `A rest built into the seat that folds up. ${signedPts(FEATURE_POP.premium.calf)}.` },
                { id: 'foot', state: premFootrests, setter: setPremFootrests, req: 420, price: 100, label: 'Multi-Stage Footrest', title: 'Multi-Stage Footrest', desc: `Fold-out bars under the seat in front for the feet. ${signedPts(FEATURE_POP.premium.foot)}.` },
                { id: 'light', state: premGooseneckLight, setter: setPremGooseneckLight, req: 600, price: 80, label: 'Gooseneck Lamp', title: 'Gooseneck Reading Lamp', desc: `An individually adjustable LED reading light at the seat. ${signedPts(FEATURE_POP.premium.light)}.` },
                { id: 'usbc', state: premUSBC, setter: setPremUSBC, req: 720, price: 100, label: 'USB-C Fast Charge', title: 'USB-C Fast Charging', desc: `Fast-charging ports (e.g. 60 W) in the armrest. ${signedPts(FEATURE_POP.premium.usbc)}.` }
              ].sort((a, b) => {
                const aAvail = currentDateOffset >= a.req;
                const bAvail = currentDateOffset >= b.req;
                if (aAvail !== bAvail) return aAvail ? -1 : 1;
                return a.price - b.price;
              }).map(ext => {
                const available = currentDateOffset >= ext.req;
                const activeColor = "text-aero-yellow";
                const activeBorder = "border-aero-yellow/50";
                const activeBg = "bg-white/5";
                
                return (
                  <label key={ext.id} className={`flex items-center gap-3 p-3 transition-colors cursor-pointer rounded-sm border ${!available ? 'opacity-50 pointer-events-none border-white/5 bg-black/20' : (ext.state ? activeBg + ' ' + activeBorder : 'hover:bg-white/5 border-white/5')}`}>
                    <input type="checkbox" checked={ext.state} disabled={!available} onChange={(e) => ext.setter(e.target.checked)} className="accent-emerald-500" />
                    <div className="flex flex-col w-full">
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-sm font-mono transition-colors ${ext.state ? activeColor : 'text-white/70'}`}>{ext.label}</span>
                        <SeatInfoTooltip title={ext.title} desc={ext.desc} hidden={!available} />
                      </div>
                      <span className={`text-2xs font-mono mt-0.5 transition-colors ${ext.state ? activeColor + ' opacity-80' : 'text-white/40'}`}>
                        {available ? `+$${ext.price.toLocaleString()}` : `Avail. ${1960 + Math.floor(ext.req / 12)}`}
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
        <div className="w-full max-w-4xl relative z-10 flex flex-col md:flex-row border border-white/10 bg-black/60 rounded-sm">
          <div className="w-full md:w-1/2 p-4 border-b md:border-b-0 md:border-r border-white/5 flex flex-col">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white/80 border-b border-white/10 pb-2 mb-4 text-center">Seat Type & Pitch</h3>
            <div className="flex flex-col gap-3 mb-3">
              <label className="text-xs font-mono uppercase tracking-widest text-white/60">Seat Pitch ({ecoPitch} cm)</label>
              <input type="range" min="74" max="90" value={ecoPitch} onChange={(e) => setEcoPitch(parseInt(e.target.value))} className="w-full accent-slate-400" />
              <div className="flex justify-between text-2xs font-mono text-white/40">
                <span>74 cm</span><span>90 cm</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-grow">
              {SEAT_DEFS.economy.map((t, i) => {
                const disabled = currentDateOffset < t.req;
                return (
                  <label key={i} className={`flex items-center justify-between p-3 border rounded-sm transition-colors cursor-pointer ${disabled ? 'opacity-30 border-white/5 pointer-events-none' : 'hover:bg-white/5 border-white/10'} ${ecoType === t.n ? 'bg-white/5 border-slate-400/50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <input type="radio" checked={ecoType === t.n} disabled={disabled} onChange={() => setEcoType(t.n)} className="accent-slate-400 hidden" />
                      <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${ecoType === t.n ? 'border-slate-400' : 'border-white/20'}`}>
                        {ecoType === t.n && <div className="w-1.5 h-1.5 bg-aero-carbon rounded-full" />}
                      </div>
                      <span className={`text-sm font-mono transition-colors ${ecoType === t.n ? 'text-slate-400' : 'text-white/70'}`}>{t.n}</span>
                      <SeatInfoTooltip title={t.n} desc={`${signedPts(t.pop * SEAT_TYPE_POP_FACTOR)}. Space multiplier: ${t.m}x.`} hidden={disabled} />
                    </div>
                    <span className={`text-2xs uppercase font-mono transition-colors ${ecoType === t.n ? 'text-slate-400 opacity-80' : 'text-white/40'}`}>
                      {disabled ? `Avail. ${1960 + Math.floor(t.req / 12)}` : (t.c ? `${t.c > 0 ? '+' : ''}$${t.c}` : 'Standard')}
                    </span>
                  </label>
                )
              })}
            </div>
            
          </div>
          <div className="w-full md:w-1/2 p-4 flex flex-col">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white/80 border-b border-white/10 pb-2 mb-4 text-center">Seat Extras</h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
              {[
                { id: 'ife', state: ecoIFE, setter: setEcoIFE, req: 240, price: 300, label: 'In-Flight Ent.', title: 'In-Flight Entertainment', desc: `Personal screens with movies and games. ${signedPts(FEATURE_POP.economy.ife)}.` },
                { id: 'power', state: ecoPower, setter: setEcoPower, req: 420, price: 100, label: 'In-Seat Power', title: 'In-Seat Power', desc: `Provides AC power/USB ports. ${signedPts(FEATURE_POP.economy.power)}.` },
                { id: 'hooks', state: ecoHooks, setter: setEcoHooks, req: 180, price: 20, label: 'Coat Hooks', title: 'Integrated Coat Hooks', desc: `Fixed to the seat back or the tray-table latch. ${signedPts(FEATURE_POP.economy.hooks)}.` },
                { id: 'armrests', state: ecoMovableArmrests, setter: setEcoMovableArmrests, req: 300, price: 50, label: 'Mov. Armrests', title: 'Movable Armrests', desc: `Armrests that fold fully up for easier access. ${signedPts(FEATURE_POP.economy.armrests)}.` },
                { id: 'headrests', state: ecoAdjHeadrests, setter: setEcoAdjHeadrests, req: 420, price: 80, label: 'Adj. Headrests', title: 'Adjustable Headrests', desc: `With bendable side wings to steady the head. ${signedPts(FEATURE_POP.economy.headrests)}.` },
                { id: 'shell', state: ecoFixedShell, setter: setEcoFixedShell, req: 540, price: 200, label: 'Fixed-Shell', title: 'Fixed-Shell Design', desc: `A rigid shell on the seat back: reclining slides the seat forward inside it, so the passenger behind keeps their space. ${signedPts(FEATURE_POP.economy.shell)}.` },
                { id: 'ped', state: ecoPedHolder, setter: setEcoPedHolder, req: 660, price: 60, label: 'PED Holder', title: 'Device Holder (PED)', desc: `A ledge or clip at eye level for your own tablet or phone. ${signedPts(FEATURE_POP.economy.ped)}.` }
              ].sort((a, b) => {
                const aAvail = currentDateOffset >= a.req;
                const bAvail = currentDateOffset >= b.req;
                if (aAvail !== bAvail) return aAvail ? -1 : 1;
                return a.price - b.price;
              }).map(ext => {
                const available = currentDateOffset >= ext.req;
                const activeColor = "text-slate-400";
                const activeBorder = "border-slate-400/50";
                const activeBg = "bg-white/5";
                
                return (
                  <label key={ext.id} className={`flex items-center gap-3 p-3 transition-colors cursor-pointer rounded-sm border ${!available ? 'opacity-50 pointer-events-none border-white/5 bg-black/20' : (ext.state ? activeBg + ' ' + activeBorder : 'hover:bg-white/5 border-white/5')}`}>
                    <input type="checkbox" checked={ext.state} disabled={!available} onChange={(e) => ext.setter(e.target.checked)} className="accent-slate-400" />
                    <div className="flex flex-col w-full">
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-sm font-mono transition-colors ${ext.state ? activeColor : 'text-white/70'}`}>{ext.label}</span>
                        <SeatInfoTooltip title={ext.title} desc={ext.desc} hidden={!available} />
                      </div>
                      <span className={`text-2xs font-mono mt-0.5 transition-colors ${ext.state ? activeColor + ' opacity-80' : 'text-white/40'}`}>
                        {available ? `+$${ext.price.toLocaleString()}` : `Avail. ${1960 + Math.floor(ext.req / 12)}`}
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
    <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-2 md:p-4 short:p-1">
      <div className="bg-aero-panel border border-white/10 shadow-2xl w-full h-full max-h-[90vh] short:max-h-full flex flex-col rounded-sm overflow-hidden text-white font-sans">
        
        {/* Header. Wraps onto two lines on phones. */}
        <div className="md:h-16 short:h-auto px-3 md:px-4 py-2 md:py-0 short:py-1.5 bg-black/40 border-b border-white/5 flex flex-wrap md:flex-nowrap items-center shrink-0 justify-between gap-x-4 gap-y-1">
          <div className="flex items-center gap-4">
            
            <h2 className="text-base md:text-xl short:text-base font-black uppercase tracking-widest text-aero-yellow">
              {isRenovating ? `Reconfigure / Renovate: ${initialPlane.registration}` : `Configure: ${aircraft.manufacturer} ${aircraft.type}`}
            </h2>
          </div>
          <div className="font-mono text-white/50 text-2xs md:text-xs tracking-widest uppercase flex flex-wrap gap-x-4">
            <div>Plane Type SAT: {aircraft.popularity}%</div>
            <div>Max Empty Space: {TOTAL_SPACE} units</div>
          </div>
        </div>

        {/* Content. Phones, upright or sideways, stack the work area above the
            cabin panel and scroll the two together; from md up they sit side
            by side and scroll separately. */}
        <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden short:overflow-y-auto flex flex-col md:flex-row short:flex-col relative bg-gradient-to-br from-[#0a0a0a] to-[#111111]">
          
          {/* Main Work Area */}
          <div className="flex-none md:flex-1 short:flex-none md:min-h-0 min-w-0 flex flex-col items-center justify-start p-3 md:p-4 relative md:overflow-y-auto short:overflow-visible custom-scrollbar border-b md:border-b-0 short:border-b md:border-r short:border-r-0 border-white/5">
             <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542296332-2e4473faf563?q=80&w=1600&auto=format&fit=crop')] bg-cover bg-center opacity-5 pointer-events-none mix-blend-screen" />
            
             {/* Plane Schematic Container */}
             {/* Raised above the mode switcher (z-10) only while the zone details
                 show, since they overlap it; otherwise the switcher stays on top
                 of the fuselage's drop shadow, as before. */}
             <div className={`w-full relative ${shownZone ? 'z-20' : 'z-10'} mb-4 shrink-0`} style={{ maxWidth: Math.max(800, Math.min(2048, 400 + CAPACITY * 5)) + 'px' }}>
               <div className="text-2xs uppercase font-mono tracking-widest text-white/40 mb-4 text-center flex items-center justify-center gap-4">
                 <span>Cabin Layout ({aircraft.class})</span>
                 <span className={`flex items-center gap-1 ${isOverbooked ? 'text-aero-yellow/60 font-bold' : ''}`}>
                   <Info size={12}/> {(((usedSpaceWithoutEcoRaw + ecoSeats * ecoPitch * ecoMultiplier) / TOTAL_SPACE) * 100).toFixed(0)}% Space Used
                 </span>
               </div>
               
               <div className="relative w-full flex justify-center py-0 sm:py-0">
                     {/* Fuselage Background */}
                   <div className={`absolute inset-0 z-0 drop-shadow-2xl`} style={{ transform: 'scaleY(1.03)' }}>
                     <svg preserveAspectRatio="none" viewBox="0 0 1000 200" className="w-full h-full">
                        <path d="M 120,5 C 40,5 5,45 5,100 C 5,155 40,195 120,195 L 850,195 Q 880,195 910,170 L 980,115 Q 995,100 980,85 L 910,30 Q 880,5 850,5 Z" fill="#ebf0f5" stroke="rgba(0,0,0,0.05)" strokeWidth="3" />
                     </svg>
                   </div>
                   
                   {/* Main Container */}
                   <div className={`relative w-full overflow-hidden ${aircraft.class === 'Widebody' ? 'h-[150px]' : aircraft.class === 'Narrowbody' ? 'h-[110px]' : 'h-[80px]'} flex items-stretch py-0 z-10`}>
                      {/* Cockpit Windows */}
                      <div className={`absolute left-[3%] sm:left-[4%] ${aircraft.class === 'Widebody' ? 'top-[16%] bottom-[16%]' : aircraft.class === 'Narrowbody' ? 'top-[12%] bottom-[12%]' : 'top-[8%] bottom-[8%]'} w-[5%] sm:w-[5%] z-20 pointer-events-none drop-shadow-sm flex items-center justify-center`}>
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
                      <div className="relative flex-1 flex ml-[12%] sm:ml-[13%] mr-[12%] sm:mr-[15%] my-0 rounded-none overflow-hidden bg-black/5 border border-black/10">
                         {pFirst > 0 && (
                           <motion.div initial={false} animate={{ width: `${pFirst}%` }} className="group bg-aero-yellow/20 relative overflow-visible flex items-center justify-center border-r border-amber-500/50 cursor-pointer hover:bg-aero-yellow/40 transition-colors" onClick={() => setSelectedClass('first')} {...zonePointer('first')}>
                              {renderSeatDots(firstSeats, 'first', firstType, CAPACITY, aircraft.class)}
                              <span className={`font-mono text-xs font-bold text-white absolute ${shownZone === 'first' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity mix-blend-overlay z-10 pointer-events-none drop-shadow-md`}>FIRST</span>
                           </motion.div>
                         )}
                         {pBiz > 0 && (
                           <motion.div initial={false} animate={{ width: `${pBiz}%` }} className={`group bg-white/5 relative overflow-visible flex items-center justify-center border-r border-white/10 cursor-pointer hover:bg-white/5 transition-colors`} onClick={() => setSelectedClass('business')} {...zonePointer('business')}>
                              {renderSeatDots(bizSeats, 'business', bizType, CAPACITY, aircraft.class)}
                              <span className={`font-mono text-xs font-bold text-white absolute ${shownZone === 'business' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity mix-blend-overlay z-10 pointer-events-none drop-shadow-md`}>BUSINESS</span>
                           </motion.div>
                         )}
                         {pPrem > 0 && (
                           <motion.div initial={false} animate={{ width: `${pPrem}%` }} className={`group bg-aero-yellow/20 relative overflow-visible flex items-center justify-center border-r border-aero-yellow/50 cursor-pointer hover:bg-aero-yellow/40 transition-colors`} onClick={() => setSelectedClass('premium')} {...zonePointer('premium')}>
                              {renderSeatDots(premSeats, 'premium', premType, CAPACITY, aircraft.class)}
                              <span className={`font-mono text-xs font-bold text-white absolute ${shownZone === 'premium' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity mix-blend-overlay z-10 pointer-events-none drop-shadow-md`}>PREMIUM</span>
                           </motion.div>
                         )}
                         {pEco > 0 && (
                           <motion.div initial={false} animate={{ width: `${pEco}%` }} className={`group bg-aero-carbon/20 relative overflow-visible flex items-center justify-center cursor-pointer hover:bg-aero-carbon/40 transition-colors`} onClick={() => setSelectedClass('economy')} {...zonePointer('economy')}>
                              {renderSeatDots(ecoSeats, 'economy', ecoType, CAPACITY, aircraft.class)}
                              <span className={`font-mono text-xs font-bold text-white absolute ${shownZone === 'economy' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity mix-blend-overlay z-10 pointer-events-none drop-shadow-md`}>ECONOMY</span>
                           </motion.div>
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
                       first: { title: 'First Class', seats: firstSeats, type: firstType, pitch: firstPitch, border: 'border-amber-500/50', color: 'text-aero-yellow' },
                       business: { title: 'Business Class', seats: bizSeats, type: bizType, pitch: bizPitch, border: 'border-white/10', color: 'text-white/80' },
                       premium: { title: 'Premium Economy', seats: premSeats, type: premType, pitch: premPitch, border: 'border-aero-yellow/50', color: 'text-aero-yellow' },
                       economy: { title: 'Economy Class', seats: ecoSeats, type: ecoType, pitch: ecoPitch, border: 'border-slate-400/50', color: 'text-slate-400' },
                     }[shownZone];
                     return (
                       <div role="tooltip" className={`absolute top-full short:top-1/2 left-1/2 -translate-x-1/2 short:-translate-y-1/2 mt-2 short:mt-0 z-[100] pointer-events-none bg-black border ${zone.border} text-white p-3 rounded-sm shadow-2xl flex flex-col items-center min-w-[140px] whitespace-nowrap`}>
                         <span className={`font-mono text-2xs ${zone.color} font-bold uppercase tracking-widest mb-1`}>{zone.title}</span>
                         <span className="font-mono text-sm">{zone.seats} Seats</span>
                         <span className="font-mono text-2xs text-white/50">{zone.type} • {zone.pitch}cm Pitch</span>
                       </div>
                     );
                   })()}
               </div>
             </div>

             {/* Configuration Mode Switcher */}
             <div className="flex gap-2 md:gap-4 w-full max-w-4xl relative z-10 mb-3 shrink-0 justify-center">
                <div 
                  id="general-settings-btn"
                  onClick={() => setActiveConfigTab('general')} 
                  className={`px-4 py-3 rounded-sm font-black uppercase tracking-[0.2em] text-2xs cursor-pointer transition-all border ${activeConfigTab === 'general' ? 'bg-aero-yellow text-black border-aero-yellow shadow-2xl' : 'bg-black/40 text-white/40 border-white/10 hover:border-white/30'}`}
                >
                   General Settings
                </div>
                <div 
                  id="class-settings-btn"
                  onClick={() => setActiveConfigTab('classes')} 
                  className={`px-4 py-3 rounded-sm font-black uppercase tracking-[0.2em] text-2xs cursor-pointer transition-all border ${activeConfigTab === 'classes' ? 'bg-aero-yellow text-black border-aero-yellow shadow-2xl' : 'bg-black/40 text-white/40 border-white/10 hover:border-white/30'}`}
                >
                   Class Settings
                </div>
             </div>

             {activeConfigTab === 'classes' ? (
               <>
                 {/* Clickable Stats Grid */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 w-full max-w-4xl relative z-10 mb-4 shrink-0">
                <div onClick={() => setSelectedClass('first')} className={`bg-black/40 border p-4 rounded-sm flex flex-col items-center cursor-pointer transition-all ${selectedClass === 'first' ? 'border-amber-500 bg-aero-yellow/10' : 'border-amber-500/20 hover:border-amber-500/50'}`}>
                  <div className="text-aero-yellow text-2xl font-black">{firstSeats}</div>
                  <div className="text-2xs uppercase font-mono tracking-widest text-white/50 mt-1 mb-2">First Class</div>
                  <div className="text-2xs bg-aero-yellow/20 text-aero-yellow px-2 py-0.5 rounded-sm font-bold">SAT: {Math.round(getFirstPop())}%</div>
                </div>
                <div onClick={() => setSelectedClass('business')} className={`bg-black/40 border p-4 rounded-sm flex flex-col items-center cursor-pointer transition-all ${selectedClass === 'business' ? 'border-white/20 bg-white/5' : 'border-white/10 hover:border-white/10'}`}>
                  <div className="text-white/80 text-2xl font-black">{bizSeats}</div>
                  <div className="text-2xs uppercase font-mono tracking-widest text-white/50 mt-1 mb-2">Business</div>
                  <div className="text-2xs bg-white/5 text-white/80 px-2 py-0.5 rounded-sm font-bold">SAT: {Math.round(getBizPop())}%</div>
                </div>
                <div onClick={() => setSelectedClass('premium')} className={`bg-black/40 border p-4 rounded-sm flex flex-col items-center cursor-pointer transition-all ${selectedClass === 'premium' ? 'border-aero-yellow bg-aero-yellow/10' : 'border-aero-yellow/20 hover:border-aero-yellow/50'}`}>
                  <div className="text-aero-yellow text-2xl font-black">{premSeats}</div>
                  <div className="text-2xs uppercase font-mono tracking-widest text-white/50 mt-1 mb-2">Premium Eco</div>
                  <div className="text-2xs bg-aero-yellow/20 text-aero-yellow px-2 py-0.5 rounded-sm font-bold">SAT: {Math.round(getPremPop())}%</div>
                </div>
                <div onClick={() => setSelectedClass('economy')} className={`bg-black/40 border p-4 rounded-sm flex flex-col items-center cursor-pointer transition-all ${selectedClass === 'economy' ? 'border-slate-500 bg-aero-carbon/10' : 'border-slate-500/20 hover:border-slate-500/50'}`}>
                  <div className="text-slate-400 text-2xl font-black">{ecoSeats}</div>
                  <div className="text-2xs uppercase font-mono tracking-widest text-white/50 mt-1 mb-2">Economy</div>
                  <div className="text-2xs bg-aero-carbon/20 text-slate-400 px-2 py-0.5 rounded-sm font-bold">SAT: {Math.round(getEcoPop())}%</div>
                </div>
             </div>

             {/* Dynamic Class Details Panel */}
             {renderClassDetails()}
               </>
             ) : (
               <div className="w-full max-w-4xl relative z-10 flex flex-col border border-white/10 bg-black/60 rounded-sm p-4">
                  <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-4">
                     <Settings className="text-aero-yellow" size={24} />
                     <h3 className="text-xl font-black uppercase tracking-[0.3em] text-white">General Aircraft Settings</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 text-white">
                     <div className="flex flex-col gap-3">
                        <h4 className="text-2xs uppercase font-bold tracking-[0.4em] text-aero-yellow mb-2">Service Expansion</h4>
                        {[
                          { id: 'wifi', state: hasWifi, setter: setHasWifi, available: isWifiAvailable, label: 'In-Flight Wi-Fi', sub: isWifiAvailable ? '+$150,000' : 'Avail. 2000' },
                          { id: 'ambient', state: hasAmbientLighting, setter: setHasAmbientLighting, available: isAmbientAvailable, label: 'Ambient LED Lighting', sub: isAmbientAvailable ? '+$100,000' : 'Avail. 2005' },
                          { id: 'catering', state: hasPremiumCatering, setter: setHasPremiumCatering, available: true, label: 'Premium Catering Facilities', sub: '+$300,000' },
                        ].map(ext => (
                          <label key={ext.id} className={`flex items-center justify-between p-4 border rounded-sm transition-all cursor-pointer ${ext.available ? 'border-white/10 hover:bg-white/5' : 'opacity-30 border-white/5 pointer-events-none'} ${ext.state ? 'bg-aero-yellow/5 border-aero-yellow/50' : ''}`}>
                             <div className="flex items-center gap-4">
                                <input type="checkbox" checked={ext.state} onChange={(e) => ext.setter(e.target.checked)} className="accent-aero-yellow" />
                                <div className="flex flex-col">
                                   <span className={`text-sm font-mono ${ext.state ? 'text-aero-yellow' : 'text-white/80'}`}>{ext.label}</span>
                                   <span className="text-3xs uppercase tracking-widest text-white/40">{ext.sub}</span>
                                </div>
                             </div>
                          </label>
                        ))}
                     </div>

                     <div className="flex flex-col gap-3">
                        <h4 className="text-2xs uppercase font-bold tracking-[0.4em] text-aero-yellow mb-2">Luxury & Efficiency</h4>
                        {[
                          { id: 'bar', state: hasOnboardBar, setter: setHasOnboardBar, available: isBarAvailable, label: 'Onboard Lounge & Bar', sub: isBarAvailable ? '+$500,000' : 'Req. >200 CAP' },
                          { id: 'shower', state: hasShower, setter: setHasShower, available: isShowerAvailable, label: 'Shower Spa & Wellness', sub: isShowerAvailable ? '+$1,000,000' : 'Req. >300 CAP' },
                          { id: 'minimal', state: hasMinimalServices, setter: (v: boolean) => { setHasMinimalServices(v); if(v) setHasReducedGalley(false); }, available: true, label: 'Ultra-High Density Mode', sub: '-$50,000' },
                        ].map(ext => (
                          <label key={ext.id} className={`flex items-center justify-between p-4 border rounded-sm transition-all cursor-pointer ${ext.available ? 'border-white/10 hover:bg-white/5' : 'opacity-30 border-white/5 pointer-events-none'} ${ext.state ? 'bg-aero-yellow/5 border-aero-yellow/50' : ''}`}>
                             <div className="flex items-center gap-4">
                                <input type="checkbox" checked={ext.state} onChange={(e) => ext.setter(e.target.checked)} className="accent-aero-yellow" />
                                <div className="flex flex-col">
                                   <span className={`text-sm font-mono ${ext.state ? 'text-aero-yellow' : 'text-white/80'}`}>{ext.label}</span>
                                   <span className="text-3xs uppercase tracking-widest text-white/40">{ext.sub}</span>
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
          <div className="w-full md:w-[350px] short:w-full md:min-h-0 shrink-0 bg-black/20 p-4 flex flex-col md:overflow-y-auto short:overflow-visible custom-scrollbar">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white/80 flex items-center gap-2">
                <Settings size={16} className="text-aero-yellow" />
                Cabin Layout
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowSaveConfig(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 hover:bg-aero-yellow/10 hover:border-aero-yellow/30 text-white/70 hover:text-aero-yellow rounded-sm text-2xs font-mono uppercase tracking-widest transition-all"
                >
                  Save
                </button>
                <button 
                  onClick={() => setShowLoadConfig(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 hover:bg-aero-yellow/10 hover:border-aero-yellow/30 text-white/70 hover:text-aero-yellow rounded-sm text-2xs font-mono uppercase tracking-widest transition-all group"
                >
                  <Download size={12} className="group-hover:translate-y-[1px] transition-transform" /> Load
                </button>
              </div>
            </div>
            
            <div className="flex flex-col gap-3 font-mono">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-2xs uppercase tracking-widest">
                  <span className="text-aero-yellow font-bold">First</span>
                  <span className="text-white/60">{firstSeats}</span>
                </div>
                <input 
                  type="range" min="0" max={maxFirstSeats} step="1" value={firstSeats}
                  onChange={(e) => setFirstSeats(parseInt(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-white/10 rounded-full appearance-none"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-2xs uppercase tracking-widest">
                  <span className="text-white/80 font-bold">Business</span>
                  <span className="text-white/60">{bizSeats}</span>
                </div>
                <input 
                  type="range" min="0" max={maxBizSeats} step="1" value={bizSeats}
                  onChange={(e) => setBizSeats(parseInt(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer h-1.5 bg-white/10 rounded-full appearance-none"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-2xs uppercase tracking-widest">
                  <span className="text-aero-yellow font-bold">Premium Eco</span>
                  <span className="text-white/60">{premSeats}</span>
                </div>
                <input 
                  type="range" min="0" max={maxPremSeats} step="1" value={premSeats}
                  onChange={(e) => setPremSeats(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-white/10 rounded-full appearance-none"
                />
              </div>

              <div className="flex flex-col gap-2 opacity-50 block cursor-not-allowed">
                <div className="flex justify-between text-2xs uppercase tracking-widest">
                  <span className="text-slate-400 font-bold">Economy (Auto)</span>
                  <span className="text-white/60">{ecoSeats}</span>
                </div>
                <input 
                  type="range" min="0" max={CAPACITY} value={ecoSeats} readOnly
                  className="w-full accent-slate-400 h-1.5 bg-white/10 rounded-full appearance-none pointer-events-none"
                />
              </div>
            </div>

            {/* Aircraft-Wide Extras */}
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white/80 border-b border-white/10 pb-3 mb-4 mt-8 flex justify-between items-center">
              Aircraft Extras
              {extrasSpace > 0 && <span className="text-3xs text-white/50">-{extrasSpace} units</span>}
            </h3>
            <div className="flex flex-col gap-2 relative">
              {[
                { id: 'wifi', state: hasWifi, setter: setHasWifi, available: isWifiAvailable, price: 150000, label: 'In-Flight Wi-Fi', title: 'In-Flight Wi-Fi', desc: `Satellite broadband connection for passengers. Crucial for modern business travelers.\n\n${signedPts(CABIN_EXTRA_POP.wifi)}\n+$150,000 Upfront Cost${!isWifiAvailable ? '\n\nTechnology not yet available (req. Year 2000+)' : ''}`, sub: isWifiAvailable ? '+$150,000' : 'Avail. 2000' },
                { id: 'ambient', state: hasAmbientLighting, setter: setHasAmbientLighting, available: isAmbientAvailable, price: 100000, label: 'Ambient Lighting', title: 'Ambient Lighting', desc: `Dynamic LED mood lighting that reduces jet lag and improves cabin aesthetics.\n\n${signedPts(CABIN_EXTRA_POP.ambient)}\n+$100,000 Upfront Cost${!isAmbientAvailable ? '\n\nTechnology not yet available (req. Year 2005+)' : ''}`, sub: isAmbientAvailable ? '+$100,000' : 'Avail. 2005' },
                { id: 'catering', state: hasPremiumCatering, setter: setHasPremiumCatering, available: true, price: 300000, label: 'Prem. Catering Fac.', title: 'Premium Catering', desc: `Expanded galley with ovens and chillers for multi-course hot meals. Takes up floor space.\n\n${signedPts(CABIN_EXTRA_POP.catering)}\n+$300,000 Upfront Cost\n-200 Cabin Space`, sub: '+$300,000' },
                { id: 'bar', state: hasOnboardBar, setter: setHasOnboardBar, available: isBarAvailable, price: 500000, label: 'Onboard Bar', title: 'Onboard Bar & Lounge', desc: `A luxurious standing bar and lounge area for premium passengers. Massive satisfaction boost but consumes extreme floor space.\n\n${signedPts(CABIN_EXTRA_POP.bar)}\n+$500,000 Upfront Cost\n-400 Cabin Space${!isBarAvailable ? '\n\nRequires Widebody (200+ Cap) & Year 1970+' : ''}`, sub: isBarAvailable ? '+$500,000' : 'Req. >200 CAP / >1970' },
                { id: 'shower', state: hasShower, setter: setHasShower, available: isShowerAvailable, price: 1000000, label: 'Shower Spa', title: 'Shower Spa', desc: `The ultimate luxury. Allows first-class passengers to arrive refreshed. Carries large water tanks decreasing usable space dramatically.\n\n${signedPts(CABIN_EXTRA_POP.shower)}\n+$1,000,000 Upfront Cost\n-800 Cabin Space${!isShowerAvailable ? '\n\nRequires Super Jumbo (300+ Cap) & Year 2008+' : ''}`, sub: isShowerAvailable ? '+$1,000,000' : 'Req. >300 CAP / >2008' },
                { id: 'reduced', state: hasReducedGalley, setter: (v) => { setHasReducedGalley(v); if(v) setHasMinimalServices(false); }, available: true, price: -25000, label: 'Reduced Galley', title: 'Reduced Galley', desc: `Shrink the kitchen areas to cram in more seats. Saves money but passengers will notice the reduced service.\n\n${signedPts(CABIN_EXTRA_POP.reduced)}\n-$25,000 Upfront Cost\n+3% Cabin Space`, sub: '-$25,000' },
                { id: 'minimal', state: hasMinimalServices, setter: (v) => { setHasMinimalServices(v); if(v) setHasReducedGalley(false); }, available: true, price: -50000, label: 'Minimal Services', title: 'Minimal Services', desc: `Remove nearly all service areas (galleys, closets, extra bathrooms) to maximize passenger density. Expect complaints.\n\n${signedPts(CABIN_EXTRA_POP.minimal)}\n-$50,000 Upfront Cost\n+6% Cabin Space`, sub: '-$50,000' }
              ].sort((a, b) => {
                const aAvail = a.available;
                const bAvail = b.available;
                if (aAvail !== bAvail) return aAvail ? -1 : 1;
                return a.price - b.price;
              }).map(ext => {
                const isRed = ext.price < 0;
                const activeColor = isRed ? "text-aero-yellow/60" : "text-aero-yellow";
                const activeBorder = isRed ? "border-white/20" : "border-aero-yellow/50";
                const activeBg = isRed ? "bg-aero-panel" : "bg-white/5";
                const checkboxColor = isRed ? "accent-red-400" : "accent-aero-yellow";
                
                return (
                  <label key={ext.id} className={`group relative flex items-center gap-3 p-3 border rounded-sm transition-colors ${ext.available ? 'border-white/10 hover:bg-white/5 cursor-pointer' : 'border-white/5 opacity-40 cursor-not-allowed'} ${ext.state ? activeBg + ' ' + activeBorder : ''}`}>
                    <input type="checkbox" checked={ext.state} disabled={!ext.available} onChange={(e) => ext.setter(e.target.checked)} className={checkboxColor} />
                    <div className="flex flex-col w-full">
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-xs font-mono transition-colors ${ext.state ? activeColor : 'text-white/80'}`}>{ext.label}</span>
                        <SeatInfoTooltip title={ext.title} desc={ext.desc} hidden={!ext.available} />
                      </div>
                      <span className={`text-3xs mt-0.5 uppercase tracking-widest transition-colors ${ext.state ? activeColor + ' opacity-80' : 'text-white/40'}`}>{ext.sub}</span>
                    </div>
                  </label>
                );
              })}
            </div>


            {/* Config Impact Info */}
            <div className="mt-auto pt-6 border-t border-white/5 flex flex-col gap-4">
              <h4 className="text-2xs font-mono tracking-widest text-white/40 uppercase mb-2">Quality Estimate</h4>
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-2xs font-mono text-white/70 uppercase tracking-widest">Total Seats</span>
                <span className="text-sm font-bold font-mono">{totalSeats}</span>
              </div>
              
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-2xs font-mono text-white/70 uppercase tracking-widest">Interior SAT</span>
                <span className="text-sm font-bold font-mono text-white/90">{baseInteriorPop}%</span>
              </div>

              <div className="flex flex-col border-b border-white/5 pb-2 pt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xs font-mono text-aero-yellow uppercase tracking-widest">GENERAL PLANE SAT</span>
                  <div className="flex items-center gap-2">
                     <span className="text-sm font-bold text-aero-yellow font-mono">{totalPopularity}%</span>
                  </div>
                </div>
                <div className="text-4xs font-mono text-white/40 text-right uppercase mt-1 tracking-widest">
                  (Type Sat {aircraft.popularity}% × 1/3) + (Interior Sat {baseInteriorPop}% × 2/3)
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Footer */}
        {/* Footer. On phones the quantity, total and confirm button wrap
            below Cancel and the unit price. */}
        <div className="md:h-24 short:h-auto px-3 md:px-4 py-3 md:py-0 short:py-2 bg-black/80 border-t border-white/5 flex flex-wrap items-center justify-between shrink-0 gap-3 md:gap-4 relative z-20">
          
          <button onClick={onCancel} className="border border-white/20 text-white/60 font-black uppercase text-sm tracking-widest py-3 md:py-4 px-4 md:px-6 rounded-sm hover:text-white hover:bg-white/10 transition-all mr-auto short:py-2">Cancel</button>
          {/* The unit price steps aside on a phone held sideways, so the rest of
              the footer fits one row; the total next to the quantity says it. */}
          <div className="flex items-center gap-3 short:hidden">
             <div className="flex flex-col">
               <span className="text-2xs uppercase font-mono tracking-[0.2em] text-white/40">
                 {isRenovating ? 'Renovation Unit Cost' : 'Unit Price'}
               </span>
               <span className={`text-sm font-mono tracking-widest ${!canAfford ? 'text-aero-yellow/60' : ''}`}>
                 {formatCurrency(unitPrice)}
               </span>
             </div>
          </div>

          <div className="flex flex-wrap items-center justify-between md:justify-start gap-3 w-full md:w-auto short:w-auto">
            {!isRenovating && (
              <div className="flex items-center gap-4 short:gap-2 bg-white/5 border border-white/10 rounded-sm p-1">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  className="w-10 h-10 short:w-8 short:h-8 flex items-center justify-center bg-black/40 hover:bg-white/10 transition-colors disabled:opacity-30 disabled:hover:bg-black/40"
                >
                  <Minus size={16} />
                </button>
                <div className="font-mono text-xl font-bold w-12 text-center text-aero-yellow">{quantity}</div>
                <button 
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 short:w-8 short:h-8 flex items-center justify-center bg-black/40 hover:bg-white/10 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            )}

            <div className="flex flex-col items-end pr-4 border-r border-white/10">
              <span className="text-2xs uppercase font-mono tracking-widest text-white/50">Total Cost</span>
              <span className={`text-sm font-black tracking-widest ${!canAfford ? 'text-aero-warn' : 'text-aero-yellow'}`}>
                {formatCurrency(totalPrice)}
              </span>
              {/* The confirm button is disabled in these two cases. Without a reason
                  beside it, a dimmed button is indistinguishable from a broken one. */}
              {!canAfford && (
                <span className="text-3xs font-mono text-aero-warn mt-0.5 whitespace-nowrap">
                  {formatCurrency(totalPrice - capital)} short
                </span>
              )}
              {canAfford && isOverbooked && (
                <span className="text-3xs font-mono text-aero-warn mt-0.5 whitespace-nowrap">
                  Cabin exceeds available space
                </span>
              )}
            </div>

            <button 
              onClick={handleConfirm}
              disabled={!canAfford || isOverbooked}
              className="w-full md:w-auto short:w-auto bg-aero-yellow text-black font-black uppercase tracking-widest text-sm px-4 py-4 short:py-2.5 rounded-sm hover:bg-white transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-aero-yellow disabled:transform-none"
            >
              {isRenovating ? 'CONFIRM RENOVATION' : 'CONFIRM PURCHASE'}
            </button>
          </div>
        </div>
      </div>

      
      {showSaveConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-4 bg-black/80 backdrop-blur-sm pointer-events-auto" onClick={(e) => { if(e.target === e.currentTarget) setShowSaveConfig(false); }}>
          <div role="dialog" aria-modal="true" className="relative w-full max-w-sm bg-aero-panel border border-white/20 shadow-2xl flex flex-col p-4">
            <button onClick={() => setShowSaveConfig(false)} className="absolute top-4 right-6 text-white/50 hover:text-white transition-colors">
              <X size={24} />
            </button>
            <h3 className="text-xl font-black uppercase tracking-widest text-aero-yellow mb-2 border-b border-white/10 pb-4">Save Preset</h3>
            <p className="text-2xs text-white/50 font-mono mb-3 uppercase tracking-[0.2em]">{aircraft.manufacturer} {aircraft.type}</p>
            
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-2xs uppercase tracking-widest text-white/70 mb-2 block font-bold">Preset Name</label>
                <input 
                  type="text" 
                  value={savePresetName}
                  onChange={(e) => setSavePresetName(e.target.value)}
                  placeholder="e.g. High Density Eco"
                  className="w-full bg-black/40 border border-white/10 p-3 text-sm font-mono text-white focus:border-aero-yellow/50 outline-none"
                  autoFocus
                />
              </div>
              <button 
                onClick={handleSavePreset}
                disabled={!savePresetName.trim()}
                className="w-full bg-aero-yellow text-black font-black uppercase tracking-widest py-3 mt-2 hover:bg-aero-yellow transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoadConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-4 bg-black/80 backdrop-blur-sm pointer-events-auto" onClick={(e) => { if(e.target === e.currentTarget) setShowLoadConfig(false); }}>
          <div role="dialog" aria-modal="true" className="relative w-full max-w-2xl bg-aero-panel border border-white/20 shadow-2xl flex flex-col p-4 max-h-[80vh]">
            <button onClick={() => setShowLoadConfig(false)} className="absolute top-4 right-6 text-white/50 hover:text-white transition-colors">
              <X size={24} />
            </button>
            <h3 className="text-xl font-black uppercase tracking-widest text-aero-yellow mb-2 border-b border-white/10 pb-4">Load Configuration</h3>
            <p className="text-2xs text-white/50 font-mono mb-3 uppercase tracking-[0.2em]">{aircraft.manufacturer} {aircraft.type} Configurations</p>
            
            <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              {savedPresets.filter(p => p.aircraftId === aircraft.id).length > 0 && (
                <>
                  <h4 className="text-xs font-bold text-aero-yellow uppercase tracking-widest mb-2 mt-4">Global Presets</h4>
                  {savedPresets.filter(p => p.aircraftId === aircraft.id).map(preset => {
                    const c = preset.config;
                    const totalSeats = (c.first || 0) + (c.business || 0) + (c.premium || 0) + (c.economy || 0);
                    return (
                      <div key={preset.id} className="bg-aero-yellow/5 border border-aero-yellow/20 p-4 flex justify-between items-center hover:bg-aero-yellow/10 transition-colors cursor-pointer group" onClick={() => handleLoadConfig(preset)}>
                        <div>
                          <div className="font-bold text-white mb-1 uppercase tracking-widest flex items-center gap-2">
                            {preset.name}
                            <span className="font-mono text-2xs uppercase font-normal text-white/40 border border-white/10 px-1 rounded-sm">{totalSeats} SEATS</span>
                          </div>
                          <div className="flex gap-4 text-xs font-mono font-bold tracking-widest">
                            {c.first > 0 && <span className="text-aero-yellow">F{c.first}</span>}
                            {c.business > 0 && <span className="text-white/80">J{c.business}</span>}
                            {c.premium > 0 && <span className="text-aero-yellow">W{c.premium}</span>}
                            {c.economy > 0 && <span className="text-slate-400">Y{c.economy}</span>}
                            <span className="text-aero-yellow ml-2 before:content-['•'] before:mr-2 before:text-white/20">POP {preset.baseInteriorPop.toFixed(1)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => handleDeletePreset(preset.id, e)}
                            className="p-2 border border-white/20 text-aero-yellow/60/50 hover:bg-aero-panel-2 hover:text-white hover:border-white/10 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                          <div className="px-4 py-2 border border-aero-yellow/30 text-aero-yellow/70 text-2xs font-mono uppercase tracking-[0.2em] group-hover:bg-aero-yellow group-hover:text-black group-hover:border-aero-yellow transition-all">
                            Load
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <h4 className="text-xs font-bold text-aero-yellow uppercase tracking-widest mb-2 mt-6">Fleet Configurations</h4>
                </>
              )}

              {fleet.filter(f => f.id === aircraft.id).length === 0 && (
                <div className="text-center font-mono text-white/50 py-4 uppercase tracking-widest text-xs">
                  No previous configurations found.
                </div>
              )}
              {fleet.filter(f => f.id === aircraft.id).slice().sort((a,b) => b.baseInteriorPop - a.baseInteriorPop).map((plane, index) => {
                const c = plane.config;
                const totalSeats = (c.first || 0) + (c.business || 0) + (c.premium || 0) + (c.economy || 0);
                return (
                  <div key={plane.id + index} className="bg-white/5 border border-white/10 p-4 flex justify-between items-center hover:border-aero-yellow/50 hover:bg-white/10 transition-colors cursor-pointer group" onClick={() => handleLoadConfig(plane)}>
                    <div>
                      <div className="font-bold text-white mb-1 uppercase tracking-widest flex items-center gap-2">
                        {plane.registration}
                        <span className="font-mono text-2xs uppercase font-normal text-white/40 border border-white/10 px-1 rounded-sm">{totalSeats} SEATS</span>
                      </div>
                      <div className="flex gap-4 text-xs font-mono font-bold tracking-widest">
                        {c.first > 0 && <span className="text-aero-yellow">F{c.first}</span>}
                        {c.business > 0 && <span className="text-white/80">J{c.business}</span>}
                        {c.premium > 0 && <span className="text-aero-yellow">W{c.premium}</span>}
                        {c.economy > 0 && <span className="text-slate-400">Y{c.economy}</span>}
                        <span className="text-aero-yellow/70 ml-2 before:content-['•'] before:mr-2 before:text-white/20">POP {plane.baseInteriorPop.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="px-4 py-2 border border-white/20 text-white/50 text-2xs font-mono uppercase tracking-[0.2em] group-hover:bg-white group-hover:text-black group-hover:border-white transition-all">
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
