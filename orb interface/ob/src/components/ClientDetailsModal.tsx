import React, { useState } from 'react';
import { X, Activity, Wifi, Globe, Shield, RefreshCw, Copy, Check, Radio } from 'lucide-react';
import { ClientMonitor } from '../types';
import { Orb } from './Orb';

interface ClientDetailsModalProps {
  client: ClientMonitor | null;
  onClose: () => void;
  onRefreshScore: (clientId: string) => void;
}

export const ClientDetailsModal: React.FC<ClientDetailsModalProps> = ({
  client,
  onClose,
  onRefreshScore,
}) => {
  const [isPinging, setIsPinging] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!client) return null;

  const handlePingTest = () => {
    setIsPinging(true);
    setTimeout(() => {
      onRefreshScore(client.id);
      setIsPinging(false);
    }, 900);
  };

  const handleCopyIp = () => {
    if (client.stats?.ipAddress) {
      navigator.clipboard.writeText(client.stats.ipAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      id="client-details-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-[#170c35] border border-[#3b2474] rounded-3xl p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Background Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Close Button */}
        <button
          id="close-modal-btn"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full text-[#9c8ec4] hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-5 pb-5 border-b border-[#2d1b58]">
          <Orb score={client.score} size="medium" />
          <div>
            <div className="flex items-center gap-2">
              <h2
                className="text-white text-xl font-bold tracking-wide"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                {client.name}
              </h2>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  client.status === 'ONLINE'
                    ? 'bg-[#00e676]/15 text-[#00e676] border border-[#00e676]/30'
                    : 'bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30'
                }`}
              >
                {client.status}
              </span>
            </div>
            <p className="text-[#9684c7] text-sm mt-0.5">
              ISP: <span className="text-white font-medium">{client.ispName}</span> • Interface:{' '}
              <span className="text-white font-medium">{client.connectionName}</span>
            </p>
          </div>
        </div>

        {/* Telemetry Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 my-5">
          <div className="bg-[#1f1042] border border-[#321c60] rounded-2xl p-3.5 flex flex-col">
            <span className="text-[#8f7ec2] text-xs font-medium">Latency</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-white text-2xl font-bold">
                {client.stats?.latencyMs ?? 15}
              </span>
              <span className="text-[#8f7ec2] text-xs">ms</span>
            </div>
            <span className="text-[#00e676] text-[10px] mt-1">Optimal &lt; 30ms</span>
          </div>

          <div className="bg-[#1f1042] border border-[#321c60] rounded-2xl p-3.5 flex flex-col">
            <span className="text-[#8f7ec2] text-xs font-medium">Packet Loss</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-white text-2xl font-bold">
                {client.stats?.packetLoss ?? 0.0}%
              </span>
            </div>
            <span className="text-[#00e676] text-[10px] mt-1">Zero drop detected</span>
          </div>

          <div className="bg-[#1f1042] border border-[#321c60] rounded-2xl p-3.5 flex flex-col">
            <span className="text-[#8f7ec2] text-xs font-medium">Jitter</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-white text-2xl font-bold">
                {client.stats?.jitterMs ?? 1.2}
              </span>
              <span className="text-[#8f7ec2] text-xs">ms</span>
            </div>
            <span className="text-[#00e676] text-[10px] mt-1">Ultra stable</span>
          </div>
        </div>

        {/* Network IP & Gateway Info */}
        <div className="bg-[#1a0e3a] border border-[#2d1b58] rounded-2xl p-4 space-y-2.5 text-xs text-[#9d8ccf]">
          <div className="flex justify-between items-center">
            <span>WAN Public IP:</span>
            <div className="flex items-center gap-1.5 font-mono text-white">
              <span>{client.stats?.ipAddress ?? '197.237.142.88'}</span>
              <button
                onClick={handleCopyIp}
                className="p-1 hover:text-[#00e5ff] transition-colors"
                title="Copy IP"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#00e676]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span>Gateway / Subnet:</span>
            <span className="font-mono text-white">{client.stats?.gateway ?? '192.168.1.1'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Last Telemetry Heartbeat:</span>
            <span className="text-[#b7a3eb]">{client.stats?.lastPing ?? 'Just now'}</span>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#2d1b58]">
          <span className="text-xs text-[#7e6caa]">Continuous Telemetry via Orb Agent</span>
          <button
            id="run-diag-btn"
            onClick={handlePingTest}
            disabled={isPinging}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00e5ff] text-[#0c061e] font-semibold text-xs tracking-wide transition-all hover:bg-[#38bdf8] active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
            <span>{isPinging ? 'Pinging Node...' : 'Run Diagnostics'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
