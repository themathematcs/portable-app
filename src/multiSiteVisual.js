/**
 * Multi-Site Visual Dashboard & Alert Card Generator — src/multiSiteVisual.js
 *
 * Renders high-resolution PNG dashboard cards using Puppeteer:
 * 1. Multi-Site Overview Grid (all currently discovered sites in native Orb purple/green aesthetic)
 * 2. Incident Alert Card (High-priority red/amber card for 24/7 network alerts)
 */

import puppeteer from 'puppeteer';

/**
 * Returns color codes and glow styles based on site score and status.
 */
function getScoreStyling(score, status) {
  if (status === 'OFFLINE' || score < 50) {
    return {
      color: '#ff4d4f',
      bgGlow: 'rgba(255, 77, 79, 0.45)',
      ringColor: '#ff4d4f',
      statusText: 'OFFLINE',
      statusColor: '#ff7875'
    };
  }
  if (status === 'DEGRADED' || score < 75) {
    return {
      color: '#faad14',
      bgGlow: 'rgba(250, 173, 20, 0.45)',
      ringColor: '#faad14',
      statusText: 'DEGRADED',
      statusColor: '#ffc53d'
    };
  }
  return {
    color: '#52c41a',
    bgGlow: 'rgba(82, 196, 26, 0.45)',
    ringColor: '#52c41a',
    statusText: 'ONLINE',
    statusColor: '#73d13d'
  };
}

/**
 * Builds HTML for the discovered-site overview grid dashboard.
 */
