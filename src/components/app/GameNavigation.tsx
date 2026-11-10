/** The game's navigation: a column on the left, or a bar along the bottom on upright phones. */
import type { ActiveWindow } from '../../lib/gameTypes';
import { SidebarIcon } from './AppChrome';
import { Briefcase, Map as MapIcon, MapPin, Navigation, Plane, Plus, ShoppingCart, TrendingUp, Users } from 'lucide-react';

export interface GameNavigationProps {
  activeWindow: ActiveWindow;
  isPlanningRoute: boolean;
  openWindow: (win: ActiveWindow) => void;
  openPlanner: () => void;
}

export function GameNavigation({
  activeWindow, isPlanningRoute, openWindow, openPlanner
}: GameNavigationProps) {
  return (
    <>
          <div className="order-last rail:order-none w-full rail:w-14 lg:rail:w-16 short:w-16 tiny:w-12 bg-aero-panel border-t rail:border-t-0 rail:border-r border-white/10 flex flex-row rail:flex-col items-stretch rail:items-center rail:pb-4 short:pb-0 shrink-0 z-50 rail:h-full overflow-auto no-scrollbar bar:scrollbar-hidden short:scrollbar-hidden">
            {/* Spacer corresponding to the h-14 height of the Game Stats Bar */}
            <div className="hidden rail:block short:hidden h-14 shrink-0 w-full" />
            <div className="flex flex-row rail:flex-col w-full">
              {/* Fleet & Ops */}
              <div className="flex flex-row rail:flex-col flex-auto rail:flex-none divide-x rail:divide-x-0 rail:divide-y divide-white/5">
                <SidebarIcon icon={<MapIcon size={28} />} label="MAP" tour="nav-map" active={activeWindow === 'map' && !isPlanningRoute} onClick={() => openWindow('map')} />
                <SidebarIcon icon={<ShoppingCart size={28} />} label="BUY AIRCRAFT" shortLabel="BUY" tour="nav-buy-aircraft" active={activeWindow === 'buy-aircraft' && !isPlanningRoute} onClick={() => openWindow('buy-aircraft')} />
                <SidebarIcon icon={<Plane size={28} />} label="MY FLEET" shortLabel="FLEET" tour="nav-my-fleet" active={activeWindow === 'my-fleet' && !isPlanningRoute} onClick={() => openWindow('my-fleet')} />
              </div>

              {/* Network */}
              <div className="flex flex-row rail:flex-col flex-auto rail:flex-none divide-x rail:divide-x-0 rail:divide-y divide-white/5 border-l rail:border-l-0 rail:border-t border-white/10">
                <SidebarIcon icon={<Navigation size={28} />} label="ROUTES" tour="nav-routes" active={activeWindow === 'routes' && !isPlanningRoute} onClick={() => openWindow('routes')} />
                <SidebarIcon icon={<MapPin size={28} />} label="AIRPORTS" tour="nav-airports" active={activeWindow === 'airports' && !isPlanningRoute} onClick={() => openWindow('airports')} />
              </div>

              {/* Business */}
              <div className="flex flex-row rail:flex-col flex-auto rail:flex-none divide-x rail:divide-x-0 rail:divide-y divide-white/5 border-l rail:border-l-0 rail:border-t border-white/10">
                <SidebarIcon icon={<Briefcase size={28} />} label="MY COMPANY" shortLabel="COMPANY" tour="nav-my-company" active={activeWindow === 'my-company' && !isPlanningRoute} onClick={() => openWindow('my-company')} />
                <SidebarIcon icon={<TrendingUp size={28} />} label="CAREER" shortLabel="CAREER" tour="nav-progression" active={activeWindow === 'progression' && !isPlanningRoute} onClick={() => openWindow('progression')} />
                <SidebarIcon icon={<Users size={28} />} label="RIVALS" tour="nav-rivals" active={activeWindow === 'competitors' && !isPlanningRoute} onClick={() => openWindow('competitors')} />
              </div>

              {/* Actions */}
              <div className="flex flex-row rail:flex-col flex-auto rail:flex-none border-l rail:border-l-0 rail:border-t border-white/10 bg-aero-yellow/5">
                <SidebarIcon icon={<Plus size={28} />} label="NEW ROUTE" shortLabel="NEW" tour="nav-new-route" active={isPlanningRoute} onClick={openPlanner} />
              </div>
            </div>
            <div className="hidden rail:block short:hidden mt-4 pb-4 shrink-0 w-full mb-3">

            </div>
          </div>
    </>
  );
}
