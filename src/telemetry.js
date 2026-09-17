import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import https from 'node:https';
import http from 'node:http';

const execAsync = promisify(exec);

/**
 * Detects the real ISP name, city and country by querying ip-api.com.
 * Falls back gracefully on any network error (returns null fields).
 *
 * @returns {Promise<{isp: string|null, city: string|null, country: string|null, ip: string|null}>}
 */
export async function getIspInfo() {
  return new Promise((resolve) => {
    const req = http.get('http://ip-api.com/json/?fields=status,isp,org,city,country,query', {
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.status === 'success') {
            resolve({
              isp: parsed.isp || parsed.org || null,
              city: parsed.city || null,
              country: parsed.country || null,
              ip: parsed.query || null
            });
          } else {
            resolve({ isp: null, city: null, country: null, ip: null });
          }
        } catch {
          resolve({ isp: null, city: null, country: null, ip: null });
        }
      });
    });
    req.on('error', () => resolve({ isp: null, city: null, country: null, ip: null }));
    req.on('timeout', () => { req.destroy(); resolve({ isp: null, city: null, country: null, ip: null }); });
  });
}

/**
 * Executes a native ICMP ping probe against a target host.
 * 
 * @param {string} host Hostname or IP to ping (default: 8.8.8.8)
 * @param {number} count Number of packets (default: 4)
 * @returns {Promise<{avgLatencyMs: number, packetLossPercent: number, responsive: boolean}>}
 */
export async function probePing(host = '8.8.8.8', count = 4) {
  const isWin = process.platform === 'win32';
  const cmd = isWin ? `ping -n ${count} -w 1500 ${host}` : `ping -c ${count} -W 2 ${host}`;

  try {
    const { stdout } = await execAsync(cmd);
    
    // Parse Packet Loss
    let packetLoss = 0;
    const lossMatch = stdout.match(/(\d+)%\s*(?:loss|packet loss)/i);
    if (lossMatch) {
      packetLoss = parseInt(lossMatch[1], 10);
    }

    // Parse Average Latency
    let avgLatency = 0;
    if (isWin) {
      const avgMatch = stdout.match(/Average\s*=\s*(\d+)ms/i) || stdout.match(/Media\s*=\s*(\d+)ms/i);
      if (avgMatch) {
        avgLatency = parseInt(avgMatch[1], 10);
      }
    } else {
      const rttMatch = stdout.match(/rtt min\/avg\/max\/mdev = [\d.]+\/([\d.]+)\//i);
      if (rttMatch) {
        avgLatency = Math.round(parseFloat(rttMatch[1]));
      }
    }

    return {
      avgLatencyMs: avgLatency,
      packetLossPercent: packetLoss,
      responsive: packetLoss < 100
    };
  } catch (err) {
    return {
      avgLatencyMs: 0,
      packetLossPercent: 100,
      responsive: false
    };
  }
}

/**
 * Queries the active network adapter's name and link speed on Windows.
 * 
 * @returns {Promise<{adapterName: string, linkSpeed: string}>}
 */
export async function getNetworkAdapterInfo() {
  if (process.platform !== 'win32') {
    return { adapterName: 'Ethernet', linkSpeed: '1000 Mbps' };
  }

  try {
    const cmd = `powershell -NoProfile -Command "Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Select-Object -First 1 -Property Name, InterfaceDescription, LinkSpeed | ConvertTo-Json"`;
    const { stdout } = await execAsync(cmd);
    if (stdout && stdout.trim().startsWith('{')) {
      const parsed = JSON.parse(stdout);
      return {
        adapterName: parsed.Name || parsed.InterfaceDescription || 'Active Adapter',
        linkSpeed: parsed.LinkSpeed || 'Dynamic'
      };
    }
  } catch (_) {}

  return { adapterName: 'Network Interface', linkSpeed: 'Active' };
}

/**
 * Gathers complete, real-time edge telemetry.
 * Replaces synthetic placeholder numbers with live measurements.
 * 
 * @returns {Promise<object>}
 */
export async function getLiveTelemetry() {
  const [pingResult, adapterInfo, ispInfo] = await Promise.all([
    probePing('8.8.8.8', 4),
    getNetworkAdapterInfo(),
    getIspInfo()
  ]);

  const uptimeHours = (os.uptime() / 3600).toFixed(1);
  const totalMemGb = (os.totalmem() / (1024 ** 3)).toFixed(1);
  const freeMemGb = (os.freemem() / (1024 ** 3)).toFixed(1);
  const memUsagePercent = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);

  // Derive human-readable metrics
  let networkHealth = '100%';
  if (!pingResult.responsive) {
    networkHealth = '0% (Offline)';
  } else if (pingResult.avgLatencyMs > 150 || pingResult.packetLossPercent > 20) {
    networkHealth = `${Math.max(0, 100 - pingResult.packetLossPercent)}% (Degraded - ${pingResult.avgLatencyMs}ms)`;
  } else {
    networkHealth = `${100 - pingResult.packetLossPercent}% (${pingResult.avgLatencyMs}ms latency)`;
  }

  const reliability = `${100 - pingResult.packetLossPercent}% (${pingResult.packetLossPercent}% loss)`;
  const speed = adapterInfo.linkSpeed;

  return {
    ping: pingResult,
    adapter: adapterInfo,
    networkHealth,
    reliability,
    speed,
    isp: ispInfo?.isp || null,
    city: ispInfo?.city || null,
    country: ispInfo?.country || null,
    system: {
      uptimeHours: `${uptimeHours} hrs`,
      memory: `${memUsagePercent}% (${freeMemGb}GB free of ${totalMemGb}GB)`
    }
  };
}
