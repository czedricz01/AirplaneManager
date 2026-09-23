import React, { createContext, useContext, useMemo, useReducer, useState } from 'react';
import {
  PlannerAction,
  PlannerSelection,
  initialPlannerSelection,
  plannerReducer
} from './plannerState';

/**
 * The route planner's state, in one place.
 *
 * RoutePlannerView is 3,700 lines because everything in it reads the same
 * thirty-odd pieces of state. Measured, each wizard step would need between 40
 * and 113 bindings from the component body to be extracted as a child taking
 * props -- an interface that size makes the coupling visible without reducing
 * it, so the split was never worth doing.
 *
 * A context removes the interface entirely: an extracted block calls
 * usePlanner() and gets what it needs. The coupled transitions live in the
 * reducer (see plannerState.ts), where they are atomic and testable without
 * React; the independent UI flags stay as plain state here, because a reducer
 * would only add ceremony to a checkbox.
 */

export interface PlannerUiState {
  originSearch: string;
  destSearch: string;
  aircraftSearch: string;
  destSortBy: string;
  activeConfigClass: string | null;
  expandedSections: Record<string, boolean>;
  expandedMealCats: Record<string, boolean>;
  takeControl: Record<string, boolean>;
  showConfigSaveModal: boolean;
  showConfigLoadModal: boolean;
  newConfigName: string;
  showDemandDebug: boolean;
  showPricingDebug: boolean;
  isFinalizing: boolean;
  showSuccess: boolean;
}

const defaultUi: PlannerUiState = {
  originSearch: '',
  destSearch: '',
  aircraftSearch: '',
  destSortBy: 'tb',
  activeConfigClass: null,
  expandedSections: { plane: false, sce: false, airport: false },
  expandedMealCats: { Basic: false, Standard: false, Premium: false, Luxury: false },
  takeControl: { catering: false, extras: false, service: false },
  showConfigSaveModal: false,
  showConfigLoadModal: false,
  newConfigName: '',
  showDemandDebug: false,
  showPricingDebug: false,
  isFinalizing: false,
  showSuccess: false
};

export interface PlannerContextValue {
  /** Coupled route selection: step, endpoints, aircraft, schedule, cabin, fares. */
  selection: PlannerSelection;
  dispatch: React.Dispatch<PlannerAction>;
  /** Independent interface flags: searches, disclosure, modals. */
  ui: PlannerUiState;
  setUi: <K extends keyof PlannerUiState>(key: K, value: PlannerUiState[K]) => void;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

export function RoutePlannerProvider({
  children,
  initialSelection
}: {
  children: React.ReactNode;
  initialSelection?: Partial<PlannerSelection>;
}) {
  const [selection, dispatch] = useReducer(
    plannerReducer,
    initialSelection,
    initialPlannerSelection
  );
  const [ui, setUiState] = useState<PlannerUiState>(defaultUi);

  const setUi = React.useCallback(
    <K extends keyof PlannerUiState>(key: K, value: PlannerUiState[K]) => {
      setUiState(prev => (prev[key] === value ? prev : { ...prev, [key]: value }));
    },
    []
  );

  const value = useMemo<PlannerContextValue>(
    () => ({ selection, dispatch, ui, setUi }),
    [selection, ui, setUi]
  );

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext);
  if (!ctx) {
    throw new Error('usePlanner must be used inside a RoutePlannerProvider');
  }
  return ctx;
}
