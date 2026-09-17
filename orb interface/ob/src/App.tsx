import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  SlidersHorizontal, 
  RefreshCw, 
  EyeOff,
  Radio,
  ArrowRight
} from 'lucide-react';
import { INITIAL_CLIENTS, ClientMonitor, OrbLiveData } from './types';
import { HeroMonitorCard } from './components/HeroMonitorCard';
import { StandardMonitorCard } from './components/StandardMonitorCard';
import { ClientDetailView } from './components/ClientDetailView';
import { ClientActionsMenu } from './components/ClientActionsMenu';

function applyLiveData(clients: ClientMonitor[]): ClientMonitor[] {
  const liveData: OrbLiveData | undefined = window.__ORB_DATA__;
  if (!liveData) return clients;

  const targetId = liveData.cloneId || liveData.id;
  const targetIndex = clients.findIndex((client) =>
    client.id === targetId || client.name.toLowerCase() === liveData.name?.toLowerCase()
  );
  if (targetIndex < 0) return clients;

  const target = clients[targetIndex];
  const latency = typeof liveData.latencyMs === 'number'
    ? liveData.latencyMs
    : Number.parseFloat(liveData.latencyMs || '0') || target.telemetry?.lagInternetMs || 0;
  const updated: ClientMonitor = {
    ...target,
    score: liveData.score ?? target.score,
    status: liveData.status ?? target.status,
    connectionName: liveData.connection ?? target.connectionName,
    ispName: liveData.isp ?? target.ispName,
    uptimeText: liveData.uptime ?? target.uptimeText,
    responsivenessScore: liveData.components?.responsiveness ?? target.responsivenessScore,
    reliabilityScore: liveData.components?.reliability ?? target.reliabilityScore,
    speedScore: liveData.components?.bandwidth ?? target.speedScore,
    telemetry: {
      ...target.telemetry,
      lagInternetMs: latency,
      downloadMbps: liveData.downloadMbps ?? target.telemetry?.downloadMbps ?? 0,
      uploadMbps: liveData.uploadMbps ?? target.telemetry?.uploadMbps ?? 0,
      networkEndpoint: liveData.location ?? target.telemetry?.networkEndpoint ?? 'Unknown',
    },
  };

  return clients.map((client, index) => (index === targetIndex ? updated : client));
}

