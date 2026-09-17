import React from 'react';
import { HelpCircle } from 'lucide-react';

interface OrbProps {
  score: number;
  size?: 'large' | 'medium' | 'detail';
  variant?: 'green' | 'amber';
  showLabel?: boolean;
  showHelpIcon?: boolean;
  className?: string;
  activeMetric?: 'responsiveness' | 'reliability' | 'speed' | null;
  onSelectMetric?: (metric: 'responsiveness' | 'reliability' | 'speed') => void;
  onClick?: () => void;
}

export const Orb: React.FC<OrbProps> = ({
  score,
  size = 'medium',
  variant,
  showLabel = false,
  showHelpIcon = false,
  className = '',
  activeMetric,
  onSelectMetric,
  onClick,
}) => {
  const orbVariant = variant || (score < 70 ? 'amber' : 'green');
  const isLarge = size === 'large' || size === 'detail';
  const isDetail = size === 'detail';

  // Dimension classes
  const dimensions = isDetail
    ? 'w-[260px] h-[260px] sm:w-[280px] sm:h-[280px]'
    : isLarge
    ? 'w-[230px] h-[230px] sm:w-[250px] sm:h-[250px]'
    : 'w-[102px] h-[102px] sm:w-[108px] sm:h-[108px]';

  // Emerald Green palette strictly matched to Image 3
  const greenTheme = {
    // Rich saturated emerald gradient
    sphereBg: `radial-gradient(circle at 48% 38%, 
      #29b854 0%, 
      #1ca144 26%, 
      #137e35 48%, 
      #0d5e27 68%, 
      #063916 86%, 
      #021908 100%)`,
    outerRing: 'border-[1.5px] border-emerald-400/25',
    arcColorStart: 'rgba(255, 255, 255, 0.95)',
    arcColorMid: 'rgba(74, 222, 128, 0.75)',
    glowAura: 'shadow-[0_0_40px_rgba(22,163,74,0.35),0_0_15px_rgba(34,197,94,0.45)]',
    labelColor: '#a7f3d0',
    iconColor: '#6ee7b7',
    iconActiveColor: '#ffffff',
  };

  const amberTheme = {
    sphereBg: `radial-gradient(circle at 48% 38%, 
      #fbbf24 0%, 
      #f59e0b 26%, 
      #d97706 48%, 
      #b45309 68%, 
      #78350f 86%, 
      #361402 100%)`,
    outerRing: 'border-[1.5px] border-amber-400/30',
    arcColorStart: 'rgba(255, 255, 255, 0.95)',
    arcColorMid: 'rgba(251, 191, 36, 0.75)',
    glowAura: 'shadow-[0_0_40px_rgba(245,158,11,0.4),0_0_15px_rgba(245,158,11,0.5)]',
    labelColor: '#fde68a',
    iconColor: '#fcd34d',
    iconActiveColor: '#ffffff',
  };

  const theme = orbVariant === 'amber' ? amberTheme : greenTheme;

  return (
    <div
      onClick={onClick}
      className={`relative select-none flex items-center justify-center rounded-full group cursor-pointer transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98] ${dimensions} ${className}`}
      id={`orb-${score}`}
    >
      {/* Outer subtle concentric glass border ring */}
      <div
        className={`absolute inset-[-4px] rounded-full pointer-events-none opacity-50 ${theme.outerRing}`}
      />

      {/* Rotating orbital glass rim reflection arc (Image 3 animation) */}
      <div className="absolute inset-[-6px] rounded-full pointer-events-none animate-orb-orbit">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <defs>
            <linearGradient id={`orbArc-${score}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={theme.arcColorStart} />
              <stop offset="45%" stopColor={theme.arcColorMid} />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
            </linearGradient>
          </defs>
          <path
            d="M 50,3 A 47,47 0 0,1 96,52"
            fill="none"
            stroke={`url(#orbArc-${score})`}
            strokeWidth={isDetail ? '3' : '2.4'}
            strokeLinecap="round"
            filter="drop-shadow(0 0 6px rgba(74, 222, 128, 0.6))"
          />
        </svg>
      </div>

      {/* Main 3D Sphere Body with Radial Light & Glass Vignette */}
      <div
        className={`relative w-full h-full rounded-full flex flex-col items-center justify-center overflow-hidden ${theme.glowAura}`}
        style={{
          background: theme.sphereBg,
          boxShadow: `inset 0 0 28px rgba(0, 0, 0, 0.82), inset 0 2px 4px rgba(255, 255, 255, 0.55), 0 12px 28px rgba(0,0,0,0.65)`,
        }}
      >
        {/* Top curved glassy specular reflection highlight */}
        <div
          className="absolute top-[3%] left-[12%] right-[12%] h-[42%] rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 50% 16%, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0.2) 42%, rgba(255, 255, 255, 0) 75%)',
          }}
        />

        {/* Ambient bottom edge reflective bounce */}
        <div
          className="absolute bottom-[3%] left-[22%] right-[22%] h-[20%] rounded-full pointer-events-none opacity-45"
          style={{
            background:
              'radial-gradient(ellipse at 50% 92%, rgba(255, 255, 255, 0.3) 0%, transparent 68%)',
          }}
        />

        {/* Deep edge perimeter dark glass vignette */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 22px rgba(0,0,0,0.9)',
          }}
        />

        {/* Orb Content */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center">
          {/* Label + Help Icon (as in Image 1, 2, 3) */}
          {(isLarge || isDetail) && (showLabel || showHelpIcon) && (
            <div className="flex items-center justify-center gap-1.5 mb-[-2px] select-none">
              <span
                className="font-semibold tracking-normal drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
                style={{
                  color: theme.labelColor,
                  fontSize: isDetail ? '18px' : '16px',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                Orb Score
              </span>
              {(showHelpIcon || isDetail) && (
                <div
                  className="w-4 h-4 rounded-full bg-black/30 border border-emerald-400/40 flex items-center justify-center text-[10px] font-bold text-emerald-200"
                  title="Orb Score combines Responsiveness, Reliability, and Speed."
                >
                  ?
                </div>
              )}
            </div>
          )}

          {/* Number Score */}
          <span
            className={`text-white font-extrabold tracking-tight leading-none drop-shadow-[0_3px_8px_rgba(0,0,0,0.95)] ${
              isDetail
                ? 'text-[82px] sm:text-[96px] my-1'
                : isLarge
                ? 'text-[72px] sm:text-[84px] my-1'
                : 'text-[36px] sm:text-[38px] mb-1'
            }`}
            style={{
              fontFamily: "'Outfit', sans-serif",
              textShadow: '0 3px 10px rgba(0,0,0,0.85), 0 0 3px rgba(255,255,255,0.45)',
            }}
          >
            {score}
          </span>

          {/* Three Orb Icons underneath score:
              1. ⚡ Responsiveness
              2. 💎 Reliability
              3. ⏱ Speed
          */}
          <div
            className={`flex items-center justify-center ${
              isDetail ? 'gap-4 mt-2' : isLarge ? 'gap-3.5 mt-1' : 'gap-1.5 mt-[-2px]'
            }`}
          >
            {/* 1. Responsiveness (Lightning) */}
            <button
              onClick={(e) => {
                if (onSelectMetric) {
                  e.stopPropagation();
                  onSelectMetric('responsiveness');
                }
              }}
              className={`flex items-center justify-center transition-all ${
                isDetail
                  ? 'w-6 h-6 p-0.5 rounded hover:scale-125'
                  : isLarge
                  ? 'w-5 h-5'
                  : 'w-3 h-3'
              } ${activeMetric === 'responsiveness' ? 'scale-125 text-white' : ''}`}
              title="Responsiveness"
              aria-label="Responsiveness"
            >
              <svg
                viewBox="0 0 24 24"
                fill={activeMetric === 'responsiveness' ? theme.iconColor : 'none'}
                stroke={activeMetric === 'responsiveness' ? '#ffffff' : theme.iconColor}
                strokeWidth={isLarge ? '2.4' : '2.4'}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-full h-full drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </button>

            {/* 2. Reliability (Diamond) */}
            <button
              onClick={(e) => {
                if (onSelectMetric) {
                  e.stopPropagation();
                  onSelectMetric('reliability');
                }
              }}
              className={`flex items-center justify-center transition-all ${
                isDetail
                  ? 'w-6 h-6 p-0.5 rounded hover:scale-125'
                  : isLarge
                  ? 'w-5 h-5'
                  : 'w-3 h-3'
              } ${activeMetric === 'reliability' ? 'scale-125 text-white' : ''}`}
              title="Reliability"
              aria-label="Reliability"
            >
              <svg
                viewBox="0 0 24 24"
                fill={activeMetric === 'reliability' ? theme.iconColor : 'none'}
                stroke={activeMetric === 'reliability' ? '#ffffff' : theme.iconColor}
                strokeWidth={isLarge ? '2.4' : '2.4'}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-full h-full drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
              >
                <path d="M6 3h12l4 7-10 11L2 10l4-7z" />
                <path d="M2 10h20" />
                <path d="M12 21L7.5 10 10 3" />
                <path d="M12 21l4.5-11L14 3" />
              </svg>
            </button>

            {/* 3. Speed (Speedometer) */}
            <button
              onClick={(e) => {
                if (onSelectMetric) {
                  e.stopPropagation();
                  onSelectMetric('speed');
                }
              }}
              className={`flex items-center justify-center transition-all ${
                isDetail
                  ? 'w-6 h-6 p-0.5 rounded hover:scale-125'
                  : isLarge
                  ? 'w-5 h-5'
                  : 'w-3 h-3'
              } ${activeMetric === 'speed' ? 'scale-125 text-white' : ''}`}
              title="Speed"
              aria-label="Speed"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke={activeMetric === 'speed' ? '#ffffff' : theme.iconColor}
                strokeWidth={isLarge ? '2.4' : '2.4'}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-full h-full drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
              >
                <path d="M12 2a10 10 0 0 0-10 10c0 4.2 2.6 7.8 6.4 9.3" />
                <path d="M17.6 21.3A10 10 0 0 0 22 12c0-5.5-4.5-10-10-10" />
                <path d="m14 12-4-4" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
