import React from 'react';
import { Monitor, Wifi, Globe, MoreHorizontal, Heart } from 'lucide-react';
import { ClientMonitor } from '../types';
import { Orb } from './Orb';

interface StandardMonitorCardProps {
  client: ClientMonitor;
  onOpenDetails: (client: ClientMonitor) => void;
  onOpenActions: (client: ClientMonitor) => void;
  onToggleFavorite: (id: string) => void;
}

export const StandardMonitorCard: React.FC<StandardMonitorCardProps> = ({
  client,
  onOpenDetails,
  onOpenActions,
  onToggleFavorite,
}) => {
  const isAmber = client.score < 70;
  const isOffline = client.status === 'OFFLINE';

  return (
    <div
      id={`monitor-card-${client.id}`}
      onClick={() => onOpenDetails(client)}
      className="relative rounded-[22px] bg-[#1a0e38] border border-[#2d1b5a]/80 p-4 sm:p-5 flex items-center justify-between shadow-[0_10px_28px_rgba(0,0,0,0.38)] transition-all duration-300 hover:border-[#422a80] group cursor-pointer"
    >
      {/* Top-Right Action Controls (Cyan 3-Dots + Pink Heart) */}
      <div className="absolute top-4 right-4 flex flex-col items-center gap-2 z-10">
        <button
          id={`more-btn-${client.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpenActions(client);
          }}
          className="w-[21px] h-[21px] rounded-full border border-[#00e5ff] text-[#00e5ff] flex items-center justify-center transition-all hover:scale-110 hover:bg-[#00e5ff]/15 active:scale-95 shadow-[0_0_8px_rgba(0,229,255,0.3)]"
          title="Options & Diagnostics"
          aria-label="Options"
        >
          <MoreHorizontal className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>

        <button
          id={`favorite-btn-${client.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(client.id);
          }}
          className="transition-transform duration-200 hover:scale-125 active:scale-90"
          title={client.isFavorite ? 'Favorited' : 'Add to Favorites'}
          aria-label="Favorite"
        >
          <Heart
            className={`w-[15px] h-[15px] transition-colors duration-200 ${
              client.isFavorite
                ? 'fill-[#ff4d6d] text-[#ff4d6d] drop-shadow-[0_0_6px_rgba(255,77,109,0.4)]'
                : 'text-[#6c5996] hover:text-[#ff4d6d]'
            }`}
          />
        </button>
      </div>

      {/* Main Content: Left Orb + Right Info */}
      <div className="flex items-center gap-4 sm:gap-5 w-full pr-7">
        {/* Left Side: 3D Orb */}
        <div className="shrink-0">
          <Orb
            score={client.score}
            variant={isAmber ? 'amber' : 'green'}
            size="medium"
            onClick={() => onOpenDetails(client)}
          />
        </div>

        {/* Right Side: Network Topology & Status */}
        <div className="flex flex-col justify-center min-w-0 select-none">
          {/* Node 1: Client Device Name */}
          <div className="flex items-center gap-2">
            <div className="w-4 shrink-0 flex justify-center">
              <Monitor className="w-[14px] h-[14px] text-white stroke-[2.2]" />
            </div>
            <span
              className="text-white font-bold text-[14px] sm:text-[14.5px] leading-tight truncate"
              style={{ fontFamily: "'Outfit', sans-serif" }}
              title={client.name}
            >
              {client.name}
            </span>
          </div>

          {/* Dotted Link 1 */}
          <div className="w-4 shrink-0 flex flex-col items-center py-[1px]">
            <div className="w-[1.8px] h-[2px] bg-[#665392] rounded-full my-[1px]" />
            <div className="w-[1.8px] h-[2px] bg-[#665392] rounded-full my-[1px]" />
          </div>

          {/* Node 2: Connection Type (Wired LAN or Wifi SSID) */}
          <div className="flex items-center gap-2">
            <div className="w-4 shrink-0 flex justify-center text-[#8f7ec4]">
              {client.connectionType === 'wifi' ? (
                <Wifi className="w-[13px] h-[13px] stroke-[2.4]" />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-[13px] h-[13px]"
                >
                  <rect x="2" y="2" width="20" height="8" rx="2" />
                  <rect x="6" y="14" width="12" height="8" rx="2" />
                  <line x1="12" y1="10" x2="12" y2="14" />
                </svg>
              )}
            </div>
            <span className="text-[#9d8ccf] text-[12.5px] font-normal tracking-tight">
              {client.connectionName}
            </span>
          </div>

          {/* Dotted Link 2 */}
          <div className="w-4 shrink-0 flex flex-col items-center py-[1px]">
            <div className="w-[1.8px] h-[2px] bg-[#665392] rounded-full my-[1px]" />
            <div className="w-[1.8px] h-[2px] bg-[#665392] rounded-full my-[1px]" />
          </div>

          {/* Node 3: Internet & ISP */}
          <div className="flex items-center gap-2">
            <div className="w-4 shrink-0 flex justify-center">
              <Globe className="w-[13.5px] h-[13.5px] text-[#9381c8] stroke-[2.2]" />
            </div>
            <span className="text-[#a892e6] font-semibold text-[12.5px]">
              Internet
            </span>
            <span className="text-[#9887c9] text-[12.5px] font-normal truncate">
              {client.ispName}
            </span>
          </div>

          {/* Sub-note if present (e.g. for Muthaiga III) */}
          {client.subNote && (
            <div className="mt-1 pl-6">
              <span className="text-[#7c69a7] text-[11px] tracking-normal font-normal">
                {client.subNote}
              </span>
            </div>
          )}

          {/* Node 4: Status Indicator & Elapsed Time */}
          <div className="flex items-center gap-1.5 mt-1.5 pl-6">
            {isOffline ? (
              <span
                className="text-[#f59e0b] font-bold text-[12px] tracking-wider"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                OFFLINE
              </span>
            ) : (
              <span
                className="text-[#00e676] font-bold text-[12px] tracking-wider"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                ONLINE
              </span>
            )}
            <span className="text-[#8f7ec4] text-[12px] font-normal">
              {client.uptimeText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
