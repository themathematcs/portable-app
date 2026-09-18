export const DEFAULT_MESSAGE_TEMPLATE = {
  statusEmoji: {
    ONLINE: '🟢',
    DEGRADED: '🟡',
    OFFLINE: '🔴',
  },
  scoreEmoji: '📊',
  ispEmoji: '🌐',
  locationEmoji: '📍',
  uptimeEmoji: '⏱',
  speedEmoji: '↓',
  sections: {
    scoreBreakdown: true,
    latency: true,
    speed: true,
    location: true,
    uptime: true,
    footer: true,
  },
  sectionOrder: ['header', 'score', 'isp', 'location', 'uptime', 'speed', 'footer'],
  footerText: '🤖 Orb Network Monitor | 24/7 Watchdog Active',
};

export function normalizeReportingConfig(rawConfig = {}) {
  const config = rawConfig || {};
  const statusEmoji = {
    ...DEFAULT_MESSAGE_TEMPLATE.statusEmoji,
    ...(config.statusEmoji || {})
  };
  const sections = {
    ...DEFAULT_MESSAGE_TEMPLATE.sections,
    ...(config.sections || {})
  };
  return {
    ...DEFAULT_MESSAGE_TEMPLATE,
    ...config,
    statusEmoji,
    sections,
    sectionOrder: Array.isArray(config.sectionOrder) && config.sectionOrder.length
      ? config.sectionOrder
      : DEFAULT_MESSAGE_TEMPLATE.sectionOrder,
    footerText: config.footerText || DEFAULT_MESSAGE_TEMPLATE.footerText,
  };
}

export function buildMessageTemplate(config = {}, site = {}) {
  const reporting = normalizeReportingConfig(config.reporting || {});
  const emoji = reporting.statusEmoji?.[site.status] || '⚪';
  const score = Number(site.score ?? 0);
  const location = site.location || site.region || site.connection || 'N/A';
  const lines = [];

  const sectionOrder = reporting.sectionOrder || DEFAULT_MESSAGE_TEMPLATE.sectionOrder;

  for (const section of sectionOrder) {
    switch (section) {
      case 'header':
        lines.push(`🌐 *ORB NETWORK OBSERVABILITY - SITE STATUS REPORT*`);
        lines.push(`📅 Date: ${site.date || new Date().toLocaleDateString()}`);
        break;
      case 'score':
        if (reporting.sections?.scoreBreakdown !== false) {
          lines.push(`${reporting.scoreEmoji} *Score:* ${score}/100`);
        }
        break;
      case 'isp':
        lines.push(`${reporting.ispEmoji} *ISP:* ${site.isp || 'Unknown'}${site.connection ? ` (${site.connection})` : ''}`);
        break;
      case 'location':
        if (reporting.sections?.location !== false) {
          lines.push(`${reporting.locationEmoji} *Location:* ${location}`);
        }
        break;
      case 'uptime':
        if (reporting.sections?.uptime !== false) {
          lines.push(`${reporting.uptimeEmoji} *Uptime:* ${site.uptime || 'N/A'}`);
        }
        break;
      case 'speed':
        if (reporting.sections?.speed !== false) {
          const latency = site.latencyMs ?? site.latency ?? 'N/A';
          const packetLoss = site.packetLossPct ?? 'N/A';
          lines.push(`${reporting.speedEmoji} *Latency:* ${latency}ms | *Packet Loss:* ${packetLoss}%`);
        }
        break;
      case 'footer':
        if (reporting.sections?.footer !== false) {
          lines.push('');
          lines.push(reporting.footerText || DEFAULT_MESSAGE_TEMPLATE.footerText);
        }
        break;
      default:
        break;
    }
  }

  if (!lines.length) {
    lines.push(`📊 *Site:* ${site.name || 'Orb Site'}`);
    lines.push(`${emoji} *Status:* ${site.status || 'UNKNOWN'}`);
  }

  return lines.join('\n');
}

export function formatSiteMessage(site, config = {}) {
  return buildMessageTemplate(config, site);
}
