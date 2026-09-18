/**
 * 24/7 Smart Alert Manager — src/alertManager.js
 *
 * Continuously evaluates network state across every site returned by the API.
 * Detects failures and performance degradations in real time.
 * Dispatches instant high-priority alerts with incident cards to WhatsApp and Telegram.
 * Prevents alert fatigue using state tracking and smart cooldown timers.
 */

import fs from 'node:fs';
import path from 'node:path';
import { generateIncidentCard } from './multiSiteVisual.js';
import { sendWhatsAppReport } from './whatsapp.js';
import { sendTelegramReport } from './telegram.js';

const STATE_FILE = path.resolve('./alert_state.json');

/**
 * Loads the persisted alert state from disk.
 */
function loadAlertState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (_) {}
  return {
    sites: {},
    lastEvaluated: null
  };
}

/**
 * Persists the alert state to disk.
 */
function saveAlertState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error(`[Alert Manager] Could not save alert state: ${err.message}`);
  }
}

/**
 * Formats the incident alert text message for WhatsApp/Telegram.
 */
function formatAlertMessage(incident, config = {}) {
  const reporting = config.reporting || {};
  const statusEmoji = reporting.statusEmoji || { ONLINE: '🟢', DEGRADED: '🟡', OFFLINE: '🔴' };

  if (incident.type === 'RECOVERY') {
    return [
      `✅ *INCIDENT RESOLVED – SITE RESTORED*`,
      `📍 *Site:* ${incident.siteName}`,
      `🌐 *ISP:* ${incident.isp} (${incident.connection})`,
      `📊 *Orb Score:* ${incident.score}/100 (Online)`,
      `⏱️ *Time:* ${incident.timestamp}`,
      ``,
      `${statusEmoji.ONLINE || '🟢'} Network connectivity and metrics returned to normal operational limits.`
    ].join('\n');
  }

  const icon = incident.severity === 'CRITICAL' ? '🚨' : '⚠️';
  const title = incident.severity === 'CRITICAL' ? 'CRITICAL NETWORK OUTAGE' : 'PERFORMANCE DEGRADATION';
  const statusIcon = incident.status === 'OFFLINE' ? (statusEmoji.OFFLINE || '🔴') : (statusEmoji.DEGRADED || '🟡');

  return [
    `${icon} *${title}*`,
    `📍 *Site:* ${incident.siteName}`,
    `🌐 *ISP:* ${incident.isp} (${incident.connection})`,
    `📉 *Status:* ${statusIcon} ${incident.status}`,
    `📊 *Orb Score:* ${incident.score}/100`,
    `⚡ *Latency:* ${incident.latencyMs}ms | *Packet Loss:* ${incident.packetLossPct}%`,
    `⏱️ *Detected:* ${incident.timestamp}`,
    ``,
    incident.severity === 'CRITICAL'
      ? `${statusEmoji.OFFLINE || '🔴'} Site is unreachable or completely offline. Immediate attention recommended.`
      : `${statusEmoji.DEGRADED || '🟡'} Site performance degraded below threshold. Monitoring for recovery.`
  ].join('\n');
}

/**
 * Dispatches an incident alert (with incident card image) to enabled channels.
 */
