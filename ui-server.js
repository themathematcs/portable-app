import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ensureOrbRunning, discoverOrbExecutable } from './src/orbGuardian.js';
import { getLocalOrbTelemetry, findOrbCertificateConfig } from './src/orbLocal.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;
const uiDir = path.join(rootDir, 'ui');
const configPath = path.join(rootDir, 'config.json');
const exampleConfigPath = path.join(rootDir, 'config.json.example');
const envPath = path.join(rootDir, '.env');

// Load .env secrets
try {
  const require = createRequire(import.meta.url);
  const dotenv = require('dotenv');
  dotenv.config({ path: envPath });
} catch { /* dotenv not installed */ }

function getFreePort(startPort = 4173, maxAttempts = 25) {
  return new Promise((resolve, reject) => {
    const tryPort = (candidate) => {
      const tester = net.createServer();
      tester.once('error', (error) => {
        if (error.code === 'EADDRINUSE' && candidate < startPort + maxAttempts) {
          tryPort(candidate + 1);
          return;
        }
        reject(error);
      });
      tester.once('listening', () => {
        tester.close(() => resolve(candidate));
      });
      tester.listen(candidate);
    };

    tryPort(startPort);
  });
}

const preferredPort = Number(process.env.PORT || 4173);
const port = await getFreePort(preferredPort);

function ensureConfigFile() {
  if (!fs.existsSync(configPath) && fs.existsSync(exampleConfigPath)) {
    const sample = fs.readFileSync(exampleConfigPath, 'utf8');
    fs.writeFileSync(configPath, sample, 'utf8');
  }
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

// ─── .env helpers ─────────────────────────────────────────────────────────────
function readEnv() {
  const vars = {};
  try {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      vars[key] = val;
    }
  } catch { /* no .env file */ }
  return vars;
}

function writeEnv(updates) {
  let content = '';
  try { content = fs.readFileSync(envPath, 'utf8'); } catch { content = ''; }
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^(${key}\\s*=.*)$`, 'm');
    const line = `${key}=${value}`;
    if (regex.test(content)) {
      content = content.replace(regex, line);
    } else {
      content = content.trimEnd() + '\n' + line + '\n';
    }
  }
  fs.writeFileSync(envPath, content, 'utf8');
  // Also update process.env so token-status works immediately
  for (const [k, v] of Object.entries(updates)) process.env[k] = v;
}

// ─── saveConfig ───────────────────────────────────────────────────────────────
async function saveConfig(request, res) {
  try {
    const raw = await new Promise((resolve, reject) => {
      let body = '';
      request.on('data', chunk => { body += chunk; if (body.length > 1_000_000) { reject(new Error('Payload too large')); request.destroy(); } });
      request.on('end', () => resolve(body));
      request.on('error', reject);
    });

    const payload = JSON.parse(raw || '{}');
    const existing = readJsonFile(configPath) || readJsonFile(exampleConfigPath) || {};
    const merged = {
      ...existing,
      ...payload,
      site: { ...existing.site, ...payload.site },
      performance: { ...existing.performance, ...payload.performance },
      statusNotes: { ...existing.statusNotes, ...payload.statusNotes },
      telegram: { ...existing.telegram, ...payload.telegram },
      whatsapp: { ...existing.whatsapp, ...payload.whatsapp },
      orb: { ...existing.orb, ...payload.orb },
      agent: { ...existing.agent, ...payload.agent },
      alerts: { ...existing.alerts, ...payload.alerts },
      schedule: { ...existing.schedule, ...payload.schedule },
      reporting: { ...existing.reporting, ...payload.reporting }
    };

    // API token always lives in .env, never in config.json
    if (merged.orb) delete merged.orb.apiToken;

    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
    sendJson(res, 200, { ok: true, message: 'Settings saved.' });
  } catch (error) {
    sendJson(res, 400, { ok: false, message: error.message || 'Invalid settings payload.' });
  }
}


function runCommand(command, args, label = 'command') {
  return new Promise((resolve, reject) => {
    console.log(`[UI Action] Starting ${label}: ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      cwd: rootDir,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      const text = chunk.toString();
      stdout += text;
      if (text.trim()) {
        process.stdout.write(text);
      }
    });

    child.stderr.on('data', chunk => {
      const text = chunk.toString();
      stderr += text;
      if (text.trim()) {
        process.stderr.write(text);
      }
    });

    child.on('close', code => {
      if (code === 0) {
        console.log(`[UI Action] Completed ${label} successfully.`);
        resolve({ ok: true, stdout, stderr });
      } else {
        const message = stderr || stdout || `Command failed with exit code ${code}`;
        console.error(`[UI Action] Failed ${label}: ${message.trim()}`);
        reject(new Error(message.trim()));
      }
    });

    child.on('error', (error) => {
      console.error(`[UI Action] Spawn error for ${label}: ${error.message}`);
      reject(error);
    });
  });
}

