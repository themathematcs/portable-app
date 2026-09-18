/**
 * Per-Site Daily Report Orchestrator — src/multiSiteReport.js
 *
 * For each monitored site:
 *   1. Screenshot the Orb clone app ClientDetailView for that site
 *   2. Format a focused single-site caption from live local Orb data
 *   3. Send one WhatsApp message (image + caption)
 *   4. Wait 2 seconds before the next site (avoid rate limiting)
 *
 * Sends exactly one image-and-caption message for the local Orb sensor.
 */

import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { getAllSitesTelemetry } from './orbApi.js';
import { generateIncidentCard, generateMultiSiteCard } from './multiSiteVisual.js';
import { getCloneScreenshot, resolveCloneId, stopCloneServer } from './orbCloneScreenshot.js';
import { sendWhatsAppReport } from './whatsapp.js';
import { sendTelegramReport } from './telegram.js';
import { formatDate } from './formatter.js';
import { formatSiteMessage } from './messageTemplate.js';

const INTER_SITE_DELAY_MS = 2000;
let reportInProgress = false;

/**
 * Format a concise single-site WhatsApp caption from live local Orb data.
 *
 * @param {object} site Site whose screenshot accompanies the caption.
 * @param {string} dateStr
 * @param {Array<object>} [sites=[site]] Current local Orb site data.
 * @returns {string}
 */
export function formatSiteCaption(site, dateStr, sites = [site], config = {}) {
  const reporting = config.reporting || {};
  const total = sites.length;
  const online = sites.filter((item) => item.status === 'ONLINE').length;
  const degraded = sites.filter((item) => item.status === 'DEGRADED').length;
  const offline = sites.filter((item) => item.status === 'OFFLINE').length;
  const averageScore = total > 0
    ? Math.round(sites.reduce((sum, item) => sum + (item.score || 0), 0) / total)
    : 0;

  if (sites.length === 1 && site && site.name) {
    return formatSiteMessage({
      ...site,
      date: dateStr,
      status: site.status || 'ONLINE',
      score: site.score ?? 0,
      isp: site.isp || 'Unknown',
      connection: site.connection || '',
      location: site.location || site.connection || 'N/A',
      uptime: site.uptime || 'N/A',
      latencyMs: site.latencyMs ?? site.latency ?? 'N/A',
      packetLossPct: site.packetLossPct ?? 'N/A',
    }, { reporting });
  }

  const lines = [
    `🌐 *ORB NETWORK OBSERVABILITY - SITE STATUS REPORT*`,
    `📅 Date: ${dateStr}`,
    `📊 Network Summary: ${online}/${total} Online (${averageScore}% Health Avg)`,
    ``,
    `📈 *Status Breakdown:*`,
    `* 🟢 Online & Stable: ${online} sites`,
    `* 🟡 Degraded Performance: ${degraded} sites`,
    `* 🔴 Offline / Attention Required: ${offline} sites`,
    ``,
    `📋 *Site-by-Site Status:*`,
  ];

  for (const item of sites) {
    const statusIcon = item.status === 'ONLINE' ? (reporting.statusEmoji?.ONLINE || '🟢') : item.status === 'DEGRADED' ? (reporting.statusEmoji?.DEGRADED || '🟡') : (reporting.statusEmoji?.OFFLINE || '🔴');
    lines.push(`${statusIcon} *${item.name}*`);
    lines.push(`   └ Score: ${item.score} | ISP: ${item.isp}${item.connection ? ` (${item.connection})` : ''} | ${item.status}`);
  }

  lines.push(``);
  if (offline === 0 && degraded === 0) {
    lines.push(`✅ All ${total} monitored site(s) are operational and healthy.`);
  } else {
    lines.push(`⚠️ ${offline + degraded} monitored site(s) require attention.`);
  }
  return lines.join('\n');
}

async function generateFallbackSiteCard(site) {
  const safeName = (site.name || site.id || 'site').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const outputPath = path.resolve(os.tmpdir(), `orb_fallback_${safeName}_${Date.now()}.png`);
  await generateIncidentCard(outputPath, {
    siteId: site.id,
    siteName: site.name,
    isp: site.isp,
    connection: site.connection,
    status: site.status,
    score: site.score,
    latencyMs: site.latencyMs,
    packetLossPct: site.packetLossPct,
    timestamp: new Date().toLocaleString(),
  });
  return outputPath;
}

