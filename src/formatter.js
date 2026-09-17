/**
 * Formats a Date object into DD MMM YYYY (e.g., 16 Sep 2026).
 * Uses explicit month abbreviations to remain locale-consistent across edge environments.
 * 
 * @param {Date} [date=new Date()]
 * @returns {string} Formatted date string
 */
export function formatDate(date = new Date()) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Generates the standardized Site Status Report text payload.
 * Formatted with Markdown bold markers (*) compatible with both Telegram and WhatsApp.
 * Supports live edge telemetry and Orb guardian metrics.
 * 
 * @param {object} config System configuration object
 * @param {object} [options={}]
 * @param {Date} [options.currentDate=new Date()]
 * @param {object} [options.telemetry=null] Live telemetry data from src/telemetry.js
 * @param {object} [options.orbStatus=null] Orb status from src/orbGuardian.js
 * @returns {string} Formatted status message
 */
export function formatReport(config, options = {}) {
  // Backwards-compatible if second argument is a Date
  const isDate = options instanceof Date;
  const currentDate = isDate ? options : options.currentDate || new Date();
  const telemetry = isDate ? null : options.telemetry || null;
  const orbStatus = isDate ? null : options.orbStatus || null;

  const siteName = config.site?.name || 'Remote Site';
  const isp = telemetry?.isp || config.site?.isp || 'Unknown ISP';
  const dateStr = formatDate(currentDate);

  const health = telemetry?.networkHealth || config.performance?.networkHealth || '100%';
  const reliability = telemetry?.reliability || config.performance?.reliability || '100%';
  const speed = telemetry?.speed || config.performance?.speed || '91%';

  let summary = config.statusNotes?.summary || 'All devices are operational and stable';
  if (orbStatus) {
    summary = orbStatus.isRunning
      ? `All devices are operational and stable (Orb PID: ${orbStatus.pid})`
      : `⚠️ Orb is OFFLINE – Attention required`;
  }

  const notes = telemetry?.ping
    ? `Ping: ${telemetry.ping.avgLatencyMs}ms | Loss: ${telemetry.ping.packetLossPercent}% | Adapter: ${telemetry.adapter?.adapterName || 'Active'} (${telemetry.speed})`
    : config.statusNotes?.notes || 'No issues detected; all devices operational';

  const lines = [
    `📡 *SITE STATUS REPORT – ${siteName}*`,
    `📅 Date: ${dateStr}`,
    `🌐 ISP: ${isp}`,
    ``,
    `📊 *Performance Overview*`,
    `• Network Health: ${health}`,
    `• Reliability: ${reliability}`,
    `• Speed: ${speed}`,
    orbStatus ? `• Orb Engine: ${orbStatus.isRunning ? '🟢 Online' : '🔴 Offline'}` : null,
    ``,
    orbStatus && !orbStatus.isRunning ? `🔴 ${summary}` : `🟢 ${summary}`,
    `📝 Notes: ${notes}`
  ].filter((line) => line !== null);

  return lines.join('\n');
}