async function dispatchAlert(config, incident) {
  const alertText = formatAlertMessage(incident, config);
  const tempCardPath = path.resolve(`./alert_${incident.siteId}_${Date.now()}.png`);

  console.log(`\n[Alert Watchdog] 🚨 DISPATCHING ALERT for ${incident.siteName} (${incident.severity})...`);

  try {
    // Generate high-visibility alert card
    await generateIncidentCard(tempCardPath, incident);

    // WhatsApp Dispatch
    if (config.whatsapp?.enabled && config.whatsapp?.recipientJid) {
      try {
        console.log(`[Alert Watchdog] Sending instant alert to WhatsApp (${config.whatsapp.recipientJid})...`);
        await sendWhatsAppReport({
          recipientJid: config.whatsapp.recipientJid,
          imagePath: tempCardPath,
          caption: alertText,
          authFolder: config.whatsapp.authFolder,
          connectionTimeoutMs: config.whatsapp.connectionTimeoutMs,
          maxRetries: config.whatsapp.maxRetries
        });
      } catch (waErr) {
        console.error(`[Alert Watchdog] WhatsApp dispatch error: ${waErr.message}`);
      }
    }

    // Telegram Dispatch
    if (config.telegram?.enabled && config.telegram?.botToken && config.telegram?.chatId) {
      try {
        console.log(`[Alert Watchdog] Sending instant alert to Telegram (${config.telegram.chatId})...`);
        await sendTelegramReport({
          botToken: config.telegram.botToken,
          chatId: config.telegram.chatId,
          imagePath: tempCardPath,
          caption: alertText,
          timeoutMs: config.telegram.timeoutMs,
          maxRetries: config.telegram.maxRetries
        });
      } catch (tgErr) {
        console.error(`[Alert Watchdog] Telegram dispatch error: ${tgErr.message}`);
      }
    }
  } catch (cardErr) {
    console.error(`[Alert Watchdog] Card generation/dispatch error: ${cardErr.message}`);
  } finally {
    if (fs.existsSync(tempCardPath)) {
      try { fs.unlinkSync(tempCardPath); } catch (_) {}
    }
  }
}

/**
 * Evaluates current site metrics against previous state and triggers alerts.
 *
 * @param {object} config System configuration
 * @param {Array<object>} sites Current site telemetry array
 * @param {object} [options={}]
 * @param {boolean} [options.forceDispatch=false]
 */
export async function evaluateAlerts(config, sites, options = {}) {
  const alertConfig = config.alerts || {
    enabled: true,
    degradedThreshold: 75,
    cooldownMinutes: 60
  };

  if (alertConfig.enabled === false && !options.forceDispatch) {
    return [];
  }

  const state = loadAlertState();
  const now = new Date();
  const nowIso = now.toISOString();
  const timestampStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + now.toLocaleDateString();
  const triggeredIncidents = [];

  for (const site of sites) {
    const prev = state.sites[site.id] || { status: 'ONLINE', lastAlertTime: null };
    const currentStatus = site.status;
    const isDegraded = site.score < (alertConfig.degradedThreshold || 75);
    const effectiveStatus = currentStatus === 'OFFLINE' ? 'OFFLINE' : (isDegraded ? 'DEGRADED' : 'ONLINE');

    let shouldAlert = false;
    let incident = null;

    // Condition 1: Failure / Degradation Detected
    if (effectiveStatus !== 'ONLINE') {
      const severity = effectiveStatus === 'OFFLINE' ? 'CRITICAL' : 'WARNING';
      const lastAlert = prev.lastAlertTime ? new Date(prev.lastAlertTime) : null;
      const minutesSinceLast = lastAlert ? (now - lastAlert) / (1000 * 60) : Infinity;

      // Alert if state worsened OR cooldown elapsed
      if (prev.status !== effectiveStatus || minutesSinceLast >= (alertConfig.cooldownMinutes || 60) || options.forceDispatch) {
        shouldAlert = true;
        incident = {
          type: 'INCIDENT',
          severity,
          siteId: site.id,
          siteName: site.name,
          isp: site.isp,
          connection: site.connection,
          status: effectiveStatus,
          score: site.score,
          latencyMs: site.latencyMs,
          packetLossPct: site.packetLossPct,
          timestamp: timestampStr
        };
      }
    }
    // Condition 2: Recovery (Was broken, now back online)
    else if (prev.status && prev.status !== 'ONLINE') {
      shouldAlert = true;
      incident = {
        type: 'RECOVERY',
        severity: 'INFO',
        siteId: site.id,
        siteName: site.name,
        isp: site.isp,
        connection: site.connection,
        status: 'ONLINE',
        score: site.score,
        latencyMs: site.latencyMs,
        packetLossPct: site.packetLossPct,
        timestamp: timestampStr
      };
    }

    // Update state tracker
    state.sites[site.id] = {
      status: effectiveStatus,
      score: site.score,
      lastAlertTime: shouldAlert ? nowIso : prev.lastAlertTime,
      lastSeen: nowIso
    };

    if (shouldAlert && incident) {
      triggeredIncidents.push(incident);
      await dispatchAlert(config, incident);
    }
  }

  state.lastEvaluated = nowIso;
  saveAlertState(state);

  return triggeredIncidents;
}