async function handleAction(action) {
  switch (action) {
    case 'dry-run':
      return runCommand('node', ['agent.js', '--test-whatsapp'], 'WhatsApp connectivity test');
    case 'daily':
    case 'send-report':
    case 'send-all-sites-report':
      return runCommand('node', ['agent.js', '--daily'], 'all-sites Orb report');
    case 'run-daily-schedule':
      return runCommand('node', ['agent.js', '--daily'], 'daily schedule run');
    case 'send-offline-alert':
      return runCommand('node', ['agent.js', '--test-alert'], 'offline site alert');
    case 'test-whatsapp':
      return runCommand('node', ['agent.js', '--test-whatsapp'], 'WhatsApp connectivity test');
    case 'pair-whatsapp':
    case 'pair-whatsapp-ui':
      return { ok: true, message: 'Pairing started in the UI.' };
    case 'pair-phone':
      return runCommand('node', ['agent.js', '--phone', '00000000']);
    default:
      throw new Error('Unknown action');
  }
}

async function runAction(request, res) {
  try {
    const raw = await new Promise((resolve, reject) => {
      let body = '';
      request.on('data', chunk => { body += chunk; if (body.length > 1_000_000) { reject(new Error('Payload too large')); request.destroy(); } });
      request.on('end', () => resolve(body));
      request.on('error', reject);
    });

    const payload = JSON.parse(raw || '{}');
    const result = await handleAction(payload.action);
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error.message || 'Command execution failed.' });
  }
}

