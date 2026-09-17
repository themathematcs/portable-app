/**
 * Orb Clone App Screenshot Engine - src/orbCloneScreenshot.js
 */

import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '..');
const CLONE_APP_DIR = process.env.ORB_CLONE_DIR
  ? path.resolve(process.env.ORB_CLONE_DIR)
  : path.resolve(APP_ROOT, 'orb interface', 'ob');
const DEFAULT_CLONE_PORT = 4173;
const CLONE_PORT_RANGE_SIZE = 25;
const SERVER_START_TIMEOUT_MS = 45_000;

let devServerProcess = null;

export const NAME_TO_CLONE_ID = {
  'sky4':                                 'blackbird',
  'black-bird-hq9':                       'blackbird',
  'blackbird':                            'blackbird',
  'cozlins':                              'cozlins',
  'bbhouse client monitor':               'bbhouse',
  'brookeveg muthaite client monitor':    'brookeveg',
  'gicheha client monitor':              'gicheha',
  'ichaweri client monitor':             'ichaweri',
  'muthaiga iii client monitor':          'muthaiga',
  'sea view client monitor':              'seaview',
  'mara-monitoring':                      'mara',
  'karen hub client monitor':             'karen-hub',
  'lavington point monitor':              'lavington',
  'nyali coastal monitor':                'nyali',
};

export function getCloneRuntimeConfig(overrides = {}) {
  const requestedPort = Number(overrides.port ?? process.env.ORB_CLONE_PORT ?? DEFAULT_CLONE_PORT);
  const port = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort < 65535
    ? requestedPort
    : DEFAULT_CLONE_PORT;

  return {
    appDir: CLONE_APP_DIR,
    host: '127.0.0.1',
    port,
    url: `http://127.0.0.1:${port}`,
  };
}

export function resolveCloneId(siteName, siteId) {
  const candidates = [siteId, siteName]
    .filter(Boolean)
    .map((value) => value.toLowerCase().trim());

  for (const key of candidates) {
    if (NAME_TO_CLONE_ID[key]) return NAME_TO_CLONE_ID[key];
  }

  for (const [k, v] of Object.entries(NAME_TO_CLONE_ID)) {
    if (candidates.some((key) => key.includes(k) || k.includes(key))) return v;
  }
  const fallback = siteId || siteName;
  return fallback
    ? String(fallback).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : null;
}

function isPortOpen(port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' });
    const timer = setTimeout(() => { socket.destroy(); resolve(false); }, timeoutMs);
    socket.on('connect', () => { clearTimeout(timer); socket.destroy(); resolve(true); });
    socket.on('error', () => { clearTimeout(timer); resolve(false); });
  });
}

async function findAvailablePort(startPort = DEFAULT_CLONE_PORT, maxAttempts = CLONE_PORT_RANGE_SIZE) {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = startPort + offset;
    if (!(await isPortOpen(candidate, 600))) return candidate;
  }
  return startPort;
}

async function waitForPort(port, timeoutMs = SERVER_START_TIMEOUT_MS) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const open = await isPortOpen(port);
    if (open) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function installCloneDependencies() {
  const packageJsonPath = path.join(CLONE_APP_DIR, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`[Clone] Orb interface package not found at ${CLONE_APP_DIR}.`);
  }

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  console.log(`[Clone] Installing Orb interface dependencies in ${CLONE_APP_DIR}...`);

  await new Promise((resolve, reject) => {
    const child = spawn(npmCommand, ['install'], {
      cwd: CLONE_APP_DIR,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (d) => {
      const text = d.toString();
      stdout += text;
      if (text.trim()) console.log(`[Clone/npm] ${text.trim()}`);
    });

    child.stderr?.on('data', (d) => {
      const text = d.toString();
      stderr += text;
      if (text.trim()) console.warn(`[Clone/npm:err] ${text.trim()}`);
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || stdout || `npm install failed with exit code ${code}`));
    });
    child.on('error', reject);
  });
}

