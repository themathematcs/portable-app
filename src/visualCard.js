/**
 * Visual Card Generator — src/visualCard.js
 *
 * Renders a dark-themed network status dashboard card to PNG using
 * Puppeteer headless Chromium. Replaces desktop screenshots with a
 * professionally-styled, data-driven image that works in any process context.
 */

import puppeteer from 'puppeteer';
import fs from 'node:fs';

/**
 * Converts a numeric packet-loss / health percentage to SVG arc path data
 * for a circular progress ring.
 *
 * @param {number} pct  0–100
 * @param {number} r    radius
 * @returns {string} stroke-dasharray value  "arc gap"
 */
function ringDash(pct, r = 28) {
  const circumference = 2 * Math.PI * r;
  const filled = (pct / 100) * circumference;
  return `${filled.toFixed(1)} ${circumference.toFixed(1)}`;
}

/**
 * Extracts a plain numeric speed value (Mbps) from strings like
 * "287 Mbps", "1 Gbps", "100%", "91%".
 *
 * @param {string} rawSpeed
 * @returns {{ value: number, unit: string, display: string }}
 */
function parseSpeed(rawSpeed = '') {
  const str = String(rawSpeed).trim();

  // "287 Mbps" / "1.2 Gbps"
  const bpsMatch = str.match(/([\d.]+)\s*(Gbps|Mbps|Kbps)/i);
  if (bpsMatch) {
    let value = parseFloat(bpsMatch[1]);
    const unit = bpsMatch[2].toLowerCase();
    if (unit === 'gbps') { value *= 1000; }          // normalise to Mbps
    const display = unit === 'gbps'
      ? `${bpsMatch[1]} Gbps`
      : `${Math.round(value)} Mbps`;
    return { value: Math.min(value, 1000), unit: 'Mbps', display };
  }

  // "91%" – treat as percentage of a nominal 1 Gbps
  const pctMatch = str.match(/([\d.]+)%/);
  if (pctMatch) {
    return { value: parseFloat(pctMatch[1]) * 10, unit: 'Mbps', display: str };
  }

  return { value: 0, unit: 'Mbps', display: str || '—' };
}

/**
 * Extracts a plain numeric percentage from strings like "100% (15ms latency)".
 *
 * @param {string} raw
 * @returns {number} 0–100
 */
function parsePct(raw = '') {
  const m = String(raw).match(/([\d.]+)%/);
  return m ? Math.min(100, parseFloat(m[1])) : 100;
}

/**
 * Builds the full HTML string for the status card.
 *
 * @param {object} opts
 * @param {string} opts.siteName
 * @param {string} opts.isp
 * @param {string} opts.dateStr
 * @param {object} opts.telemetry  - from getLiveTelemetry()
 * @param {object} opts.orbStatus  - from ensureOrbRunning()
 * @returns {string}
 */
