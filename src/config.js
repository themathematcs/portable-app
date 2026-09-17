import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_CONFIG_PATH = path.resolve(__dirname, '../config.json');

/**
 * Loads configuration from disk and validates runtime parameters.
 * Supports environment variable overrides for sensitive credentials.
 * 
 * @param {string} [configPath] Custom path to config.json
 * @returns {object} Loaded and sanitized configuration
 */
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

  // Merge with environment variables if available
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
      apiUrl: rawConfig.orb?.apiUrl || 'https://panel.orb.net'
    },
    alerts: rawConfig.alerts || {
      enabled: true,
      checkIntervalMinutes: 3,
      degradedThreshold: 75,
      cooldownMinutes: 60
    },
    schedule: rawConfig.schedule || {
      dailyReportHour: 8,
      dailyReportMinute: 0
    },
    sites: rawConfig.sites || []
  };

  return config;
}

/**
 * Validates the loaded config based on operational requirements.
 * 
 * @param {object} config 
 * @param {boolean} [dryRun=false] If dry-run, credentials validation is relaxed
 */
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