export async function ensureCloneServerRunning(overrides = {}) {
  const runtime = getCloneRuntimeConfig(overrides);
  const port = runtime.port;

  if (devServerProcess && !devServerProcess.killed && await isPortOpen(port, 1500)) {
    console.log(`[Clone] Dev server already running on port ${port}.`);
    return runtime;
  }

  if (await isPortOpen(port, 1500)) {
    const fallbackPort = await findAvailablePort(port + 1);
    if (fallbackPort !== port) {
      console.warn(`[Clone] Port ${port} is occupied; switching clone UI to ${fallbackPort}.`);
      return ensureCloneServerRunning({ ...overrides, port: fallbackPort });
    }
    throw new Error(`[Clone] Port ${port} is occupied by another process and no fallback port is available.`);
  }

  const nmPath = path.join(CLONE_APP_DIR, 'node_modules');
  if (!fs.existsSync(nmPath)) {
    await installCloneDependencies();
  }

  console.log(`[Clone] Starting Vite dev server in ${CLONE_APP_DIR} on port ${port} ...`);
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  devServerProcess = spawn(npmCommand, ['run', 'dev', '--', '--host', '0.0.0.0', '--port', String(port), '--strictPort'], {
    cwd: CLONE_APP_DIR,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  devServerProcess.stdout?.on('data', (d) => { const l = d.toString().trim(); if (l) console.log(`[Clone/vite] ${l}`); });
  devServerProcess.stderr?.on('data', (d) => { const l = d.toString().trim(); if (l) console.warn(`[Clone/vite:err] ${l}`); });
  devServerProcess.on('exit', (code) => {
    console.log(`[Clone] Dev server exited with code ${code}`);
    if (devServerProcess && devServerProcess.exitCode === code) devServerProcess = null;
  });

  console.log(`[Clone] Waiting for port ${port} to open (up to ${SERVER_START_TIMEOUT_MS / 1000}s)...`);
  const ready = await waitForPort(port, SERVER_START_TIMEOUT_MS);
  if (!ready) {
    devServerProcess = null;
    throw new Error(`[Clone] Dev server did not start within ${SERVER_START_TIMEOUT_MS / 1000}s.`);
  }

  console.log(`[Clone] Dev server ready on ${runtime.url}`);
  return runtime;
}

export function stopCloneServer() {
  if (!devServerProcess || devServerProcess.killed) {
    devServerProcess = null;
    return;
  }

  console.log(`[Clone] Stopping dev server (PID ${devServerProcess.pid})...`);
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(devServerProcess.pid), '/t', '/f'], { stdio: 'ignore' });
    } else {
      try {
        process.kill(-devServerProcess.pid, 'SIGTERM');
      } catch {
        devServerProcess.kill('SIGTERM');
      }
    }
  } catch (err) {
    console.warn(`[Clone] Shutdown warning: ${err.message}`);
  }
  devServerProcess = null;
}

export async function screenshotSiteDetailView(cloneId, outPath, siteData = null, runtime = getCloneRuntimeConfig()) {
  const url = `${runtime.url}/?site=${encodeURIComponent(cloneId)}`;
  console.log(`[Clone] Screenshotting ${url} -> ${path.basename(outPath)}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument((data) => {
      window.__ORB_DATA__ = data;
    }, siteData ? { ...siteData, cloneId } : null);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    try {
      await page.waitForSelector('#client-detail-view', { timeout: 5000 });
    } catch {
      await new Promise((r) => setTimeout(r, 2500));
    }
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: outPath, type: 'png', fullPage: false });
    console.log(`[Clone] Screenshot saved: ${path.basename(outPath)}`);
    return outPath;
  } finally {
    await browser.close();
  }
}

export async function getCloneScreenshot(cloneId, siteName, siteData = null, runtime = null) {
  if (!cloneId) {
    throw new Error(`[Clone] No real Orb interface mapping exists for site "${siteName}".`);
  }

  const activeRuntime = runtime || await ensureCloneServerRunning();
  const safeName = (siteName || cloneId).replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const outPath = path.resolve(os.tmpdir(), `orb_clone_${safeName}_${Date.now()}.png`);
  try {
    return await screenshotSiteDetailView(cloneId, outPath, siteData, activeRuntime);
  } catch (err) {
    console.error(`[Clone] Screenshot failed for "${siteName}": ${err.message}`);
    throw err;
  }
}
