/**
 * The game's navigation.
 *
 * Wide screens (and a phone held sideways) get a column on the left: an icon
 * and a word per screen, in two groups, with the current one marked by an
 * accent bar. On a phone held sideways the column shrinks to the icons.
 *
 * A phone held upright gets a bar along the bottom, in reach of the thumb,
 * with the four screens used most and "More", which opens a sheet with the
 * rest. Every target there is at least 48 px high.
 *
 * It is one list of buttons laid out twice by CSS, so the tutorial's
 * `data-tour` anchors exist once and in every layout.
 */
import { useState, type ReactNode } from 'react';
import { Briefcase, Map as MapIcon, MapPin, MoreHorizontal, Navigation, Plane, Plus, ShoppingCart, TrendingUp, Users } from 'lucide-react';
import type { ActiveWindow } from '../../lib/gameTypes';
import { Button } from '../ui/Button';

export interface GameNavigationProps {
  activeWindow: ActiveWindow;
  isPlanningRoute: boolean;
  openWindow: (win: ActiveWindow) => void;
  openPlanner: () => void;
  /** Shown at the top of the column. */
  airlineName: string;
  airlineCode: string;
  hub: string;
}

interface Item {
  id: ActiveWindow;
  label: string;
  /** The word under the icon in the phone's bar. */
  short: string;
  icon: ReactNode;
  tour: string;
  /** In the phone's bar itself; the others are under "More". */
  primary: boolean;
}

const OPERATIONS: Item[] = [
  { id: 'map', label: 'Map', short: 'Map', icon: <MapIcon />, tour: 'nav-map', primary: true },
  { id: 'buy-aircraft', label: 'Buy aircraft', short: 'Buy', icon: <ShoppingCart />, tour: 'nav-buy-aircraft', primary: false },
  { id: 'my-fleet', label: 'My fleet', short: 'Fleet', icon: <Plane />, tour: 'nav-my-fleet', primary: true },
  { id: 'routes', label: 'Routes', short: 'Routes', icon: <Navigation />, tour: 'nav-routes', primary: true },
  { id: 'airports', label: 'Airports', short: 'Airports', icon: <MapPin />, tour: 'nav-airports', primary: false },
];
const BUSINESS: Item[] = [
  { id: 'my-company', label: 'My company', short: 'Company', icon: <Briefcase />, tour: 'nav-my-company', primary: true },
  { id: 'progression', label: 'Career', short: 'Career', icon: <TrendingUp />, tour: 'nav-progression', primary: false },
  { id: 'competitors', label: 'Rivals', short: 'Rivals', icon: <Users />, tour: 'nav-rivals', primary: false },
];

/** Shared by the column's rows and the bar's cells; CSS decides which one it is. */
const itemClass = (active: boolean, primary: boolean) => `
  ${primary ? 'flex' : 'hidden rail:flex'} items-center cursor-pointer select-none transition-colors [&_svg]:shrink-0
  bar:flex-1 bar:flex-col bar:justify-center bar:gap-1 bar:min-h-14 bar:border-t-[3px] bar:text-xs bar:[&_svg]:size-5
  rail:w-full rail:gap-2.5 rail:h-10 rail:px-4 rail:border-l-[3px] rail:text-base rail:font-medium rail:[&_svg]:size-[18px]
  short:justify-center short:px-0 short:h-11
  ${active ? 'text-ink border-accent rail:bg-raised' : 'text-muted border-transparent hover:text-ink rail:hover:bg-raised'}
`;

export function GameNavigation({ activeWindow, isPlanningRoute, openWindow, openPlanner, airlineName, airlineCode, hub }: GameNavigationProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (id: ActiveWindow) => activeWindow === id && !isPlanningRoute;
  const go = (id: ActiveWindow) => { setMoreOpen(false); openWindow(id); };
  const plan = () => { setMoreOpen(false); openPlanner(); };
  const underMore = [...OPERATIONS, ...BUSINESS].filter(i => !i.primary);
  const moreActive = isPlanningRoute || underMore.some(i => isActive(i.id));

  const item = (i: Item) => (
    <button key={i.id} type="button" onClick={() => go(i.id)} data-tour={i.tour} title={i.label}
      aria-current={isActive(i.id) ? 'page' : undefined} className={itemClass(isActive(i.id), i.primary)}>
      {i.icon}
      <span className="short:sr-only"><span className="rail:hidden">{i.short}</span><span className="hidden rail:inline">{i.label}</span></span>
    </button>
  );
  const groupLabel = (text: string) => (
    <div className="hidden rail:block short:hidden px-4 pt-4 pb-1.5 font-label font-semibold text-2xs uppercase tracking-label text-muted">{text}</div>
  );

  return (
    <>
      <nav aria-label="Main"
        className="order-last rail:order-none w-full rail:w-44 short:w-14 shrink-0 bg-surface border-t rail:border-t-0 rail:border-r border-line flex flex-row rail:flex-col rail:overflow-y-auto scrollbar-hidden z-[60]">
        <div className="hidden rail:block short:hidden px-4 pt-3.5 pb-1">
          <div className="font-label font-bold text-lg leading-tight text-ink uppercase tracking-label truncate">{airlineName || 'Neo Airlines'}</div>
          <div className="text-xs text-muted truncate">{airlineCode ? `${airlineCode} · ` : ''}{hub}</div>
        </div>
        {groupLabel('Operations')}
        {OPERATIONS.map(item)}
        {groupLabel('Business')}
        {BUSINESS.map(item)}

        {/* The phone's fifth cell: everything that is not in the bar. */}
        <button type="button" onClick={() => setMoreOpen(o => !o)} data-tour="nav-more" aria-expanded={moreOpen}
          className={`rail:!hidden ${itemClass(moreActive || moreOpen, true)}`}>
          <MoreHorizontal />
          <span>More</span>
        </button>

        {/* The column ends with the screen's main action. */}
        <div className="hidden rail:block mt-auto p-3 short:p-1.5">
          <Button variant={isPlanningRoute ? 'secondary' : 'primary'} className="w-full short:px-0" onClick={plan} data-tour="nav-new-route" title="New route"
            aria-current={isPlanningRoute ? 'page' : undefined} icon={<Plus size={16} />}>
            <span className="short:sr-only">New route</span>
          </Button>
        </div>
      </nav>

      {moreOpen && (
        <div className="rail:hidden absolute inset-0 z-[55] flex flex-col justify-end animate-appear" role="presentation">
          <button type="button" aria-label="Close menu" className="flex-1 bg-ground/70" onClick={() => setMoreOpen(false)} />
          <div role="group" aria-label="More screens" className="bg-surface border-t border-rule mb-14 p-2 grid grid-cols-2 gap-2">
            {underMore.map(i => (
              <button key={i.id} type="button" onClick={() => go(i.id)}
                className={`flex items-center gap-2.5 min-h-12 px-3 border rounded-sm text-base font-medium [&_svg]:size-5 ${isActive(i.id) ? 'border-accent text-ink bg-raised' : 'border-line text-ink'}`}>
                {i.icon}{i.label}
              </button>
            ))}
            <Button variant="primary" size="lg" className="col-span-2" onClick={plan} icon={<Plus size={16} />}>New route</Button>
          </div>
        </div>
      )}
    </>
  );
}
