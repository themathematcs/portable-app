import React, { useState } from 'react';
import { Monitor, Wifi, Globe, MoreHorizontal } from 'lucide-react';
import { ClientMonitor } from '../types';
import { Orb } from './Orb';

interface HeroMonitorCardProps {
  client: ClientMonitor;
  onOpenDetails: (client: ClientMonitor) => void;
  onOpenActions: (client: ClientMonitor) => void;
}

export const HeroMonitorCard: React.FC<HeroMonitorCardProps> = ({
  client,
  onOpenDetails,
  onOpenActions,
}) => {
  const [badgeRotated, setBadgeRotated] = useState(false);

  return (
    <div
      id={`hero-card-${client.id}`}
      onClick={() => onOpenDetails(client)}
      className="relative rounded-[22px] bg-[#1a0e38] border border-[#2d1b5a]/80 p-5 sm:p-6 flex flex-col justify-between shadow-[0_12px_32px_rgba(0,0,0,0.4)] transition-all duration-300 hover:border-[#422a80] group cursor-pointer"
    >
      {/* Top Bar: Connection Topology & Action Badges */}
      <div className="flex items-start justify-between relative z-10">
        {/* Left Side: Device & Network Topology */}
        <div className="flex flex-col select-none">
          {/* Node 1: Device Name & Wireless SSID */}
          <div className="flex items-center gap-2">
            <div className="w-5 flex justify-center">
              <Monitor className="w-[15px] h-[15px] text-white stroke-[2.2]" />
            </div>
            <span
              className="text-white font-bold text-[15px] tracking-wide"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              {client.name}
            </span>
            <div className="flex items-center gap-1 ml-1 text-[#8f7ec4]">
              <Wifi className="w-[13px] h-[13px] stroke-[2.4]" />
              <span className="text-[13px] font-medium tracking-normal text-[#9d8ccf]">
                {client.connectionName}
              </span>
            </div>
          </div>

          {/* Vertical Dotted Connection Link */}
          <div className="w-5 flex flex-col items-center py-[2px]">
            <div className="w-[2px] h-[3px] bg-[#665392] rounded-full my-[1.5px]" />
            <div className="w-[2px] h-[3px] bg-[#665392] rounded-full my-[1.5px]" />
          </div>

          {/* Node 2: Internet ISP Provider */}
          <div className="flex items-center gap-2">
            <div className="w-5 flex justify-center">
              <Globe className="w-[15px] h-[15px] text-[#9381c8] stroke-[2.2]" />
            </div>
            <span className="text-[#a892e6] font-semibold text-[13px]">
              Internet
            </span>
            <span className="text-[#9887c9] text-[13px] font-normal">
              {client.ispName}
            </span>
          </div>
        </div>

        {/* Right Side: 3-Dots Cyan Pill & Gold Crest Badge */}
        <div className="flex flex-col items-center gap-2">
          {/* Cyan 3-dots circle button */}
          <button
            id="cozlins-more-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenActions(client);
            }}
            className="w-[22px] h-[22px] rounded-full border border-[#00e5ff] text-[#00e5ff] flex items-center justify-center transition-all hover:scale-110 hover:bg-[#00e5ff]/15 active:scale-95 shadow-[0_0_8px_rgba(0,229,255,0.3)]"
            title="Options & Diagnostics"
            aria-label="Options"
          >
            <MoreHorizontal className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          {/* Golden crest badge (unique to hero node) */}
          <button
            id="cozlins-crest-badge"
            onClick={() => setBadgeRotated(!badgeRotated)}
            className="transition-transform duration-500 hover:scale-110 active:scale-95"
            title="Primary Hub Node"
            aria-label="Primary Node Badge"
          >
            <div className="w-[19px] h-[19px] rounded-full border-[1.5px] border-[#f5a623] text-[#f5a623] flex items-center justify-center p-[2px] shadow-[0_0_8px_rgba(245,166,35,0.4)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`w-full h-full transition-transform duration-700 ${
                  badgeRotated ? 'rotate-180' : ''
                }`}
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>
            </div>
          </button>
        </div>
      </div>

      {/* Middle: Massive Glowing 3D Glass Orb */}
      <div className="flex items-center justify-center my-6">
        <Orb
          score={client.score}
          size="large"
          showLabel={true}
          onClick={() => onOpenDetails(client)}
        />
      </div>

      {/* Bottom: Centered Status & Uptime */}
      <div className="flex items-center justify-center gap-2 select-none">
        <span
          className="text-[#00e676] font-bold text-[13px] tracking-wider"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          ONLINE
        </span>
        <span className="text-[#8f7ec4] text-[13px] font-normal">
          {client.uptimeText}
        </span>
      </div>
    </div>
  );
};
