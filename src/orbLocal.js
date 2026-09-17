import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';

const LOCAL_SUMMARY_PORT = 7443;
const LOCAL_SUMMARY_PATH = '/api/v1/summary';

function candidateConfigDirs() {
  const dirs = [];
  if (process.env.ORB_CONFIG_DIR) dirs.push(path.resolve(process.env.ORB_CONFIG_DIR));
  if (process.env.USERPROFILE) dirs.push(path.join(process.env.USERPROFILE, '.config', 'orb'));
  if (process.env.HOME) dirs.push(path.join(process.env.HOME, '.config', 'orb'));
  dirs.push('C:/ProgramData/Orb');
  return [...new Set(dirs)];
}

export function findOrbCertificateConfig() {
  for (const dir of candidateConfigDirs()) {
    const certificatePath = path.join(dir, 'certificate.crt');
    const keyPath = path.join(dir, 'private.key');
    if (fs.existsSync(certificatePath) && fs.existsSync(keyPath)) {
      return { dir, certificatePath, keyPath };
    }
  }
  return null;
}

function fetchLocalSummary(auth) {
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: '127.0.0.1',
      port: LOCAL_SUMMARY_PORT,
      path: LOCAL_SUMMARY_PATH,
      method: 'GET',
      cert: fs.readFileSync(auth.certificatePath),
      key: fs.readFileSync(auth.keyPath),
      rejectUnauthorized: false,
      headers: { Accept: 'application/json' },
      timeout: 9000,
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new Error(`Orb local summary returned HTTP ${response.statusCode}.`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Orb local summary was not valid JSON: ${error.message}`));
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Orb local summary request timed out.')));
    request.on('error', reject);
    request.end();
  });
}

function displayComponent(score) {
  return score?.display ?? 0;
}

export function normalizeOrbSummary(summary) {
  const tags = summary.tags || {};
  const device = tags.device_info || {};
  const network = tags.network_interface || {};
  const geo = tags.geoip || {};
  const orbScore = summary.orb_score || summary.orb_scores?.[0] || {};
  const digest = orbScore.digest || {};
  const components = orbScore.components || {};
  const latencyMs = digest.latency_mean_us != null
    ? Number((digest.latency_mean_us / 1000).toFixed(1))
    : null;
  const isOffline = (digest.unresponsive_ms || 0) >= (digest.measured_ms || Infinity);
  const score = Number(orbScore.display ?? 0);

  return {
    id: `local-${(device.name || os.hostname()).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name: device.full_name || device.name || os.hostname(),
    source: 'orb-local',
    connection: network.name || network.type || 'Unknown Interface',
    isp: geo.isp_name || 'Unknown ISP',
    location: [geo.city, geo.state || geo.country].filter(Boolean).join(', ') || 'Unknown',
    score,
    status: isOffline ? 'OFFLINE' : score < 75 ? 'DEGRADED' : 'ONLINE',
    latencyMs,
    packetLossPct: digest.latency_lost_count || 0,
    downloadMbps: digest.download_mean_kbps ? Math.round(digest.download_mean_kbps / 1000) : null,
    uploadMbps: digest.upload_mean_kbps ? Math.round(digest.upload_mean_kbps / 1000) : null,
    speed: digest.download_mean_kbps
      ? `${Math.round(digest.download_mean_kbps / 1000)} Mbps down / ${Math.round((digest.upload_mean_kbps || 0) / 1000)} Mbps up`
      : 'Unavailable',
    components: {
      reliability: displayComponent(components.reliability_score),
      responsiveness: displayComponent(components.responsiveness_score),
      bandwidth: displayComponent(components.bandwidth_score),
    },
    uptime: isOffline ? 'Offline' : 'Online',
  };
}

export async function getLocalOrbTelemetry() {
  const auth = findOrbCertificateConfig();
  if (!auth) {
    throw new Error('Orb certificate not found. Expected %USERPROFILE%\\.config\\orb\\certificate.crt and private.key, or set ORB_CONFIG_DIR.');
  }
  const summary = await fetchLocalSummary(auth);
  const site = normalizeOrbSummary(summary);
  console.log(`[Orb Local] Read live summary for ${site.name} (score ${site.score}).`);
  return [site];
}
