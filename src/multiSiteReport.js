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
import { generateIncidentCard } from './multiSiteVisual.js';
import { getCloneScreenshot, resolveCloneId, stopCloneServer } from './orbCloneScreenshot.js';
import { sendWhatsAppReport } from './whatsapp.js';
import { sendTelegramReport } from './telegram.js';
import { formatDate } from './formatter.js';

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
export function formatSiteCaption(site, dateStr, sites = [site]) {
  const total = sites.length;
  const online = sites.filter((item) => item.status === 'ONLINE').length;
  const degraded = sites.filter((item) => item.status === 'DEGRADED').length;
  const offline = sites.filter((item) => item.status === 'OFFLINE').length;
  const averageScore = total > 0
    ? Math.round(sites.reduce((sum, item) => sum + (item.score || 0), 0) / total)
    : 0;

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
    const statusIcon = item.status === 'ONLINE' ? '🟢' : item.status === 'DEGRADED' ? '🟡' : '🔴';
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
  console.log(`[Daily Report] Starting Per-Site Reporting Cycle`);
  console.log(`=================================================`);

  // 1. Read the local Orb summary
  const sites = await getAllSitesTelemetry(config);
  console.log(`[Daily Report] Read ${sites.length} local Orb site(s).`);

  try {
    // 2. Per-site loop
    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      console.log(`\n[Site ${i + 1}/${sites.length}] Processing: ${site.name}`);
      console.log('[Queue] One device active: capture -> send -> cleanup.');

      // Resolve to clone app ID
      const cloneId = resolveCloneId(site.name, site.id);
      console.log(`[Site] Clone ID: ${cloneId || '(none — real Orb interface missing)'}`);

      let imagePath = null;
      if (!cloneId) {
        throw new Error(`No Orb clone mapping exists for site "${site.name}". Please map the site to the real Orb interface entry.`);
      }

      try {
        imagePath = await getCloneScreenshot(cloneId, site.name, site);
      } catch (err) {
        console.error(`[Site] Clone screenshot failed for ${site.name}: ${err.message}`);
        throw new Error(`The actual Orb interface workflow failed for ${site.name}. Please make sure the Orb clone app is installed and running.`);
      }

      // Format per-site caption
      const caption = formatSiteCaption(site, dateStr, [site]);

      // Dispatch
      await dispatch(config, { imagePath, caption, dryRun });

      if (imagePath && fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
          console.log(`[Queue] Released screenshot for ${site.name}.`);
        } catch (error) {
          console.warn(`[Queue] Could not release screenshot for ${site.name}: ${error.message}`);
        }
      }

      // Rate-limit delay between sites
      if (i < sites.length - 1) {
        console.log(`[Site] Waiting ${INTER_SITE_DELAY_MS}ms before next site...`);
        await new Promise((r) => setTimeout(r, INTER_SITE_DELAY_MS));
      }
    }

    console.log(`\n[Daily Report] Cycle complete. ${sites.length} site report(s) sent.`);
    return { success: true, sites };

  } finally {
    // Stop the clone dev server if we started it
    stopCloneServer();
    reportInProgress = false;
  }
}
