import React from 'react';
import { X, RefreshCw, Activity, Terminal, ExternalLink, BellOff, Star } from 'lucide-react';
import { ClientMonitor } from '../types';

interface ClientActionsMenuProps {
  client: ClientMonitor | null;
  onClose: () => void;
  onViewDetails: (client: ClientMonitor) => void;
  onRefreshScore: (clientId: string) => void;
  onToggleFavorite: (clientId: string) => void;
}

export const ClientActionsMenu: React.FC<ClientActionsMenuProps> = ({
  client,
  onClose,
  onViewDetails,
  onRefreshScore,
  onToggleFavorite,
}) => {
  if (!client) return null;

  return (
    <div
      id="client-actions-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#1b0e3c] border border-[#37216b] rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.7)] text-white select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#2d1b58]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00e5ff]" />
            <span className="font-bold text-sm text-white truncate max-w-[200px]">
              {client.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#8f7ec2] hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-2 space-y-1">
          <button
            onClick={() => {
              onViewDetails(client);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-[#c4b5fd] hover:bg-[#281552] hover:text-white transition-colors"
          >
            <Activity className="w-4 h-4 text-[#00e5ff]" />
            <span>View Full Telemetry & Diagnostics</span>
          </button>

          <button
            onClick={() => {
              onRefreshScore(client.id);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-[#c4b5fd] hover:bg-[#281552] hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-[#00e676]" />
            <span>Force Ping Refresh</span>
          </button>

          <button
            onClick={() => {
              onToggleFavorite(client.id);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-[#c4b5fd] hover:bg-[#281552] hover:text-white transition-colors"
          >
            <Star className="w-4 h-4 text-[#ff4d6d]" />
            <span>{client.isFavorite ? 'Remove from Favorites' : 'Mark as Favorite'}</span>
          </button>

          <button
            onClick={() => {
              alert(`Alert notifications toggled for ${client.name}`);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-[#c4b5fd] hover:bg-[#281552] hover:text-white transition-colors"
          >
            <BellOff className="w-4 h-4 text-[#f59e0b]" />
            <span>Mute Health Alerts</span>
          </button>
        </div>
      </div>
    </div>
  );
};
