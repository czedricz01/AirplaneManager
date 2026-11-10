import type { ReportMetrics } from './chronicle';
import type { ReportIncident } from './gameState';

/** One entry in the player's inbox. */
export interface GameMessage {
  id: number;
  text: string;
  isRead: boolean;
  dateStr: string;
  details?: {
    title: string;
    source: string;
    content: string;
  };
}

/** One weekly rotation of a route: out, turn round, back (or out only). */
export interface ScheduledTrip {
  id: string;
  groupId?: string;
  isGroupLead?: boolean;
  flightNumOut: string;
  flightNumIn: string;
  /** 1 = Monday ... 7 = Sunday. */
  dayId: number;
  startHour: number;
  startMin: number;
  /** One leg, in minutes. */
  durMin: number;
  turnoverMin: number;
  isOneWay?: boolean;
}

/** One line of a report: a label and an amount of money. */
export interface ReportLine {
  label: string;
  amount: number;
}

/** What one route did in a closed month. */
export interface ReportRoute {
  /** Absent in reports saved before routes carried their id into the report. */
  id?: string;
  name: string;
  revenue: number;
  cost: number;
  profit: number;
  paxPerWeek?: number;
  capacity?: number;
  transferPax?: number;
}

/**
 * A closed month, as the month's close writes it and the savegame keeps it.
 * Fields added over time are optional: older saves do not have them.
 */
export interface MonthlyReport extends ReportMetrics {
  month: number;
  year: number;
  routeRevenues: number;
  routeCosts: number;
  airportUpkeep: number;
  totalProfit: number;
  /** One-off spending in the month; negative items are money coming in. */
  capex?: number;
  capexItems?: ReportLine[];
  /** Profit less one-off spending: what actually moved the bank balance. */
  cashChange?: number;
  capitalAfter?: number;
  routes?: ReportRoute[];
  breakdown: Record<string, number>;
  /** One line per campaign and the frequent-flyer programme; absent before marketing existed. */
  marketingItems?: ReportLine[];
  /** Strikes and disruptions in the month; absent when there were none. */
  incidents?: ReportIncident[];
  /** Rival landings at the airports the airline owns (tier 3), one line per airport. */
  hubIncomeItems?: ReportLine[];
}

export type ManagementLevel = 0 | 1 | 2 | 3; // 0: None, 1: Basic, 2: Hub, 3: Owner

export interface AirportInfrastructure {
  level: ManagementLevel;
  slots: { regional: number; narrowbody: number; widebody: number };
  stands: { regional?: number; narrowbody: number; widebody: number }; // manual upgrades if level < 2
  autoBuyStands?: boolean;
  desks: { normal: number; self: number };
  hubAutoUpgrade?: boolean;
  hubFacilities?: {
    hangar?: boolean;
    vipLounge?: boolean;
    catering?: boolean;
  };
}

export interface SimulatedRoute {
  id: string;
  airline: string;
  origin: string;
  destination: string;
  distance: number;
  aircraft: string;
  weeklyFlights: number;
  paxPerWeek: number;
  paxByClass?: Record<string, { actual: number, max: number, transfer?: number }>;
  schedule?: ScheduledTrip[];
  classConfigs?: Record<string, { catering: string[][], extras: string[], service: string[] }>;
  ticketPrices?: Record<string, number>;
  activeTicketPrices?: Record<string, number>;
  durMin?: number;
  turnoverMin?: number;
  routeSat?: Record<string, number>;
  monthlyProfit?: number;
  weeklyRevenue?: number;
  weeklyCost?: number;
  /** The month offset the route was opened; absent on routes from before ramp-up existed, which count as mature. */
  openedOffset?: number;
}
