import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Bell, 
  Settings, 
  Monitor, 
  Wifi, 
  Globe, 
  MoreHorizontal, 
  ChevronUp, 
  ChevronDown, 
  HelpCircle,
  Router,
  RefreshCw
} from 'lucide-react';
import { ClientMonitor } from '../types';
import { Orb } from './Orb';

interface ClientDetailViewProps {
  client: ClientMonitor;
  onBack: () => void;
  onRefreshScore: (clientId: string) => void;
}

export const ClientDetailView: React.FC<ClientDetailViewProps> = ({
  client,
  onBack,
  onRefreshScore,
}) => {
  const [activeTimeFilter, setActiveTimeFilter] = useState<'1 min' | '5 mins' | '1 hour' | '24 hours'>('1 min');
  const [connectionDetailsOpen, setConnectionDetailsOpen] = useState(true);
  
  // Section collapsible states
  const [responsivenessOpen, setResponsivenessOpen] = useState(true);
  const [reliabilityOpen, setReliabilityOpen] = useState(true);
  const [speedOpen, setSpeedOpen] = useState(true);

  // Active highlighted metric from orb
  const [activeMetric, setActiveMetric] = useState<'responsiveness' | 'reliability' | 'speed' | null>(null);

  // Speed test simulation
  const [isTestingSpeed, setIsTestingSpeed] = useState(false);
  const [speedMetrics, setSpeedMetrics] = useState({
    download: client.telemetry?.downloadMbps ?? 370,
    upload: client.telemetry?.uploadMbps ?? 256,
  });

  const handleRunSpeedTest = () => {
    setIsTestingSpeed(true);
    let counter = 0;
    const interval = setInterval(() => {
      counter++;
      setSpeedMetrics({
        download: Math.floor(320 + Math.random() * 90),
        upload: Math.floor(220 + Math.random() * 60),
      });
      if (counter > 8) {
        clearInterval(interval);
        setIsTestingSpeed(false);
        onRefreshScore(client.id);
      }
    }, 150);
  };

  const t = client.telemetry;

  return (
    <div
      id="client-detail-view"
      className="min-h-screen bg-[#0e0725] text-white selection:bg-[#00e5ff]/25 selection:text-[#00e5ff] pb-16"
    >
      {/* 1. Global Navigation App Bar */}
      <header className="relative z-30 bg-[#12072f] border-b border-[#241349] px-4 sm:px-6 py-3 flex items-center justify-between">
        {/* Back Button */}
        <button
          id="back-to-dashboard-btn"
          onClick={onBack}
          className="flex items-center gap-1.5 text-white hover:text-[#00e5ff] transition-colors group p-1 -ml-1"
          aria-label="Back to Dashboard"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.4] transition-transform group-hover:-translate-x-1" />
        </button>

        {/* Center Orb Logo */}
        <div className="flex items-center gap-2 select-none">
          <div className="w-6 h-6 text-[#a78bfa]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
              <circle cx="12" cy="12" r="10" />
              <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(30 12 12)" />
              <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-30 12 12)" />
            </svg>
          </div>
          <span
            className="text-[20px] font-extrabold tracking-wider text-[#a78bfa]"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            ORB
          </span>
        </div>

        {/* Right Icons: Notifications Bell & Settings */}
        <div className="flex items-center gap-4 text-[#8f7ec4]">
          <button className="hover:text-white transition-colors" title="Notifications">
            <Bell className="w-5 h-5" />
          </button>
          <button className="hover:text-white transition-colors" title="Settings">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-4 sm:pt-6 space-y-5">
        {/* 2. Top Client Summary & Connection Details Card */}
        <div
          id="connection-details-card"
          className="rounded-[22px] bg-[#1a0e38] border border-[#2d1b5a] p-5 sm:p-6 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
        >
          {/* Header Row: Topology, Time Filters & Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Device & Network Gateway Info */}
            <div className="flex flex-col select-none">
              <div className="flex items-center gap-2">
                <div className="w-5 flex justify-center">
                  <Monitor className="w-[15px] h-[15px] text-white stroke-[2.2]" />
                </div>
                <span
                  className="text-white font-bold text-[16px] tracking-wide"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {client.name}
                </span>
                <div className="flex items-center gap-1 ml-1 text-[#8f7ec4]">
                  <Wifi className="w-[13px] h-[13px] stroke-[2.4]" />
                  <span className="text-[13.5px] font-semibold text-[#a78bfa]">
                    {client.connectionName}
                  </span>
                </div>
              </div>

              {/* Vertical Dotted Connection */}
              <div className="w-5 flex flex-col items-center py-[2px]">
                <div className="w-[2px] h-[3px] bg-[#665392] rounded-full my-[1.5px]" />
                <div className="w-[2px] h-[3px] bg-[#665392] rounded-full my-[1.5px]" />
              </div>

              {/* Internet Gateway */}
              <div className="flex items-center gap-2">
                <div className="w-5 flex justify-center">
                  <Globe className="w-[15px] h-[15px] text-[#9381c8] stroke-[2.2]" />
                </div>
                <span className="text-[#a892e6] font-semibold text-[13.5px]">
                  Internet
                </span>
                <span className="text-[#9887c9] text-[13.5px]">
                  {client.ispName}
                </span>
              </div>
            </div>

            {/* Right Controls: Filter Pills, 3-Dots, Connection Details Toggle */}
            <div className="flex items-center gap-3">
              {/* Time Range Pills */}
              <div className="flex items-center bg-[#13092b] border border-[#2e1b5b] rounded-xl p-1">
                {(['1 min', '5 mins', '1 hour', '24 hours'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveTimeFilter(filter)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      activeTimeFilter === filter
                        ? 'bg-[#00e5ff] text-[#0d0620] shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                        : 'text-[#8f7ec4] hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* 3-Dots Cyan Circle */}
              <button
                className="w-[22px] h-[22px] rounded-full border border-[#00e5ff] text-[#00e5ff] flex items-center justify-center hover:bg-[#00e5ff]/15 transition-colors"
                title="Options"
              >
                <MoreHorizontal className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>

              {/* Collapsible Toggle Link */}
              <button
                onClick={() => setConnectionDetailsOpen(!connectionDetailsOpen)}
                className="flex items-center gap-1 text-[13px] font-medium text-[#38bdf8] hover:text-[#00e5ff] ml-1 transition-colors"
              >
                <span>Connection Details</span>
                {connectionDetailsOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Collapsible Connection Details Sub-Panel (Image 1) */}
          {connectionDetailsOpen && (
            <div className="mt-6 pt-6 border-t border-[#291752] grid grid-cols-1 md:grid-cols-3 gap-6 text-[13px]">
              {/* Box 1: Wi-Fi Signal */}
              <div className="space-y-2">
                <h4 className="text-white font-bold text-[14px]">Wi-Fi Signal</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
                  <div>
                    <span className="text-[#8f7ec4] block text-xs">Signal</span>
                    <span className="text-[#00e676] font-bold text-sm">
                      {t?.signalDbm ?? -53} dBm
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8f7ec4] block text-xs">Band</span>
                    <span className="text-white font-semibold text-sm">
                      {t?.band ?? '5 GHz (5745 MHz)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8f7ec4] block text-xs">Channel</span>
                    <span className="text-white font-semibold text-sm">
                      {t?.channel ?? 149}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8f7ec4] block text-xs">Receive Rate</span>
                    <span className="text-[#00e676] font-bold text-sm">
                      {t?.receiveRateMbps ?? 780} Mbps
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8f7ec4] block text-xs">Transmit Rate</span>
                    <span className="text-[#00e676] font-bold text-sm">
                      {t?.transmitRateMbps ?? 866} Mbps
                    </span>
                  </div>
                </div>
              </div>

              {/* Box 2: Hardware & Security */}
              <div className="space-y-2 md:border-l md:border-[#291752] md:pl-6">
                <h4 className="text-transparent hidden md:block text-[14px]">.</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-1">
                  <div>
                    <span className="text-[#8f7ec4] block text-xs">BSSID</span>
                    <span className="text-white font-bold text-sm">
                      {t?.bssid ?? '24****F0'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8f7ec4] block text-xs">MAC Address</span>
                    <span className="text-white font-bold text-sm">
                      {t?.macAddress ?? 'c8****34'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8f7ec4] block text-xs">Physical Layer</span>
                    <span className="text-white font-bold text-sm">
                      {t?.physicalLayer ?? '802.11ac'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8f7ec4] block text-xs">Security</span>
                    <span className="text-white font-bold text-sm">
                      {t?.security ?? 'Open'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Box 3: OS, Version & Network Endpoint */}
              <div className="space-y-2 md:border-l md:border-[#291752] md:pl-6">
                <h4 className="text-transparent hidden md:block text-[14px]">.</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-1">
                  <div>
                    <span className="text-[#8f7ec4] block text-xs">Operating System</span>
                    <span className="text-white font-bold text-sm">
                      {t?.os ?? 'Windows'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8f7ec4] block text-xs">Orb App Version</span>
                    <span className="text-white font-bold text-sm">
                      {t?.orbAppVersion ?? '1.5.5'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8f7ec4] block text-xs">Orb Sensor Version</span>
                    <span className="text-white font-bold text-sm">
                      {t?.orbSensorVersion ?? 'v1.5.5'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8f7ec4] block text-xs">IP Address</span>
                    <span className="text-white font-bold text-sm">
                      {t?.publicIp ?? '217.199.144.40'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8f7ec4] block text-xs">Private IP</span>
                    <span className="text-white font-bold text-sm">
                      {t?.privateIp ?? '10.11.0.0'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8f7ec4] block text-xs">Network Endpoint</span>
                    <span className="text-white font-bold text-sm">
                      {t?.networkEndpoint ?? 'Nairobi, Nairobi County'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. Main Split Layout: Left Orb + Right Responsiveness, Reliability, Speed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Huge 3D Orb (Image 1, 2, 3) */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 lg:sticky lg:top-6">
            <Orb
              score={client.score}
              size="detail"
              showLabel={true}
              showHelpIcon={true}
              activeMetric={activeMetric}
              onSelectMetric={(metric) => {
                setActiveMetric(metric);
                const el = document.getElementById(`metric-section-${metric}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            />
            <div className="mt-4 text-center">
              <span className="text-xs text-[#8f7ec4]">
                Click any glyph inside the orb to highlight that metric
              </span>
            </div>
          </div>

          {/* Right Column: 3 Metric Sections */}
          <div className="lg:col-span-8 space-y-4">
            {/* ---------------- 1. RESPONSIVENESS ---------------- */}
            <div
              id="metric-section-responsiveness"
              className={`rounded-[22px] bg-[#1a0e38] border p-5 sm:p-6 shadow-[0_12px_32px_rgba(0,0,0,0.4)] transition-all ${
                activeMetric === 'responsiveness'
                  ? 'border-[#00e5ff] shadow-[0_0_20px_rgba(0,229,255,0.25)]'
                  : 'border-[#2d1b5a]'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setResponsivenessOpen(!responsivenessOpen)}
                  className="flex items-center gap-2 text-white hover:text-[#00e5ff] transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  <span
                    className="font-bold text-[16px] tracking-wide"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    Responsiveness
                  </span>
                  {responsivenessOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#8f7ec4]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#8f7ec4]" />
                  )}
                </button>

                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full bg-black/40 border border-[#4d3284] flex items-center justify-center text-[10px] text-[#8f7ec4] cursor-help"
                    title="Responsiveness measures ping latency across network hops"
                  >
                    ?
                  </div>
                  {/* Green Badge */}
                  <div className="bg-[#00e676] text-[#072412] font-black text-sm px-3 py-1 rounded-lg">
                    {client.responsivenessScore}
                  </div>
                </div>
              </div>

              {/* Body */}
              {responsivenessOpen && (
                <div className="mt-6 space-y-5">
                  {/* Hop Topology Progress Bar (Monitor -> Router -> Internet) */}
                  <div className="flex items-center justify-between gap-2 px-2 py-3 bg-[#13082e] rounded-2xl border border-[#2b1754]">
                    {/* Device icon */}
                    <div className="shrink-0 p-1.5 rounded-lg bg-[#201047] text-white">
                      <Monitor className="w-4 h-4" />
                    </div>

                    {/* Hop 1 Dotted Bar (Orb to Router) */}
                    <div className="flex-1 flex items-center justify-center gap-[3px] overflow-hidden px-1">
                      {Array.from({ length: 30 }).map((_, i) => (
                        <div
                          key={`hop1-${i}`}
                          className="w-[4px] h-[8px] rounded-full bg-[#00e676] opacity-90 shadow-[0_0_4px_rgba(0,230,118,0.5)]"
                        />
                      ))}
                    </div>

                    {/* Router icon */}
                    <div className="shrink-0 p-1.5 rounded-lg bg-[#201047] text-white">
                      <Router className="w-4 h-4" />
                    </div>

                    {/* Hop 2 Dotted Bar (Router to Internet) */}
                    <div className="flex-1 flex items-center justify-center gap-[3px] overflow-hidden px-1">
                      {Array.from({ length: 30 }).map((_, i) => (
                        <div
                          key={`hop2-${i}`}
                          className={`w-[4px] h-[8px] rounded-full ${
                            i > 25 ? 'bg-[#00e676]/60' : 'bg-[#00e676]'
                          } opacity-90 shadow-[0_0_4px_rgba(0,230,118,0.5)]`}
                        />
                      ))}
                    </div>

                    {/* Internet Globe icon */}
                    <div className="shrink-0 p-1.5 rounded-lg bg-[#201047] text-white">
                      <Globe className="w-4 h-4" />
                    </div>
                  </div>

                  {/* 2 Lag Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Lag Orb -> Router */}
                    <div className="bg-[#140930] border border-[#2a1752] rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <span className="text-white font-bold text-sm block">Lag</span>
                        <span className="text-[#8f7ec4] text-xs">Orb→Router</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span
                          className="text-[#00e676] font-extrabold text-2xl"
                          style={{ fontFamily: "'Outfit', sans-serif" }}
                        >
                          {t?.lagRouterMs ?? 3}
                        </span>
                        <span className="text-[#00e676] text-xs font-semibold">ms</span>
                      </div>
                    </div>

                    {/* Lag Orb -> Router -> Internet */}
                    <div className="bg-[#140930] border border-[#2a1752] rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <span className="text-white font-bold text-sm block">Lag</span>
                        <span className="text-[#8f7ec4] text-xs">Orb→Router→Internet</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span
                          className="text-[#00e676] font-extrabold text-2xl"
                          style={{ fontFamily: "'Outfit', sans-serif" }}
                        >
                          {t?.lagInternetMs ?? 29}
                        </span>
                        <span className="text-[#00e676] text-xs font-semibold">ms</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ---------------- 2. RELIABILITY ---------------- */}
            <div
              id="metric-section-reliability"
              className={`rounded-[22px] bg-[#1a0e38] border p-5 sm:p-6 shadow-[0_12px_32px_rgba(0,0,0,0.4)] transition-all ${
                activeMetric === 'reliability'
                  ? 'border-[#00e5ff] shadow-[0_0_20px_rgba(0,229,255,0.25)]'
                  : 'border-[#2d1b5a]'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setReliabilityOpen(!reliabilityOpen)}
                  className="flex items-center gap-2 text-white hover:text-[#00e5ff] transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white">
                    <path d="M6 3h12l4 7-10 11L2 10l4-7z" />
                    <path d="M2 10h20" />
                    <path d="M12 21L7.5 10 10 3" />
                    <path d="M12 21l4.5-11L14 3" />
                  </svg>
                  <span
                    className="font-bold text-[16px] tracking-wide"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    Reliability
                  </span>
                  {reliabilityOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#8f7ec4]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#8f7ec4]" />
                  )}
                </button>

                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full bg-black/40 border border-[#4d3284] flex items-center justify-center text-[10px] text-[#8f7ec4] cursor-help"
                    title="Reliability tracks continuous uptime and packet consistency"
                  >
                    ?
                  </div>
                  {/* Green Badge */}
                  <div className="bg-[#00e676] text-[#072412] font-black text-sm px-3 py-1 rounded-lg">
                    {client.reliabilityScore}
                  </div>
                </div>
              </div>

              {/* Body */}
              {reliabilityOpen && (
                <div className="mt-6 space-y-4">
                  {/* Continuous Green Capsule Bars */}
                  <div className="bg-[#140930] border border-[#2a1752] rounded-2xl p-3 sm:p-4 overflow-hidden">
                    <div className="flex items-center justify-between gap-[3px] sm:gap-[4px] overflow-x-auto py-1">
                      {Array.from({ length: 44 }).map((_, i) => (
                        <div
                          key={`rel-bar-${i}`}
                          className="w-[7px] sm:w-[9px] h-[26px] rounded-[3px] bg-[#00e676] shrink-0 shadow-[0_0_4px_rgba(0,230,118,0.4)]"
                          title={`Interval ${i + 1}: 100% Reliable`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Footer Status Row */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <div>
                      <span className="text-white font-medium block">Responsiveness</span>
                      <span className="text-[#8f7ec4]">current</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[#00e676] font-bold block">Responsive</span>
                      <span className="text-[#8f7ec4]">{t?.uptimeDuration ?? '2:34 hrs'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ---------------- 3. SPEED ---------------- */}
            <div
              id="metric-section-speed"
              className={`rounded-[22px] bg-[#1a0e38] border p-5 sm:p-6 shadow-[0_12px_32px_rgba(0,0,0,0.4)] transition-all ${
                activeMetric === 'speed'
                  ? 'border-[#00e5ff] shadow-[0_0_20px_rgba(0,229,255,0.25)]'
                  : 'border-[#2d1b5a]'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSpeedOpen(!speedOpen)}
                  className="flex items-center gap-2 text-white hover:text-[#00e5ff] transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white">
                    <path d="M12 2a10 10 0 0 0-10 10c0 4.2 2.6 7.8 6.4 9.3" />
                    <path d="M17.6 21.3A10 10 0 0 0 22 12c0-5.5-4.5-10-10-10" />
                    <path d="m14 12-4-4" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                  <span
                    className="font-bold text-[16px] tracking-wide"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    Speed
                  </span>
                  {speedOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#8f7ec4]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#8f7ec4]" />
                  )}
                </button>

                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full bg-black/40 border border-[#4d3284] flex items-center justify-center text-[10px] text-[#8f7ec4] cursor-help"
                    title="Speed measures downlink and uplink throughput"
                  >
                    ?
                  </div>
                  {/* Green Badge */}
                  <div className="bg-[#00e676] text-[#072412] font-black text-sm px-3 py-1 rounded-lg">
                    {client.speedScore}
                  </div>
                </div>
              </div>

              {/* Body */}
              {speedOpen && (
                <div className="mt-6 space-y-4">
                  {/* Interactive Button: "Check content speed" (Image 2) */}
                  <button
                    id="check-content-speed-btn"
                    onClick={handleRunSpeedTest}
                    disabled={isTestingSpeed}
                    className="w-full py-2.5 px-4 rounded-xl border border-[#00e5ff] bg-[#140930] hover:bg-[#00e5ff]/10 active:scale-[0.99] text-white font-medium text-xs sm:text-sm tracking-wide transition-all shadow-[0_0_12px_rgba(0,229,255,0.15)] flex items-center justify-center gap-2"
                  >
                    {isTestingSpeed && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00e5ff]" />}
                    <span>{isTestingSpeed ? 'Testing Speed Telemetry...' : 'Check content speed'}</span>
                  </button>

                  {/* Download & Upload Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Download Card */}
                    <div className="bg-[#140930] border border-[#2a1752] rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <span className="text-white font-bold text-sm block">Download</span>
                        <span className="text-[#8f7ec4] text-xs">
                          {t?.downloadTimeAgo ?? 'an hour ago'}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span
                          className="text-white font-extrabold text-2xl leading-tight"
                          style={{ fontFamily: "'Outfit', sans-serif" }}
                        >
                          {speedMetrics.download}
                        </span>
                        <span className="text-[#8f7ec4] text-[11px] font-medium">Mbps</span>
                      </div>
                    </div>

                    {/* Upload Card */}
                    <div className="bg-[#140930] border border-[#2a1752] rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <span className="text-white font-bold text-sm block">Upload</span>
                        <span className="text-[#8f7ec4] text-xs">
                          {t?.uploadTimeAgo ?? 'an hour ago'}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span
                          className="text-white font-extrabold text-2xl leading-tight"
                          style={{ fontFamily: "'Outfit', sans-serif" }}
                        >
                          {speedMetrics.upload}
                        </span>
                        <span className="text-[#8f7ec4] text-[11px] font-medium">Mbps</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
