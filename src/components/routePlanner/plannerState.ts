import type { ScheduledTrip } from '../RouteScheduleEditView';

/**
 * The route planner's core selection state.
 *
 * These nine values are the ones whose transitions are coupled: picking a
 * different origin invalidates the schedule, swapping the aircraft either
 * adapts the schedule or clears it, and both cases have to clear the validation
 * message at the same moment.
 *
 * That coupling used to live in an effect that compared the current values
 * against a ref of the previous ones and then fired three or four setState
 * calls. It worked, but the rule was implicit, it ran a render late, and every
 * block of the wizard that wanted to take part had to receive the setters as
 * props -- which is why extracting any part of the 3,700-line component needed
 * a props interface with dozens of entries.
 *
 * As a reducer the rule is written once, applied atomically, and testable
 * without React. UI-only state (search boxes, expanded sections, modals) stays
 * as plain useState in the provider: those transitions are independent and a
 * reducer would only add ceremony.
 */
export interface PlannerSelection {
  step: number;
  originId: string | null;
  destId: string | null;
  selectedReg: string | null;
  schedule: ScheduledTrip[];
  /**
   * The schedule set aside while no aircraft is selected.
   *
   * Changing aircraft is a two-step interaction in the UI: the current one is
   * deselected, then a new one is chosen. Without somewhere to keep it, the
   * schedule would be lost in between and the player would rebuild a week's
   * timetable to swap an aeroplane.
   */
  stashedSchedule: ScheduledTrip[];
  classConfigs: Record<string, any>;
  ticketPrices: Record<string, number>;
  validationMsg: string | null;
}

export type PlannerAction =
  | { type: 'setStep'; step: number }
  /** Picking either endpoint invalidates everything downstream of it. */
  | { type: 'selectOrigin'; originId: string | null }
  | { type: 'selectDest'; destId: string | null }
  /**
   * `adapt` carries the leg duration and turnaround for the newly chosen
   * aircraft, because the reducer cannot derive them: they depend on the
   * airports and the aircraft's cruise speed. `validationMsg` is the range and
   * ICAO check for the same pairing, computed by the caller for the same
   * reason. Passing null for `reg` deselects without discarding the schedule.
   */
  | { type: 'selectAircraft'; reg: string | null; adapt?: { durMin: number; turnoverMin: number }; validationMsg?: string | null }
  | { type: 'setSchedule'; schedule: ScheduledTrip[] }
  | { type: 'setClassConfigs'; classConfigs: Record<string, any> }
  | { type: 'setTicketPrices'; ticketPrices: Record<string, number> }
  | { type: 'setValidation'; message: string | null }
  /** Loads an existing route into the wizard without touching what is already set. */
  | { type: 'hydrate'; patch: Partial<PlannerSelection> };

export function initialPlannerSelection(overrides: Partial<PlannerSelection> = {}): PlannerSelection {
  return {
    step: 1,
    originId: null,
    destId: null,
    selectedReg: null,
    schedule: [],
    stashedSchedule: [],
    classConfigs: {},
    ticketPrices: {},
    validationMsg: null,
    ...overrides
  };
}

export function plannerReducer(state: PlannerSelection, action: PlannerAction): PlannerSelection {
  switch (action.type) {
    case 'setStep':
      return state.step === action.step ? state : { ...state, step: action.step };

    case 'selectOrigin': {
      if (state.originId === action.originId) return state;
      // A different endpoint means a different flight: nothing about the old
      // schedule survives, not even stashed.
      return {
        ...state,
        originId: action.originId,
        schedule: [],
        stashedSchedule: [],
        validationMsg: null
      };
    }

    case 'selectDest': {
      if (state.destId === action.destId) return state;
      return {
        ...state,
        destId: action.destId,
        schedule: [],
        stashedSchedule: [],
        validationMsg: null
      };
    }

    case 'selectAircraft': {
      if (state.selectedReg === action.reg) return state;

      if (action.reg === null) {
        // Deselecting: keep the timetable aside so choosing a replacement can
        // restore it instead of making the player build it again.
        return {
          ...state,
          selectedReg: null,
          stashedSchedule: state.schedule.length > 0 ? state.schedule : state.stashedSchedule,
          schedule: [],
          validationMsg: null
        };
      }

      const source = state.schedule.length > 0 ? state.schedule : state.stashedSchedule;
      if (source.length === 0) {
        return { ...state, selectedReg: action.reg, schedule: [], validationMsg: action.validationMsg ?? null };
      }

      // A new aircraft flies the same legs at its own speed and turnaround.
      const adapted = action.adapt
        ? source.map(trip => ({ ...trip, durMin: action.adapt!.durMin, turnoverMin: action.adapt!.turnoverMin }))
        : source.map(trip => ({ ...trip }));

      return {
        ...state,
        selectedReg: action.reg,
        schedule: adapted,
        stashedSchedule: adapted,
        validationMsg: action.validationMsg ?? null
      };
    }

    case 'setSchedule':
      return {
        ...state,
        schedule: action.schedule,
        // Keep the stash in step while a schedule exists, so a later aircraft
        // swap adapts the current timetable rather than a stale one.
        stashedSchedule: action.schedule.length > 0 ? action.schedule : state.stashedSchedule
      };

    case 'setClassConfigs':
      return { ...state, classConfigs: action.classConfigs };

    case 'setTicketPrices':
      return { ...state, ticketPrices: action.ticketPrices };

    case 'setValidation':
      return state.validationMsg === action.message ? state : { ...state, validationMsg: action.message };

    case 'hydrate':
      return { ...state, ...action.patch };

    default:
      return state;
  }
}