export default function App() {
  const [clients, setClients] = useState<ClientMonitor[]>(() => applyLiveData(INITIAL_CLIENTS));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'ONLINE' | 'OFFLINE' | 'FAVORITES'>('ALL');
  
  // Selected client for the full inspection view (Image 1, 2, 3)
  const [activeDetailClient, setActiveDetailClient] = useState<ClientMonitor | null>(null);
  
  // 3-dots action menu
  const [selectedClientForActions, setSelectedClientForActions] = useState<ClientMonitor | null>(null);
  const [showTopToolbar, setShowTopToolbar] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  // Auto-open site detail view if ?site=<id> is in the URL (used by Puppeteer screenshots)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const siteId = params.get('site');
    if (siteId) {
      const target = clients.find((c) => c.id === siteId);
      if (target) setActiveDetailClient(target);
    }
  }, [clients]);

  // Toggle favorite
  const handleToggleFavorite = (clientId: string) => {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, isFavorite: !c.isFavorite } : c))
    );
    if (activeDetailClient?.id === clientId) {
      setActiveDetailClient((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : null));
    }
  };

  // Refresh single client score
  const handleRefreshScore = (clientId: string) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id === clientId) {
          const delta = Math.floor(Math.random() * 5) - 2;
          const newScore = Math.min(99, Math.max(50, c.score + delta));
          const updated = {
            ...c,
            score: newScore,
            uptimeText: c.status === 'ONLINE' ? 'just now' : c.uptimeText,
          };
          if (activeDetailClient?.id === clientId) {
            setActiveDetailClient(updated);
          }
          return updated;
        }
        return c;
      })
    );
  };

  // Refresh all clients simulation
  const handleRefreshAll = () => {
    setIsRefreshingAll(true);
    setTimeout(() => {
      setClients((prev) =>
        prev.map((c) => {
          if (c.status === 'ONLINE') {
            const jitter = (Math.random() * 2 - 1) * 2;
            const newScore = Math.min(99, Math.max(55, Math.round(c.score + jitter)));
            return { ...c, score: newScore };
          }
          return c;
        })
      );
      setIsRefreshingAll(false);
    }, 600);
  };

  // Filtered clients list
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.ispName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.connectionName.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterMode === 'ONLINE') return c.status === 'ONLINE';
      if (filterMode === 'OFFLINE') return c.status === 'OFFLINE';
      if (filterMode === 'FAVORITES') return c.isFavorite;

      return true;
    });
  }, [clients, searchQuery, filterMode]);

  // Specific groups for faithful 3-column replica
  const col1Clients = useMemo(() => {
    return ['cozlins', 'mara', 'karen-hub']
      .map((id) => filteredClients.find((c) => c.id === id))
      .filter((c): c is ClientMonitor => Boolean(c));
  }, [filteredClients]);

  const col2Clients = useMemo(() => {
    return ['bbhouse', 'gicheha', 'muthaiga', 'lavington']
      .map((id) => filteredClients.find((c) => c.id === id))
      .filter((c): c is ClientMonitor => Boolean(c));
  }, [filteredClients]);

  const col3Clients = useMemo(() => {
    return ['brookeveg', 'ichaweri', 'seaview', 'nyali']
      .map((id) => filteredClients.find((c) => c.id === id))
      .filter((c): c is ClientMonitor => Boolean(c));
  }, [filteredClients]);

  const isDefaultView = filterMode === 'ALL' && searchQuery.trim() === '';

  // If user opened detailed client inspection (Image 1, 2, 3), render it:
  if (activeDetailClient) {
    return (
      <ClientDetailView
        client={activeDetailClient}
        onBack={() => setActiveDetailClient(null)}
        onRefreshScore={handleRefreshScore}
      />
    );
  }

  return (
    <div
      id="dashboard-root"
      className="min-h-screen bg-[#0e0725] text-white selection:bg-[#00e5ff]/25 selection:text-[#00e5ff] relative overflow-x-hidden"
    >
      {/* Background Subtle Radial Gradient Light Atmosphere */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[500px] bg-purple-900/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[700px] h-[500px] bg-indigo-950/15 rounded-full blur-[150px] pointer-events-none" />

      {/* Floating subtle toggle button for toolbar */}
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2">
        {/* Quick link to test Black-Bird-HQ9 directly (Image 1) */}
        <button
          onClick={() => {
            const bb = clients.find((c) => c.id === 'blackbird') || clients[0];
            setActiveDetailClient(bb);
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#00e5ff] text-[#0a0518] text-xs font-bold shadow-[0_0_15px_rgba(0,229,255,0.4)] transition-all hover:scale-105 active:scale-95"
        >
          <span>Black-Bird-HQ9 Telemetry</span>
          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>

        <button
          id="toggle-toolbar-btn"
          onClick={() => setShowTopToolbar(!showTopToolbar)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1c0f3d]/90 hover:bg-[#281552] border border-[#3d2572] text-[#c4b5fd] text-xs font-medium backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all active:scale-95"
          title="Toggle search and controls bar"
        >
          {showTopToolbar ? (
            <>
              <EyeOff className="w-3.5 h-3.5 text-[#00e5ff]" />
              <span>Hide Controls</span>
            </>
          ) : (
            <>
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#00e5ff]" />
              <span>Filters</span>
            </>
          )}
        </button>
      </div>

      {/* Optional Top Toolbar */}
      {showTopToolbar && (
        <header
          id="dashboard-header"
          className="relative z-30 bg-[#140a31]/95 border-b border-[#2d1b58] px-4 sm:px-6 py-3 backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-4"
        >
          <div className="max-w-[1520px] mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#00e676] shadow-[0_0_8px_#00e676]" />
              <h1
                className="text-base font-bold tracking-wide text-white"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                Orb Score Telemetry
              </h1>
              <span className="text-xs text-[#8f7ec4] border-l border-[#37216a] pl-3">
                {clients.filter((c) => c.status === 'ONLINE').length} Online • {clients.filter((c) => c.status === 'OFFLINE').length} Offline
              </span>
            </div>

            {/* Quick Filters */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8f7ec4]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by name, ISP..."
                  className="bg-[#1b0f3e] border border-[#341d63] rounded-xl pl-8 pr-3 py-1 text-xs text-white placeholder-[#7866a2] focus:outline-none focus:border-[#00e5ff] w-48 sm:w-60 transition-colors"
                />
              </div>

              <div className="flex items-center bg-[#1b0f3e] border border-[#341d63] rounded-xl p-0.5">
                {(['ALL', 'ONLINE', 'OFFLINE', 'FAVORITES'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setFilterMode(mode)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                      filterMode === mode
                        ? 'bg-[#00e5ff] text-[#0d0620]'
                        : 'text-[#8f7ec4] hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <button
                onClick={handleRefreshAll}
                disabled={isRefreshingAll}
                className="p-1.5 rounded-xl bg-[#1b0f3e] border border-[#341d63] text-[#00e5ff] hover:bg-[#281552] transition-colors"
                title="Refresh scores"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAll ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Replica Grid Container */}
      <main className="relative z-10 px-3 sm:px-5 lg:px-6 pt-3 sm:pt-5 pb-16 max-w-[1580px] mx-auto">
        {isDefaultView ? (
          /* Faithful 3-Column Layout from Screenshot */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 items-start">
            {/* Column 1: Hero Card (cozlins) + Mara-Monitoring + Peeking Bottom Card */}
            <div className="flex flex-col gap-4 sm:gap-5 lg:gap-6">
              {col1Clients.map((client) =>
                client.isHero ? (
                  <HeroMonitorCard
                    key={client.id}
                    client={client}
                    onOpenDetails={(c) => setActiveDetailClient(c)}
                    onOpenActions={setSelectedClientForActions}
                  />
                ) : (
                  <StandardMonitorCard
                    key={client.id}
                    client={client}
                    onOpenDetails={(c) => setActiveDetailClient(c)}
                    onOpenActions={setSelectedClientForActions}
                    onToggleFavorite={handleToggleFavorite}
                  />
                )
              )}
            </div>

            {/* Column 2: BBHouse + Gicheha + Muthaiga III + Peeking Bottom Card */}
            <div className="flex flex-col gap-4 sm:gap-5 lg:gap-6">
              {col2Clients.map((client) => (
                <StandardMonitorCard
                  key={client.id}
                  client={client}
                  onOpenDetails={(c) => setActiveDetailClient(c)}
                  onOpenActions={setSelectedClientForActions}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>

            {/* Column 3: BrookeVeg + Ichaweri (Amber 62) + Sea View + Peeking Bottom Card */}
            <div className="flex flex-col gap-4 sm:gap-5 lg:gap-6">
              {col3Clients.map((client) => (
                <StandardMonitorCard
                  key={client.id}
                  client={client}
                  onOpenDetails={(c) => setActiveDetailClient(c)}
                  onOpenActions={setSelectedClientForActions}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          </div>
        ) : (
          /* Filtered Grid */
          <div>
            <div className="mb-4 text-xs text-[#8f7ec4] flex items-center justify-between">
              <span>Showing {filteredClients.length} matching monitors</span>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterMode('ALL');
                }}
                className="text-[#00e5ff] hover:underline"
              >
                Reset to default view
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
              {filteredClients.map((client) =>
                client.isHero ? (
                  <HeroMonitorCard
                    key={client.id}
                    client={client}
                    onOpenDetails={(c) => setActiveDetailClient(c)}
                    onOpenActions={setSelectedClientForActions}
                  />
                ) : (
                  <StandardMonitorCard
                    key={client.id}
                    client={client}
                    onOpenDetails={(c) => setActiveDetailClient(c)}
                    onOpenActions={setSelectedClientForActions}
                    onToggleFavorite={handleToggleFavorite}
                  />
                )
              )}
            </div>
          </div>
        )}
      </main>

      {/* 3-Dots Quick Action Menu */}
      <ClientActionsMenu
        client={selectedClientForActions}
        onClose={() => setSelectedClientForActions(null)}
        onViewDetails={(c) => setActiveDetailClient(c)}
        onRefreshScore={handleRefreshScore}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
}