/**
 * Dispatch to both WhatsApp and Telegram.
 */
async function dispatch(config, { imagePath, caption, dryRun }) {
  if (dryRun) {
    console.log(`[Dry-Run] Would send:\n${caption}`);
    if (imagePath) console.log(`[Dry-Run] Image: ${imagePath}`);
    return;
  }

  if (config.whatsapp?.enabled && config.whatsapp?.recipientJid) {
    try {
      await sendWhatsAppReport({
        recipientJid: config.whatsapp.recipientJid,
        imagePath,
        caption,
        authFolder: config.whatsapp.authFolder,
        connectionTimeoutMs: config.whatsapp.connectionTimeoutMs,
        maxRetries: config.whatsapp.maxRetries,
      });
    } catch (err) {
      console.error(`[Report] WhatsApp error: ${err.message}`);
    }
  }

  if (config.telegram?.enabled && config.telegram?.botToken && config.telegram?.chatId) {
    try {
      await sendTelegramReport({
        botToken: config.telegram.botToken,
        chatId: config.telegram.chatId,
        imagePath,
        caption,
        timeoutMs: config.telegram.timeoutMs,
        maxRetries: config.telegram.maxRetries,
      });
    } catch (err) {
      console.error(`[Report] Telegram error: ${err.message}`);
    }
  }
}

/**
 * Main: run per-site daily report cycle.
 *
 * 1. Read the local Orb summary
 * 2. For each site: screenshot → caption → send → wait 2s
 */
export async function runMultiSiteDailyReport(config, options = {}) {
  const { dryRun = false } = options;
  const dateStr = formatDate(new Date());

  if (reportInProgress) {
    throw new Error('A report is already running. The one-at-a-time report service is busy.');
  }
  reportInProgress = true;

  console.log(`\n=================================================`);
  console.log(`[Daily Report] Starting All-Sites Summary Cycle`);
  console.log(`=================================================`);

  const sites = await getAllSitesTelemetry(config);
  console.log(`[Daily Report] Read ${sites.length} Orb site(s).`);

  try {
    const caption = formatSiteCaption(sites[0] || { name: 'Orb Network', status: 'ONLINE', score: 0 }, dateStr, sites, config);

    let imagePath = null;
    if (sites.length > 0) {
      const site = sites[0];
      const cloneId = resolveCloneId(site.name, site.id);
      console.log(`[Daily Summary] Selected report site: ${site.name || site.id || 'unknown'} | Clone ID: ${cloneId || '(none — fallback card)'}`);

      if (cloneId) {
        try {
          imagePath = await getCloneScreenshot(cloneId, site.name, site);
          console.log(`[Daily Summary] Using real Orb interface screenshot: ${imagePath}`);
        } catch (cloneError) {
          console.warn(`[Daily Summary] Clone screenshot failed: ${cloneError.message}. Falling back to generated dashboard.`);

          const summaryPath = path.resolve(os.tmpdir(), `orb_multi_site_summary_${Date.now()}.png`);
          try {
            imagePath = await generateMultiSiteCard(summaryPath, sites, dateStr);
            console.log(`[Daily Summary] Generated fallback dashboard image: ${imagePath}`);
          } catch (summaryError) {
            console.warn(`[Daily Summary] Multi-site dashboard generation failed: ${summaryError.message}`);
          }
        }
      } else {
        const summaryPath = path.resolve(os.tmpdir(), `orb_multi_site_summary_${Date.now()}.png`);
        try {
          imagePath = await generateMultiSiteCard(summaryPath, sites, dateStr);
          console.log(`[Daily Summary] No clone mapping; generated fallback dashboard image: ${imagePath}`);
        } catch (summaryError) {
          console.warn(`[Daily Summary] Multi-site dashboard generation failed: ${summaryError.message}`);
        }
      }
    }

    await dispatch(config, { imagePath, caption, dryRun });

    if (imagePath && fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
        console.log('[Daily Summary] Released summary screenshot.');
      } catch (error) {
        console.warn(`[Daily Summary] Could not release summary screenshot: ${error.message}`);
      }
    }

    console.log(`\n[Daily Report] Summary cycle complete. 1 all-sites report sent.`);
    return { success: true, sites };

  } finally {
    stopCloneServer();
    reportInProgress = false;
  }
}