function buildCardHtml({ siteName, isp, dateStr, telemetry, orbStatus }) {
  const healthPct  = parsePct(telemetry?.networkHealth);
  const relPct     = parsePct(telemetry?.reliability);
  const speedInfo  = parseSpeed(telemetry?.speed);
  const speedPct   = Math.min(100, (speedInfo.value / 1000) * 100);  // cap at 1 Gbps

  const ping       = telemetry?.ping?.avgLatencyMs ?? '—';
  const loss       = telemetry?.ping?.packetLossPercent ?? '—';
  const adapter    = telemetry?.adapter?.adapterName ?? 'Active Adapter';

  const orbOnline  = orbStatus?.isRunning ?? false;
  const orbPid     = orbStatus?.pid ?? '';
  const orbLabel   = orbOnline ? 'ONLINE' : 'OFFLINE';
  const orbColor   = orbOnline ? '#00e676' : '#ff5252';
  const orbGlow    = orbOnline ? '0 0 10px #00e67680' : '0 0 10px #ff525280';

  const allGood    = healthPct >= 90 && relPct >= 90 && loss === 0;
  const statusText = orbOnline
    ? (allGood ? 'All devices operational' : 'Degraded — check metrics')
    : '⚠️ Orb Engine offline';
  const statusBg   = allGood && orbOnline ? '#00e67618' : '#ff525218';
  const statusBorder = allGood && orbOnline ? '#00e676' : '#ff5252';
  const statusTextColor = allGood && orbOnline ? '#00e676' : '#ff5252';

  const topDotColor = orbOnline && allGood ? '#00e676' : '#ff5252';
  const topDotGlow  = orbOnline && allGood
    ? '0 0 16px 4px #00e67688'
    : '0 0 16px 4px #ff525288';

  // Helper to render one SVG ring
  const ring = (pct, color) => `
    <svg width="70" height="70" viewBox="0 0 70 70">
      <circle cx="35" cy="35" r="28" fill="none" stroke="#ffffff14" stroke-width="7"/>
      <circle cx="35" cy="35" r="28" fill="none"
        stroke="${color}" stroke-width="7"
        stroke-linecap="round"
        stroke-dasharray="${ringDash(pct, 28)}"
        transform="rotate(-90 35 35)"
        style="transition: stroke-dasharray 0.6s ease"/>
    </svg>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: 420px;
    background: transparent;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .card {
    width: 420px;
    background: linear-gradient(145deg, #0d1117 0%, #161b22 100%);
    border: 1px solid #30363d;
    border-radius: 20px;
    padding: 28px 26px 22px;
    position: relative;
    overflow: hidden;
  }

  /* Subtle background grid */
  .card::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
    background-size: 28px 28px;
    border-radius: 20px;
    pointer-events: none;
  }

  /* Top status dot */
  .status-dot-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 14px;
  }
  .status-dot {
    width: 18px; height: 18px;
    border-radius: 50%;
    background: ${topDotColor};
    box-shadow: ${topDotGlow};
  }

  /* Header */
  .header { text-align: center; margin-bottom: 16px; }
  .header h1 {
    font-size: 17px;
    font-weight: 700;
    color: #f0f6fc;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }
  .header .site {
    font-size: 13px;
    color: #8b949e;
    margin-top: 4px;
  }
  .header .isp {
    font-size: 12px;
    color: #58a6ff;
    margin-top: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
  }
  .header .isp::before {
    content: '🌐';
    font-size: 12px;
  }

  /* Divider */
  .divider {
    border: none;
    border-top: 1px solid #21262d;
    margin: 16px 0;
  }

  /* Metrics grid */
  .metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 16px;
  }

  .metric {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px 8px;
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 12px;
  }

  .metric-label {
    font-size: 10px;
    font-weight: 600;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    text-align: center;
  }

  .metric-value {
    font-size: 16px;
    font-weight: 700;
    color: #f0f6fc;
    text-align: center;
    line-height: 1;
  }

  /* Orb Engine tile */
  .orb-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px 8px;
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 12px;
  }
  .orb-indicator {
    width: 14px; height: 14px;
    border-radius: 50%;
    background: ${orbColor};
    box-shadow: ${orbGlow};
    flex-shrink: 0;
  }
  .orb-value {
    font-size: 16px;
    font-weight: 700;
    color: ${orbColor};
    text-align: center;
    line-height: 1;
  }

  /* Status bar */
  .status-bar {
    background: ${statusBg};
    border: 1px solid ${statusBorder};
    border-radius: 8px;
    padding: 10px 14px;
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: ${statusTextColor};
    margin-bottom: 14px;
    letter-spacing: 0.4px;
  }

  /* Metric pills */
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 14px;
  }
  .pill {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 20px;
    padding: 4px 10px;
    font-size: 10px;
    color: #8b949e;
    white-space: nowrap;
  }
  .pill span { color: #f0f6fc; font-weight: 600; }

  /* Footer */
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .footer .brand {
    font-size: 9px;
    color: #3d444d;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .footer .date {
    font-size: 10px;
    color: #3d444d;
    letter-spacing: 0.3px;
  }
</style>
</head>
<body>
<div class="card">
  <div class="status-dot-wrap">
    <div class="status-dot"></div>
  </div>

  <div class="header">
    <h1>Site Status Report</h1>
    <div class="site">${siteName}</div>
    <div class="isp">${isp}</div>
  </div>

  <hr class="divider">

  <div class="metrics">
    <!-- Network Health -->
    <div class="metric">
      <div class="metric-label">Network Health</div>
      ${ring(healthPct, '#00e676')}
      <div class="metric-value">${healthPct}%</div>
    </div>

    <!-- Reliability -->
    <div class="metric">
      <div class="metric-label">Reliability</div>
      ${ring(relPct, '#00e676')}
      <div class="metric-value">${relPct}%</div>
    </div>

    <!-- Speed -->
    <div class="metric">
      <div class="metric-label">Link Speed</div>
      ${ring(speedPct, '#58a6ff')}
      <div class="metric-value">${speedInfo.display}</div>
    </div>

    <!-- Orb Engine -->
    <div class="orb-tile">
      <div class="metric-label">Orb Engine</div>
      <div class="orb-indicator"></div>
      <div class="orb-value">${orbLabel}</div>
      ${orbPid ? `<div style="font-size:9px;color:#3d444d;">PID ${orbPid}</div>` : ''}
    </div>
  </div>

  <div class="status-bar">${statusText}</div>

  <div class="pills">
    <div class="pill">Ping <span>${ping}ms</span></div>
    <div class="pill">Loss <span>${loss}%</span></div>
    <div class="pill">Adapter <span>${adapter}</span></div>
  </div>

  <div class="footer">
    <div class="brand">Edge Reporter</div>
    <div class="date">${dateStr}</div>
  </div>
</div>
</body>
</html>`;
}

/**
 * Renders the dashboard card to a PNG file using Puppeteer.
 *
 * @param {string} outputPath  Absolute path where the PNG should be saved
 * @param {object} opts
 * @param {string} opts.siteName
 * @param {string} opts.isp
 * @param {string} opts.dateStr       e.g. "16 Sep 2026"
 * @param {object} opts.telemetry     from getLiveTelemetry()
 * @param {object} opts.orbStatus     from ensureOrbRunning()
 * @returns {Promise<string>}         Resolves with outputPath on success
 */
export async function generateCard(outputPath, opts = {}) {
  const html = buildCardHtml(opts);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 420, height: 800 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Measure the actual card height so we don't get blank space below
    const cardHeight = await page.evaluate(() => {
      const card = document.querySelector('.card');
      return card ? Math.ceil(card.getBoundingClientRect().height) : 600;
    });

    // Snapshot just the card element
    const cardEl = await page.$('.card');
    await cardEl.screenshot({
      path: outputPath,
      type: 'png'
    });

    return outputPath;
  } finally {
    await browser.close();
  }
}
