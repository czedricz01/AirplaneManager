import { moreAirportRows } from './moreAirportsRows';
import { Airport, rowToAirport } from './airportTypes';

/** Secondary airports, same compact encoding as airports.ts. */
export const moreAirports: Airport[] = moreAirportRows.map(rowToAirport);
