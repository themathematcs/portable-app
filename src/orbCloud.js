const DEFAULT_API_URL = 'https://panel.orb.net';

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function numberValue(...values) {
  const value = firstValue(...values);
  if (value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeCloudDevice(device) {
  const summary = device.summary || device.latest_summary || {};
  const tags = summary.tags || device.tags || {};
  const deviceInfo = tags.device_info || {};
  const network = tags.network_interface || {};
  const geo = tags.geoip || {};
  const orbScore = summary.orb_score || summary.orb_scores?.[0] || {};
  const digest = orbScore.digest || summary.digest || {};
  const components = orbScore.components || summary.components || {};
  const score = numberValue(orbScore.display, orbScore.score, summary.orb_score, summary.score, device.score) ?? 0;
  const isConnected = firstValue(device.is_connected, device.connected);
  const status = isConnected === 0 || isConnected === false ? 'OFFLINE' : score < 75 ? 'DEGRADED' : 'ONLINE';

  return {
    id: String(firstValue(device.orb_id, device.id, summary.orb_id, deviceInfo.id) || `cloud-${Date.now()}`),
    name: String(firstValue(device.name, summary.orb_name, deviceInfo.full_name, deviceInfo.name) || 'Unnamed Orb'),
    source: 'orb-cloud',
    connection: String(firstValue(network.name, network.type, summary.network_name, device.network_name) || 'Unknown Interface'),
    isp: String(firstValue(geo.isp_name, summary.isp_name, device.isp_name) || 'Unknown ISP'),
    location: [firstValue(geo.city, summary.city, device.city), firstValue(geo.state, summary.state, device.state, geo.country)].filter(Boolean).join(', ') || 'Unknown',
    score,
    status,
    latencyMs: digest.latency_mean_us != null ? Number((Number(digest.latency_mean_us) / 1000).toFixed(1)) : numberValue(summary.latency_ms, device.latency_ms),
    packetLossPct: numberValue(digest.latency_lost_count, summary.latency_lost_count, device.packet_loss_pct) ?? 0,
    downloadMbps: digest.download_mean_kbps != null ? Math.round(Number(digest.download_mean_kbps) / 1000) : numberValue(summary.download_mbps, device.download_mbps),
    uploadMbps: digest.upload_mean_kbps != null ? Math.round(Number(digest.upload_mean_kbps) / 1000) : numberValue(summary.upload_mbps, device.upload_mbps),
    speed: digest.download_mean_kbps != null ? `${Math.round(Number(digest.download_mean_kbps) / 1000)} Mbps down / ${Math.round(Number(digest.upload_mean_kbps || 0) / 1000)} Mbps up` : 'Unavailable',
    components: {
      reliability: numberValue(components.reliability_score?.display, components.reliability_score, summary.reliability_score) ?? 0,
      responsiveness: numberValue(components.responsiveness_score?.display, components.responsiveness_score, summary.responsiveness_score) ?? 0,
      bandwidth: numberValue(components.bandwidth_score?.display, components.bandwidth_score, summary.speed_score) ?? 0,
    },
    uptime: status === 'OFFLINE' ? 'Offline' : 'Online',
  };
}

async function getJson(url, apiToken) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${apiToken}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Orb Cloud API ${response.status} for ${url}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  return response.json();
}

export async function getOrbCloudTelemetry(config) {
  const apiToken = config.orb?.apiToken;
  if (!apiToken) return null;
  const apiUrl = (config.orb.apiUrl || DEFAULT_API_URL).replace(/\/$/, '');
  const organizations = await getJson(`${apiUrl}/api/v2/organizations`, apiToken);
  const organizationList = Array.isArray(organizations) ? organizations : organizations.organizations || [];
  if (organizationList.length === 0) throw new Error('Orb Cloud API returned no organizations. Check Organizations: Read permission.');

  const sites = [];
  for (const organization of organizationList) {
    const organizationId = organization.organization_id || organization.id;
    if (!organizationId) continue;
    const devices = await getJson(`${apiUrl}/api/v2/organization/${encodeURIComponent(organizationId)}/devices`, apiToken);
    const deviceList = Array.isArray(devices) ? devices : devices.devices || [];
    sites.push(...deviceList.map(normalizeCloudDevice));
  }
  if (sites.length === 0) throw new Error('Orb Cloud API returned no devices. Check Devices: Read permission and Space access.');
  console.log(`[Orb Cloud] Read ${sites.length} device(s) across ${organizationList.length} organization(s).`);
  return sites;
}