function serveStaticFile(req, res, filePath) {
  try {
    const safePath = path.normalize(filePath);
    if (!safePath.startsWith(uiDir)) {
      throw new Error('Invalid path');
    }

    const content = fs.readFileSync(safePath);
    const ext = path.extname(safePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };

    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const pairingState = {
  status: 'idle',
  mode: 'qr',
  qrDataUrl: '',
  code: '',
  message: '',
  connected: false
};

let pairingTask = null;

async function startPairingProcess(method = 'qr', phoneNumber = '') {
  if (pairingTask) {
    return pairingTask;
  }

  pairingState.status = 'connecting';
  pairingState.mode = method;
  pairingState.qrDataUrl = '';
  pairingState.code = '';
  pairingState.message = method === 'code'
    ? 'Waiting for the pairing code flow to complete.'
    : 'Waiting for the QR code scan to complete.';
  pairingState.connected = false;

  const { pairWhatsAppInteractive } = await import('./src/whatsapp.js');
  pairingTask = pairWhatsAppInteractive({
    authFolder: './auth_info',
    phoneNumber: method === 'code' ? phoneNumber : '',
    forceReset: false,
    openBrowser: false,
    onProgress: (event) => {
      if (event.type === 'qr') {
        pairingState.status = 'waiting-for-qr';
        pairingState.qrDataUrl = event.qrDataUrl || '';
        pairingState.message = 'Scan the QR code inside WhatsApp on your phone.';
      }
      if (event.type === 'pairingCode') {
        pairingState.status = 'waiting-for-code';
        pairingState.code = event.code || '';
        pairingState.message = 'Use the pairing code shown below in WhatsApp.';
      }
      if (event.type === 'connected') {
        pairingState.status = 'connected';
        pairingState.connected = true;
        pairingState.message = 'WhatsApp is connected and ready.';
      }
    }
  }).catch((error) => {
    pairingState.status = 'error';
    pairingState.message = error.message || 'WhatsApp pairing failed.';
    throw error;
  }).finally(() => {
    pairingTask = null;
  });

  return pairingTask;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);

  if (req.method === 'GET' && url.pathname === '/api/env') {
    sendJson(res, 200, readEnv());
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/env') {
    (async () => {
      try {
        const raw = await new Promise((resolve, reject) => {
          let body = '';
          req.on('data', chunk => { body += chunk; if (body.length > 1_000_000) { reject(new Error('Payload too large')); req.destroy(); } });
          req.on('end', () => resolve(body));
          req.on('error', reject);
        });
        const payload = JSON.parse(raw || '{}');
        if (!payload || typeof payload !== 'object') throw new Error('Invalid env payload.');
        writeEnv(payload);
        sendJson(res, 200, { ok: true, message: 'Environment values updated successfully.' });
      } catch (error) {
        sendJson(res, 400, { ok: false, message: error.message || 'Invalid env payload.' });
      }
    })();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/token-status') {
    (async () => {
      try {
        const token = readEnv().ORB_API_TOKEN || '';
        if (!token) {
          sendJson(res, 200, { valid: false, sitesDetected: 0, message: 'No Orb API token has been saved in the .env file.' });
          return;
        }

        const response = await fetch('https://panel.orb.net/api/v2/organizations', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
          sendJson(res, 200, { valid: false, sitesDetected: 0, message: `Token rejected by Orb API: ${response.status} ${response.statusText}` });
          return;
        }

        const data = await response.json().catch(() => ({}));
        const sitesDetected = Array.isArray(data) ? data.length : Array.isArray(data.organizations) ? data.organizations.length : 0;
        sendJson(res, 200, { valid: true, sitesDetected, message: `Orb token is valid. ${sitesDetected} organization(s) detected.` });
      } catch (error) {
        sendJson(res, 200, { valid: false, sitesDetected: 0, message: error.message || 'Unable to validate Orb token.' });
      }
    })();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/config') {
    ensureConfigFile();
    const config = readJsonFile(configPath) || readJsonFile(exampleConfigPath) || {};
    sendJson(res, 200, config);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/orb-status') {
    (async () => {
      try {
        const config = readJsonFile(configPath) || readJsonFile(exampleConfigPath) || {};
        const orbRuntime = await ensureOrbRunning({ autoLaunch: true, maxWaitMs: 15000 });
        if (!orbRuntime.isRunning) {
          throw new Error(`Orb could not be started. ${orbRuntime.error || 'Install Orb or start it on this computer.'}`);
        }
        const discovery = await discoverOrbExecutable();
        const sites = await getLocalOrbTelemetry(config);
        const first = Array.isArray(sites) ? sites[0] : null;
        const { findOrbCertificateConfig } = await import('./src/orbLocal.js');
        const auth = findOrbCertificateConfig(config.orb || {});
        sendJson(res, 200, {
          ok: true,
          siteName: first?.name || '',
          isp: first?.isp || '',
          status: first?.status || 'UNKNOWN',
          data: first || null,
          processId: orbRuntime.pid || null,
          hasVisibleWindow: orbRuntime.hasVisibleWindow || false,
          autoStarted: orbRuntime.autoStarted || false,
          executablePath: discovery.executablePath || null,
          searchedPaths: discovery.searchedPaths || [],
          certificateDirectory: auth?.dir || null,
          certificatePath: auth?.certificatePath || null,
          privateKeyPath: auth?.keyPath || null,
          certificateSource: auth?.source || null,
          message: orbRuntime.hasVisibleWindow
            ? `Orb is running with a visible desktop window at ${discovery.executablePath || 'unknown location'} and live summary data is loaded.`
            : `Orb is running in the background (PID ${orbRuntime.pid || 'unknown'}); it has no visible desktop window. Live summary data is loaded.`
        });
      } catch (error) {
        const discovery = await discoverOrbExecutable().catch(() => ({
          executablePath: null,
          searchedPaths: [],
          error: 'Orb discovery failed.'
        }));
        sendJson(res, 200, {
          ok: false,
          siteName: '',
          isp: '',
          status: 'FAILED',
          processId: null,
          hasVisibleWindow: false,
          autoStarted: false,
          message: error.message || 'Orb status unavailable.',
          executablePath: discovery.executablePath || null,
          searchedPaths: discovery.searchedPaths || [],
          certificateDirectory: null,
          certificatePath: null,
          privateKeyPath: null,
          failureReason: discovery.error || error.message || 'Orb status unavailable.'
        });
      }
    })();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/pairing-state') {
    sendJson(res, 200, pairingState);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/config') {
    saveConfig(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/run') {
    (async () => {
      try {
        const raw = await new Promise((resolve, reject) => {
          let body = '';
          req.on('data', chunk => { body += chunk; if (body.length > 1_000_000) { reject(new Error('Payload too large')); req.destroy(); } });
          req.on('end', () => resolve(body));
          req.on('error', reject);
        });

        const payload = JSON.parse(raw || '{}');
        if (payload.action === 'pair-whatsapp' || payload.action === 'pair-whatsapp-ui') {
          await startPairingProcess(payload.method || 'qr', payload.phoneNumber || '');
          sendJson(res, 200, { ok: true, message: 'WhatsApp pairing started in the app UI.' });
          return;
        }

        const result = await handleAction(payload.action);
        sendJson(res, 200, { ok: true, ...result });
      } catch (error) {
        sendJson(res, 500, { ok: false, message: error.message || 'Command execution failed.' });
      }
    })();
    return;
  }

  let requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  requestedPath = requestedPath.replace(/^\/+/, '');
  serveStaticFile(req, res, path.join(uiDir, requestedPath));
});

ensureConfigFile();
server.listen(port, () => {
  console.log(`Portable setup UI is running at http://localhost:${port}`);
  console.log('If 4173 was in use, a free port was selected automatically.');
  console.log('Use the browser to configure WhatsApp, Telegram, timing, and report settings.');
});
