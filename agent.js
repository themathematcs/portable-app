#!/usr/bin/env node

/**
 * Edge Site Reporting & 24/7 Watchdog Agent
 * 
 * Standalone, lightweight Node.js daemon for remote edge computers.
 * Features:
 * - 24/7 Autonomous Watchdog: Evaluates every site returned by Orb Cloud, firing instant alerts on failure
 * - Daily site reports: Renders per-site screenshots and adaptive Markdown summaries
 * - Dual Dispatch: WhatsApp (Baileys) and Telegram Bot API
 * - Zero GUI Fragility: Direct API / Ingestion Engine
 */

import path from 'node:path';
import { loadConfig, validateConfig } from './src/config.js';
import { formatReport } from './src/formatter.js';
import { captureScreenToFile, cleanupTempFile, listScreens } from './src/capturer.js';
import { generateCard } from './src/visualCard.js';
import { sendTelegramReport } from './src/telegram.js';
import { sendWhatsAppReport, pairWhatsAppInteractive, listWhatsAppGroups } from './src/whatsapp.js';
import { getLiveTelemetry } from './src/telemetry.js';
import { ensureOrbRunning, focusOrbWindow, formatOrbOfflineAlert } from './src/orbGuardian.js';
import { getAllSitesTelemetry } from './src/orbApi.js';
import { evaluateAlerts } from './src/alertManager.js';
import { runMultiSiteDailyReport } from './src/multiSiteReport.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parses basic command-line arguments.
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    once: false,
    daily: false,
    daemon: false,
    testAlert: false,
    dryRun: false,
    testWhatsapp: false,
    authWa: false,
    testCapture: false,
    listGroups: false,
    listScreens: false,
    intervalMinutes: null,
    configPath: null,
    phoneNumber: '',
    forceReset: false,
    targetRecipient: null,
    screen: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--once') {
      options.once = true;
    } else if (arg === '--daily') {
      options.daily = true;
    } else if (arg === '--daemon' || arg === '--watchdog') {
      options.daemon = true;
    } else if (arg === '--test-alert') {
      options.testAlert = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--test-whatsapp' || arg === '--test-wa') {
      options.testWhatsapp = true;
    } else if (arg === '--auth-wa') {
      options.authWa = true;
    } else if (arg === '--phone' && args[i + 1]) {
      options.phoneNumber = args[++i];
      options.authWa = true;
    } else if (arg === '--to' && args[i + 1]) {
      options.targetRecipient = args[++i];
    } else if (arg === '--screen' && args[i + 1]) {
      options.screen = args[++i];
    } else if (arg === '--list-groups') {
      options.listGroups = true;
    } else if (arg === '--list-screens') {
      options.listScreens = true;
    } else if (arg === '--reset') {
      options.forceReset = true;
    } else if (arg === '--test-capture') {
      options.testCapture = true;
    } else if (arg === '--config' && args[i + 1]) {
      options.configPath = args[++i];
    } else if (arg === '--interval' && args[i + 1]) {
      options.intervalMinutes = parseFloat(args[++i]);
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Orb Edge Site Reporting & 24/7 Watchdog Agent
Usage: node agent.js [options]

Multi-Site & Watchdog Modes:
  --daemon             Run 24/7 continuous watchdog: polls discovered sites, sends instant failure alerts,
                       and dispatches daily executive reports
  --daily              Execute a report cycle for all currently discovered sites and exit
  --test-alert         Test the instant outage alert system and dispatch an incident card now

Single Site & Legacy Modes:
  --once               Execute single site / daily report cycle once and exit
  --dry-run            Simulate execution (renders images and formats reports without sending)
  --test-whatsapp      Send a real WhatsApp test message to the configured recipient
  --to <recipient>     Direct report to a specific phone number or WhatsApp group JID

WhatsApp Setup:
  --phone <number>     Pair WhatsApp using 8-character pairing code (Best for MEmu/Android emulator)
  --auth-wa            Pair WhatsApp using browser QR code
  --list-groups        List all linked WhatsApp groups and their JIDs
  --reset              Reset saved WhatsApp credentials
  `);
}

/**
 * Runs a single-site legacy cycle (kept for backward compatibility).
 */
async function runSingleSiteCycle(config, options = {}) {
  const { dryRun = false } = options;
  const tempImagePath = config.agent?.tempImagePath || './report_img.png';
  let capturedImagePath = null;
  const dispatchResults = { telegram: null, whatsapp: null, success: false };

  console.log(`\n-----------------------------------------------------------`);
  console.log(`[${new Date().toISOString()}] Starting Single Site Cycle: ${config.site?.name || 'Local Site'}`);
  console.log(`-----------------------------------------------------------`);

  try {
    const orbStatus = await ensureOrbRunning({ autoLaunch: true });
    const telemetry = await getLiveTelemetry();
    const { formatDate } = await import('./src/formatter.js');
    const dateStr = formatDate(new Date());
    const ispDisplay = telemetry.isp || config.site?.isp || 'Unknown ISP';

    capturedImagePath = await generateCard(tempImagePath, {
      siteName: config.site?.name || 'Remote Site',
      isp: ispDisplay,
      dateStr,
      telemetry,
      orbStatus
    });

    const reportText = formatReport(config, { telemetry, orbStatus });

    if (dryRun) {
      console.log(`[Dry-Run] Skipping live network dispatches.`);
      return { success: true };
    }

    if (config.whatsapp?.enabled) {
      dispatchResults.whatsapp = await sendWhatsAppReport({
        recipientJid: config.whatsapp.recipientJid,
        imagePath: capturedImagePath,
        caption: reportText,
        authFolder: config.whatsapp.authFolder,
        connectionTimeoutMs: config.whatsapp.connectionTimeoutMs,
        maxRetries: config.whatsapp.maxRetries
      });
    }

    dispatchResults.success = Boolean(dispatchResults.whatsapp || dispatchResults.telegram);
    return dispatchResults;
  } finally {
    if (capturedImagePath) cleanupTempFile(capturedImagePath);
  }
}

/**
 * 24/7 Watchdog Daemon Loop
 */
async function runWatchdogDaemon(config, options = {}) {
  const alertAutomationEnabled = config.alerts?.enabled !== false;
  const dailyReportAutomationEnabled = config.schedule?.dailyReportEnabled !== false;
  const checkIntervalMins = config.alerts?.checkIntervalMinutes || 3;
  const checkIntervalMs = checkIntervalMins * 60 * 1000;
  const targetHour = config.schedule?.dailyReportHour ?? 8;
  const targetMinute = config.schedule?.dailyReportMinute ?? 0;

  let lastDailyReportDate = null;
  let running = true;

  console.log(`\n===========================================================`);
  console.log(`🛡️  24/7 ORB WATCHDOG DAEMON STARTED`);
  console.log(`===========================================================`);
  console.log(`• Alert Automation: ${alertAutomationEnabled ? 'Enabled' : 'Disabled'}`);
  console.log(`• Site Watchdog Polling Interval: Every ${checkIntervalMins} minute(s)`);
  console.log(`• Daily Executive Report Schedule: ${dailyReportAutomationEnabled ? `${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')} daily` : 'Disabled'}`);
  console.log(`• WhatsApp Alerts: ${config.whatsapp?.enabled ? `Enabled (${config.whatsapp.recipientJid})` : 'Disabled'}`);
  console.log(`===========================================================\n`);

  const gracefulShutdown = () => {
    console.log(`\n[Watchdog] Graceful shutdown signal received. Stopping daemon.`);
    running = false;
    process.exit(0);
  };
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  // Initial immediate assessment
  if (alertAutomationEnabled) {
    try {
      console.log(`[Watchdog] Running startup health evaluation across discovered sites...`);
      const sites = await getAllSitesTelemetry(config);
      const incidents = await evaluateAlerts(config, sites, options);
      console.log(`[Watchdog] Startup evaluation complete. ${incidents.length} alert(s) triggered.`);
    } catch (err) {
      console.error(`[Watchdog] Startup evaluation error: ${err.message}`);
    }
  } else {
    console.log(`[Watchdog] Alert automation is disabled. Monitoring is paused.`);
  }

  while (running) {
    await sleep(checkIntervalMs);
    if (!running) break;

    const now = new Date();
    const currentDateKey = now.toISOString().slice(0, 10);

    // 1. Continuous Watchdog Check for Failures & Outages
    if (alertAutomationEnabled) {
      try {
        console.log(`[Watchdog ${now.toLocaleTimeString()}] Polling discovered sites for status anomalies...`);
        const sites = await getAllSitesTelemetry(config);
        const incidents = await evaluateAlerts(config, sites, options);
        if (incidents.length > 0) {
          console.log(`[Watchdog] ⚠️ Handled ${incidents.length} incident alert(s).`);
        } else {
          console.log(`[Watchdog] All evaluated sites are in expected state.`);
        }
      } catch (pollErr) {
        console.error(`[Watchdog Poll Error] ${pollErr.message}`);
      }
    } else {
      console.log(`[Watchdog ${now.toLocaleTimeString()}] Alert automation is disabled; skipping watch checks.`);
    }

    // 2. Scheduled Daily Executive Report Trigger
    if (dailyReportAutomationEnabled && now.getHours() === targetHour && now.getMinutes() >= targetMinute && lastDailyReportDate !== currentDateKey) {
      console.log(`[Watchdog] Triggering scheduled daily site report cycle...`);
      try {
        await runMultiSiteDailyReport(config, options);
        lastDailyReportDate = currentDateKey;
        console.log(`[Watchdog] Daily site report cycle completed successfully.`);
      } catch (dailyErr) {
        console.error(`[Watchdog Daily Report Error] ${dailyErr.message}`);
      }
    }
  }
}

/**
 * Main application entrypoint
 */
async function main() {
  const options = parseArgs();

  // Mode: Interactive WhatsApp Pairing
  if (options.authWa) {
    try {
      const config = loadConfig(options.configPath);
      await pairWhatsAppInteractive({
        authFolder: config.whatsapp.authFolder,
        phoneNumber: options.phoneNumber,
        forceReset: options.forceReset
      });
      process.exit(0);
    } catch (err) {
      console.error(`[WhatsApp Setup Error] ${err.message}`);
      process.exit(1);
    }
  }

  // Load configuration
  const config = loadConfig(options.configPath);

  // Mode: List WhatsApp Groups
  if (options.listGroups) {
    try {
      console.log('[WhatsApp] Fetching groups...');
      const groups = await listWhatsAppGroups(config.whatsapp.authFolder);
      groups.forEach((g, idx) => console.log(`[${idx + 1}] "${g.name}" -> ${g.id}`));
      process.exit(0);
    } catch (err) {
      console.error(`[WhatsApp Error] ${err.message}`);
      process.exit(1);
    }
  }

  // CLI Override for Target Recipient
  if (options.targetRecipient) {
    config.whatsapp.recipientJid = options.targetRecipient;
    config.whatsapp.enabled = true;
    console.log(`[Target Override] Directing dispatch to: ${options.targetRecipient}`);
  }

  validateConfig(config, options.dryRun);

  // Mode: Test Instant Alert
  if (options.testAlert) {
    console.log(`[Test] Generating test incident alert...`);
    const testSites = await getAllSitesTelemetry(config);
    // Find the degraded or offline site to test
    const targetSite = testSites.find(s => s.status === 'OFFLINE' || s.status === 'DEGRADED') || testSites[0];
    await evaluateAlerts(config, [targetSite], { forceDispatch: true, dryRun: options.dryRun });
    console.log(`[Test] Instant alert test completed.`);
    process.exit(0);
  }

  // Mode: real WhatsApp test message
  if (options.testWhatsapp) {
    try {
      const reportText = `🧪 WhatsApp connectivity test\n\nThis is a live test message from the Orb reporting app.\nIf you received this, WhatsApp delivery is working correctly.`;
      if (!config.whatsapp?.enabled || !config.whatsapp?.recipientJid) {
        throw new Error('WhatsApp is not enabled or the recipient is missing in config.json.');
      }
      await sendWhatsAppReport({
        recipientJid: config.whatsapp.recipientJid,
        imagePath: null,
        caption: reportText,
        authFolder: config.whatsapp.authFolder,
        connectionTimeoutMs: config.whatsapp.connectionTimeoutMs,
        maxRetries: config.whatsapp.maxRetries
      });
      console.log('[WhatsApp Test] Live test message sent successfully.');
      process.exit(0);
    } catch (err) {
      console.error(`[WhatsApp Test Error] ${err.message}`);
      process.exit(1);
    }
  }

  // Mode: Daily discovered-site report cycle
  if (options.daily || options.once) {
    try {
      await runMultiSiteDailyReport(config, options);
      console.log(`[Execution Complete] Local Orb report cycle completed successfully.`);
      process.exit(0);
    } catch (err) {
      console.error(`[Fatal] Execution failed: ${err.message}`);
      process.exit(1);
    }
  }

  // Mode: 24/7 Watchdog Daemon
  if (options.daemon || options.intervalMinutes) {
    await runWatchdogDaemon(config, options);
    return;
  }

  // Default fallback: display help if no action flags provided
  printHelp();
}

// Global safety net for unhandled edge exceptions
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err.message);
});

main();
