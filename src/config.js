import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_CONFIG_PATH = path.resolve(__dirname, '../config.json');
const ENV_CANDIDATES = [
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '.env')
].filter((value, index, arr) => arr.indexOf(value) === index);

function loadDotEnv() {
  for (const envPath of ENV_CANDIDATES) {
    if (!fs.existsSync(envPath)) continue;

    try {
      const require = createRequire(import.meta.url);
      const dotenv = require('dotenv');
      const result = dotenv.config({ path: envPath });
      if (result?.parsed) {
        for (const [key, value] of Object.entries(result.parsed)) {
          if (process.env[key] === undefined) process.env[key] = value;
        }
      }
    } catch {
      // dotenv not installed or config failed; fallback below
    }

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!key) continue;
      if (process.env[key] === undefined) process.env[key] = value;
    }

    return;
  }
}

loadDotEnv();

const DEFAULT_REPORTING = {
  statusEmoji: {
    ONLINE: '🟢',
    DEGRADED: '🟡',
    OFFLINE: '🔴'
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
    footer: false
  },
  sectionOrder: ['header', 'score', 'isp', 'location', 'uptime', 'speed', 'footer'],
  footerText: ''
};

export function loadConfig(configPath) {
  const resolvedPath = path.resolve(configPath || DEFAULT_CONFIG_PATH);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Configuration file not found at: ${resolvedPath}. Please copy config.json.example to config.json and fill in required fields.`
    );
  }

  let rawConfig;
  try {
    const rawContent = fs.readFileSync(resolvedPath, 'utf8');
    rawConfig = JSON.parse(rawContent);
  } catch (err) {
    throw new Error(`Failed to parse config file at ${resolvedPath}: ${err.message}`);
  }

  const config = {
    site: {
      name: process.env.SITE_NAME || rawConfig.site?.name || 'Remote Site',
      isp: process.env.SITE_ISP || rawConfig.site?.isp || 'Standard ISP'
    },
    performance: {
      networkHealth: rawConfig.performance?.networkHealth || '100%',
      reliability: rawConfig.performance?.reliability || '100%',
      speed: rawConfig.performance?.speed || '91%'
    },
    statusNotes: {
      summary: rawConfig.statusNotes?.summary || 'All devices are operational and stable',
      notes: rawConfig.statusNotes?.notes || 'No issues detected; all devices operational'
    },
    telegram: {
      enabled: process.env.TELEGRAM_ENABLED !== undefined
        ? process.env.TELEGRAM_ENABLED === 'true'
        : Boolean(rawConfig.telegram?.enabled),
      botToken: process.env.TELEGRAM_BOT_TOKEN || rawConfig.telegram?.botToken || '',
      chatId: process.env.TELEGRAM_CHAT_ID || rawConfig.telegram?.chatId || '',
      timeoutMs: Number(rawConfig.telegram?.timeoutMs) || 30000,
      maxRetries: Number(rawConfig.telegram?.maxRetries) || 3
    },
    whatsapp: {
      enabled: process.env.WHATSAPP_ENABLED !== undefined
        ? process.env.WHATSAPP_ENABLED === 'true'
        : Boolean(rawConfig.whatsapp?.enabled),
      recipientJid: process.env.WHATSAPP_RECIPIENT_JID || rawConfig.whatsapp?.recipientJid || '',
      authFolder: rawConfig.whatsapp?.authFolder || './auth_info',
      connectionTimeoutMs: Number(rawConfig.whatsapp?.connectionTimeoutMs) || 45000,
      maxRetries: Number(rawConfig.whatsapp?.maxRetries) || 3
    },
    agent: {
      reportScheduleCron: rawConfig.agent?.reportScheduleCron || '0 8 * * *',
      tempImagePath: rawConfig.agent?.tempImagePath
        ? path.resolve(__dirname, '..', rawConfig.agent.tempImagePath)
        : path.resolve(__dirname, '../report_img.png'),
      cleanUpOnFailure: rawConfig.agent?.cleanUpOnFailure !== false
    },
    orb: {
      apiToken: process.env.ORB_API_TOKEN || rawConfig.orb?.apiToken || '',
      apiUrl: rawConfig.orb?.apiUrl || 'https://panel.orb.net',
      configDir: process.env.ORB_CONFIG_DIR || rawConfig.orb?.configDir || '',
      certificatePath: process.env.ORB_CERTIFICATE_PATH || rawConfig.orb?.certificatePath || '',
      privateKeyPath: process.env.ORB_PRIVATE_KEY_PATH || rawConfig.orb?.privateKeyPath || ''
    },
    alerts: {
      enabled: rawConfig.alerts?.enabled ?? true,
      checkIntervalMinutes: Number(rawConfig.alerts?.checkIntervalMinutes) || 3,
      degradedThreshold: Number(rawConfig.alerts?.degradedThreshold) || 75,
      cooldownMinutes: Number(rawConfig.alerts?.cooldownMinutes) || 60
    },
    schedule: {
      dailyReportEnabled: rawConfig.schedule?.dailyReportEnabled ?? true,
      dailyReportHour: Number(rawConfig.schedule?.dailyReportHour) || 8,
      dailyReportMinute: Number(rawConfig.schedule?.dailyReportMinute) || 0
    },
    excludedSites: Array.isArray(rawConfig.excludedSites)
      ? rawConfig.excludedSites.map((site) => String(site).trim()).filter(Boolean)
      : [],
    reporting: {
      ...DEFAULT_REPORTING,
      ...(rawConfig.reporting || {}),
      statusEmoji: {
        ...DEFAULT_REPORTING.statusEmoji,
        ...(rawConfig.reporting?.statusEmoji || {})
      },
      sections: {
        ...DEFAULT_REPORTING.sections,
        ...(rawConfig.reporting?.sections || {})
      }
    },
    sites: rawConfig.sites || []
  };

  return config;
}

export function validateConfig(config, dryRun = false) {
  if (config.site && (!config.site.name || !config.site.isp)) {
    throw new Error('Config Error: site.name and site.isp must be non-empty strings.');
  }

  if (!dryRun) {
    if (!config.telegram.enabled && !config.whatsapp.enabled) {
      console.warn('[Config Warning] Neither Telegram nor WhatsApp is enabled in config.json.');
    }

    if (config.telegram.enabled) {
      if (!config.telegram.botToken || !config.telegram.chatId) {
        throw new Error(
          'Config Error: Telegram is enabled but botToken or chatId is missing in config.json or environment variables.'
        );
      }
    }

    if (config.whatsapp.enabled) {
      if (!config.whatsapp.recipientJid) {
        throw new Error(
          'Config Error: WhatsApp is enabled but recipientJid is missing in config.json or environment variables (format: [country_code][number]@s.whatsapp.net).'
        );
      }
    }
  }
}
