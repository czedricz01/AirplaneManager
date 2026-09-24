import type { GameMessage } from './gameTypes';

/**
 * Inbox helpers.
 *
 * Message ids used to be `Date.now()` plus a random offset, with a different
 * offset range at every call site. The ranges overlapped, so two messages
 * created in the same tick could share an id -- a duplicate React key, and a
 * click on one marked the other as read too. The inbox also grew without bound
 * and travelled in every savegame.
 */

/** Newest messages kept. Older ones are dropped, oldest first. */
export const MAX_MESSAGES = 200;

let lastId = 0;

/** A strictly increasing id: time-based, so ids stay unique across sessions too. */
export function nextMessageId(): number {
  lastId = Math.max(lastId + 1, Date.now());
  return lastId;
}

/** Makes sure new ids are above every id already in a loaded inbox. */
export function reserveMessageIds(messages: { id: number }[]) {
  for (const m of messages) {
    if (Number.isFinite(m.id) && m.id > lastId) lastId = m.id;
  }
}

/** The inbox is newest first; this keeps the newest MAX_MESSAGES. */
export function capMessages<T>(messages: T[]): T[] {
  return messages.length > MAX_MESSAGES ? messages.slice(0, MAX_MESSAGES) : messages;
}

export function createWelcomeMessage(): GameMessage {
  return {
    id: 1,
    // This is the only guidance the game offers, so it names the first three
    // moves. It used to be four subsystems and no next step -- and its preview
    // line was in German while the body was in English.
    text: 'Welcome aboard - your first three moves',
    isRead: false,
    dateStr: '01/1960',
    details: {
      title: 'Welcome to Neo Airlines',
      source: 'Board of Directors',
      content: "Dear Chief Executive,\n\nThe hangar is empty and the board is watching. Here is where to start:\n\n1. BUY AN AIRCRAFT. Open Buy Aircraft in the sidebar, pick a manufacturer, and choose something whose range covers the routes you have in mind. In 1960 everything on the market is within your budget, so range and capacity matter more than price.\n\n2. PLAN A ROUTE from your hub. New Route walks you through four steps: pick the two airports and an aircraft, lay out a weekly schedule, fit the cabin, then set the fares. The planner shows what the route will earn before you commit to it.\n\n3. ADVANCE THE MONTH with Next Month, bottom right. Your routes fly, the bill arrives, and the report tells you what happened.\n\nTwo things will stop you if you do not know them. Flying into an airport at all requires T1 management there, bought once per airport -- your hub starts at T2, everywhere else you buy it. And every weekly departure needs a slot at BOTH ends; you start with none, so step 1 of the route planner is where you buy them.\n\nGood luck, Captain."
    }
  };
}