function buildMultiSiteHtml(sites, dateStr) {
  const total = sites.length;
  const onlineCount = sites.filter(s => s.status === 'ONLINE').length;
  const degradedCount = sites.filter(s => s.status === 'DEGRADED').length;
  const offlineCount = sites.filter(s => s.status === 'OFFLINE').length;
  const avgScore = Math.round(sites.reduce((acc, s) => acc + (s.score || 0), 0) / total);

  const siteCardsHtml = sites.map(site => {
    const styling = getScoreStyling(site.score, site.status);
    return `
      <div class="site-card ${site.status.toLowerCase()}">
        <div class="card-top">
          <span class="site-name">${site.name}</span>
          <span class="badge ${site.status.toLowerCase()}">${styling.statusText}</span>
        </div>
        
        <div class="card-body">
          <div class="orb-container">
            <div class="orb-ball" style="border-color: ${styling.ringColor}; box-shadow: 0 0 16px ${styling.bgGlow};">
              <span class="score-label">ORB</span>
              <span class="score-num" style="color: ${styling.color};">${site.score}</span>
              <div class="orb-icons">
                <span>⚡</span><span>💎</span><span>☁️</span>
              </div>
            </div>
          </div>
          
          <div class="site-details">
            <div class="detail-row"><span class="icon">🔌</span> ${site.connection}</div>
            <div class="detail-row"><span class="icon">🌐</span> <strong>${site.isp}</strong></div>
            <div class="detail-row"><span class="icon">📍</span> ${site.location}</div>
            <div class="detail-row uptime"><span class="icon">⏱️</span> ${site.uptime || 'Active'}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 980px;
    background: #0f071e;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #ffffff;
    padding: 24px;
  }
  .dashboard {
    background: linear-gradient(160deg, #150a2b 0%, #1c0f38 100%);
    border: 1px solid #351c6b;
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6);
  }
  .dash-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #351c6b;
    padding-bottom: 18px;
    margin-bottom: 20px;
  }
  .title-group {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .brand-logo {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: radial-gradient(circle, #52c41a 0%, #1f0d3d 85%);
    border: 2px solid #73d13d;
    box-shadow: 0 0 14px rgba(82, 196, 26, 0.6);
  }
  .dash-title {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .dash-subtitle {
    font-size: 13px;
    color: #9d8ec2;
    margin-top: 3px;
  }
  .stats-summary {
    display: flex;
    gap: 12px;
  }
  .stat-pill {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    background: #231245;
    border: 1px solid #432585;
  }
  .stat-pill.online { color: #73d13d; border-color: #52c41a; }
  .stat-pill.degraded { color: #ffc53d; border-color: #faad14; }
  .stat-pill.offline { color: #ff7875; border-color: #ff4d4f; }
  
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
  .site-card {
    background: #1e0d3b;
    border: 1px solid #3d1f73;
    border-radius: 14px;
    padding: 14px;
    position: relative;
    transition: all 0.2s;
  }
  .site-card.degraded { border-color: #faad1488; }
  .site-card.offline { border-color: #ff4d4f88; background: #250d24; }
  
  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #2d1654;
  }
  .site-name {
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 170px;
  }
  .badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 10px;
    text-transform: uppercase;
  }
  .badge.online { background: rgba(82, 196, 26, 0.15); color: #73d13d; border: 1px solid #52c41a; }
  .badge.degraded { background: rgba(250, 173, 20, 0.15); color: #ffc53d; border: 1px solid #faad14; }
  .badge.offline { background: rgba(255, 77, 79, 0.15); color: #ff7875; border: 1px solid #ff4d4f; }
  
  .card-body {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .orb-container {
    flex-shrink: 0;
  }
  .orb-ball {
    width: 66px;
    height: 66px;
    border-radius: 50%;
    background: radial-gradient(circle, #251044 10%, #150929 90%);
    border: 2px solid;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .score-label {
    font-size: 7px;
    font-weight: 700;
    color: #9d8ec2;
    letter-spacing: 0.5px;
  }
  .score-num {
    font-size: 20px;
    font-weight: 800;
    line-height: 1.1;
  }
  .orb-icons {
    font-size: 7px;
    display: flex;
    gap: 2px;
    margin-top: 1px;
    opacity: 0.8;
  }
  .site-details {
    flex-grow: 1;
    font-size: 11px;
    color: #d1c7e8;
    display: flex;
    flex-direction: column;
    gap: 3px;
    overflow: hidden;
  }
  .detail-row {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .detail-row .icon { font-size: 10px; margin-right: 3px; }
  .detail-row.uptime { color: #8f7fae; font-size: 10px; margin-top: 2px; }
  
  .dash-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20px;
    padding-top: 14px;
    border-top: 1px solid #351c6b;
    font-size: 11px;
    color: #8f7fae;
  }
</style>
</head>
<body>
<div class="dashboard">
  <div class="dash-header">
    <div class="title-group">
      <div class="brand-logo"></div>
      <div>
        <div class="dash-title">ORB NETWORK OBSERVABILITY – MULTI-SITE DIGEST</div>
        <div class="dash-subtitle">${total} Edge Sites Monitored | Average Health Score: ${avgScore}/100</div>
      </div>
    </div>
    <div class="stats-summary">
      <div class="stat-pill online">● ${onlineCount} Online</div>
      <div class="stat-pill degraded">▲ ${degradedCount} Degraded</div>
      <div class="stat-pill offline">✖ ${offlineCount} Offline</div>
    </div>
  </div>

  <div class="grid">
    ${siteCardsHtml}
  </div>

  <div class="dash-footer">
    <div>Autonomous Edge Monitoring Engine • 24/7 Watchdog Active</div>
    <div>Report Generated: ${dateStr}</div>
  </div>
</div>
</body>
</html>`;
}

/**
 * Builds HTML for an Instant Incident Alert Card (Red/Amber).
 */
function buildIncidentAlertHtml(incident) {
  const isCritical = incident.severity === 'CRITICAL';
  const themeColor = isCritical ? '#ff4d4f' : '#faad14';
  const glowColor = isCritical ? 'rgba(255, 77, 79, 0.4)' : 'rgba(250, 173, 20, 0.4)';
  const alertTitle = isCritical ? 'CRITICAL NETWORK OUTAGE' : 'NETWORK PERFORMANCE DEGRADATION';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 600px;
    background: transparent;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #ffffff;
    padding: 16px;
  }
  .alert-card {
    background: linear-gradient(145deg, #1b0722 0%, #29081e 100%);
    border: 2px solid ${themeColor};
    border-radius: 18px;
    padding: 24px;
    box-shadow: 0 0 30px ${glowColor};
  }
  .alert-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 18px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  .alert-icon {
    font-size: 28px;
  }
  .alert-title {
    font-size: 18px;
    font-weight: 800;
    color: ${themeColor};
    letter-spacing: 0.5px;
  }
  .alert-body {
    display: flex;
    gap: 20px;
    align-items: center;
    margin-bottom: 18px;
  }
  .orb-alert {
    width: 90px;
    height: 90px;
    border-radius: 50%;
    border: 3px solid ${themeColor};
    box-shadow: 0 0 20px ${glowColor};
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #180310;
    flex-shrink: 0;
  }
  .orb-score {
    font-size: 32px;
    font-weight: 800;
    color: ${themeColor};
  }
  .orb-sub { font-size: 9px; color: #aaa; text-transform: uppercase; }
  .details-box {
    flex-grow: 1;
    font-size: 13px;
    line-height: 1.6;
    color: #f0e6ed;
  }
  .detail-line strong { color: #ffffff; }
  .alert-footer {
    font-size: 11px;
    color: #bbb;
    display: flex;
    justify-content: space-between;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
</style>
</head>
<body>
<div class="alert-card">
  <div class="alert-header">
    <div class="alert-icon">${isCritical ? '🚨' : '⚠️'}</div>
    <div>
      <div class="alert-title">${alertTitle}</div>
      <div style="font-size: 12px; color: #ddd;">Incident Detected by 24/7 Watchdog</div>
    </div>
  </div>
  
  <div class="alert-body">
    <div class="orb-alert">
      <div class="orb-score">${incident.score}</div>
      <div class="orb-sub">Score</div>
    </div>
    <div class="details-box">
      <div class="detail-line">📍 <strong>Site:</strong> ${incident.siteName}</div>
      <div class="detail-line">🌐 <strong>ISP:</strong> ${incident.isp} (${incident.connection})</div>
      <div class="detail-line">📉 <strong>Status:</strong> <span style="color: ${themeColor}; font-weight: bold;">${incident.status}</span></div>
      <div class="detail-line">⚡ <strong>Metrics:</strong> Latency: ${incident.latencyMs}ms | Loss: ${incident.packetLossPct}%</div>
    </div>
  </div>

  <div class="alert-footer">
    <div>Automated Watchdog Alert</div>
    <div>Timestamp: ${incident.timestamp}</div>
  </div>
</div>
</body>
</html>`;
}

/**
 * Renders the full discovered-site overview grid to PNG.
 */
export async function generateMultiSiteCard(outputPath, sites, dateStr) {
  const html = buildMultiSiteHtml(sites, dateStr);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 980, height: 1100 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const cardEl = await page.$('.dashboard');
    await cardEl.screenshot({ path: outputPath, type: 'png' });
    return outputPath;
  } finally {
    await browser.close();
  }
}

/**
 * Renders an Incident Alert Card to PNG.
 */
export async function generateIncidentCard(outputPath, incident) {
  const html = buildIncidentAlertHtml(incident);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 600, height: 400 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const cardEl = await page.$('.alert-card');
    await cardEl.screenshot({ path: outputPath, type: 'png' });
    return outputPath;
  } finally {
    await browser.close();
  }
}
