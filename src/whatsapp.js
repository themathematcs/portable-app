import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalizes phone numbers / WhatsApp JIDs.
 */
export function normalizeJid(raw) {
  let cleaned = (raw || '').trim();
  if (!cleaned) return '';

  if (cleaned.includes('@')) {
    return cleaned;
  }

  cleaned = cleaned.replace(/[^\d]/g, '');
  return `${cleaned}@s.whatsapp.net`;
}

/**
 * Strips formatting to get pure numeric country code + phone number for pairing code.
 */
export function cleanPhoneNumber(raw) {
  return (raw || '').replace(/[^\d]/g, '');
}

/**
 * Saves and updates a visual HTML/PNG QR code preview file for easy scanning.
 */
async function saveVisualQrFiles(qrString, projectDir = process.cwd()) {
  const pngPath = path.resolve(projectDir, 'qr.png');
  const htmlPath = path.resolve(projectDir, 'qr.html');

  try {
    await QRCode.toFile(pngPath, qrString, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' }
    });

    const dataUrl = await QRCode.toDataURL(qrString, { width: 360, margin: 2 });
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WhatsApp Link QR Code</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0; background: #f0f2f5; color: #111b21;
    }
    .card {
      background: #ffffff; padding: 30px; border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); text-align: center; max-width: 420px;
    }
    h2 { margin-top: 0; color: #008069; }
    img { border-radius: 8px; border: 1px solid #e9edef; }
    p { font-size: 14px; color: #54656f; line-height: 1.5; }
    .footer { font-size: 12px; color: #8696a0; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>WhatsApp Device Link</h2>
    <p>Open WhatsApp on your phone or emulator:<br><b>Settings / Menu &rarr; Linked Devices &rarr; Link a Device</b></p>
    <img src="${dataUrl}" alt="WhatsApp QR Code" />
    <p class="footer">QR code refreshes automatically.<br>File: qr.html</p>
  </div>
</body>
</html>`;
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');
    return { pngPath, htmlPath };
  } catch (err) {
    console.warn(`[WhatsApp] Could not write visual QR files: ${err.message}`);
    return null;
  }
}

/**
 * Purges temporary QR artifacts after successful login.
 */
function cleanupVisualQrFiles(projectDir = process.cwd()) {
  const pngPath = path.resolve(projectDir, 'qr.png');
  const htmlPath = path.resolve(projectDir, 'qr.html');

  if (fs.existsSync(pngPath)) {
    try { fs.unlinkSync(pngPath); } catch (_) {}
  }
  if (fs.existsSync(htmlPath)) {
    try { fs.unlinkSync(htmlPath); } catch (_) {}
  }
}

/**
 * Dispatches the screenshot report via WhatsApp using Baileys.
 */
export async function sendWhatsAppReport({
  recipientJid,
  imagePath,
  caption,
  authFolder = './auth_info',
  connectionTimeoutMs = 60000
}) {
  const targetJid = normalizeJid(recipientJid);
  if (!targetJid) {
    throw new Error('WhatsApp recipientJid is required.');
  }

  if (imagePath && !fs.existsSync(imagePath)) {
    throw new Error(`Cannot send WhatsApp photo: Image file not found at ${imagePath}`);
  }

  const resolvedAuthDir = path.resolve(authFolder);
  if (!fs.existsSync(resolvedAuthDir)) {
    fs.mkdirSync(resolvedAuthDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(resolvedAuthDir);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));
  const logger = pino({ level: 'silent' });

  return new Promise((resolve, reject) => {
    let hasResolved = false;
    let sock = null;

    const timeoutHandle = setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        cleanupSocket(sock);
        reject(new Error(`[WhatsApp] Connection timed out after ${connectionTimeoutMs / 1000}s.`));
      }
    }, connectionTimeoutMs);

    const cleanupSocket = (s) => {
      clearTimeout(timeoutHandle);
      if (s) {
        try {
          s.ev.removeAllListeners('connection.update');
          s.ev.removeAllListeners('creds.update');
          s.end();
        } catch (_) {}
      }
    };

    function startSocket() {
      console.log(`[WhatsApp] Connecting to WhatsApp servers...`);

      const sockFactory = makeWASocket.default || makeWASocket;
      sock = sockFactory({
        version,
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        connectTimeoutMs: connectionTimeoutMs,
        defaultQueryTimeoutMs: connectionTimeoutMs
      });

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log('\n[WhatsApp] Session not yet authenticated. QR received.');
          await saveVisualQrFiles(qr);
          qrcodeTerminal.generate(qr, { small: true });
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          console.warn(`[WhatsApp] Connection closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`);

          if (statusCode === DisconnectReason.loggedOut) {
            if (!hasResolved) {
              hasResolved = true;
              cleanupSocket(sock);
              reject(new Error('WhatsApp session logged out by device. Please run `npm run auth-wa` or `node agent.js --phone <number>` to re-pair.'));
            }
          } else if (shouldReconnect && !hasResolved) {
            // Reconnect on transient disconnect or 515 restartRequired
            setTimeout(startSocket, 2000);
          } else if (!hasResolved) {
            hasResolved = true;
            cleanupSocket(sock);
            reject(new Error(`WhatsApp connection closed before message dispatch (code: ${statusCode || 'unknown'}).`));
          }
        } else if (connection === 'open') {
          console.log('[WhatsApp] Connection open. Dispatching report payload...');
          cleanupVisualQrFiles();

          try {
            const result = imagePath
              ? await sock.sendMessage(targetJid, {
                image: fs.readFileSync(imagePath),
                caption
              })
              : await sock.sendMessage(targetJid, { text: caption });

            console.log(`[WhatsApp] Report successfully dispatched to ${targetJid}.`);
            await sleep(2500);

            if (!hasResolved) {
              hasResolved = true;
              cleanupSocket(sock);
              resolve(result);
            }
          } catch (sendErr) {
            if (!hasResolved) {
              hasResolved = true;
              cleanupSocket(sock);
              reject(new Error(`Failed to send WhatsApp message: ${sendErr.message}`));
            }
          }
        }
      });
    }

    startSocket();
  });
}

/**
 * Interactive pairing utility that provides TWO pairing mechanisms:
 * 1. 8-Character Pairing Code (Ideal for MEmu Play & emulators - NO camera needed)
 * 2. Visual QR code (saved as qr.png and qr.html with automatic browser opening)
 * 
 * Crucially handles WhatsApp's 515 (Restart Required) handshake event so the phone
 * never gets stuck on "Logging in...".
 */
export async function pairWhatsAppInteractive({
  authFolder = './auth_info',
  phoneNumber = '',
  forceReset = false,
  openBrowser = false,
  onProgress = null
} = {}) {
  const resolvedAuthDir = path.resolve(authFolder);

  if (forceReset && fs.existsSync(resolvedAuthDir)) {
    console.log(`[WhatsApp Reset] Purging previous session at: ${resolvedAuthDir}`);
    fs.rmSync(resolvedAuthDir, { recursive: true, force: true });
  }

  if (!fs.existsSync(resolvedAuthDir)) {
    fs.mkdirSync(resolvedAuthDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(resolvedAuthDir);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));
  const logger = pino({ level: 'silent' });

  return new Promise((resolve, reject) => {
    let hasResolved = false;
    let currentSock = null;
    let pairingCodeRequested = false;

    // Heartbeat timer to guarantee Node's event loop stays alive
    const keepAliveTimer = setInterval(() => {}, 5000);

    const finish = (err = null) => {
      if (hasResolved) return;
      hasResolved = true;
      clearInterval(keepAliveTimer);
      if (currentSock) {
        try {
          currentSock.ev.removeAllListeners('connection.update');
          currentSock.ev.removeAllListeners('creds.update');
          currentSock.end();
        } catch (_) {}
      }
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    };

    console.log(`\n=============================================================`);
    console.log(`               WHATSAPP PAIRING SETUP MODE`);
    console.log(` Session Directory: ${resolvedAuthDir}`);
    console.log(` WhatsApp Protocol: Ubuntu / Chrome`);
    console.log(`=============================================================\n`);

    function connect() {
      if (hasResolved) return;

      const sockFactory = makeWASocket.default || makeWASocket;
      currentSock = sockFactory({
        version,
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000
      });

      currentSock.ev.on('creds.update', saveCreds);

      currentSock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // METHOD A: 8-Character Pairing Code
        const sanitizedPhone = cleanPhoneNumber(phoneNumber);
        if (sanitizedPhone && !state.creds.registered && !pairingCodeRequested) {
          pairingCodeRequested = true;
          try {
            console.log(`[WhatsApp Pairing] Requesting 8-character pairing code for: +${sanitizedPhone}...`);
            await sleep(2500);
            const code = await currentSock.requestPairingCode(sanitizedPhone);

            console.log(`\n=============================================================`);
            console.log(`🔑 YOUR WHATSAPP PAIRING CODE:`);
            console.log(`\n       >>>   ${code}   <<<\n`);
            console.log(`HOW TO LINK ON MEMU PLAY (NO CAMERA NEEDED):`);
            console.log(`1. Open WhatsApp -> Three dots (Menu) -> Linked Devices`);
            console.log(`2. Tap 'Link a Device'`);
            console.log(`3. At the bottom of the QR scanner, tap:`);
            console.log(`   'Link with phone number instead'`);
            console.log(`4. Enter the 8-character code: ${code}`);
            console.log(`\n[Status] Waiting for you to enter the code...`);
            console.log(`=============================================================\n`);
            if (onProgress) {
              onProgress({ type: 'pairingCode', code });
            }
          } catch (codeErr) {
            console.error(`[WhatsApp Pairing Code Error] ${codeErr.message}`);
            console.log(`[WhatsApp] Falling back to visual QR mode...`);
          }
        }

        // METHOD B: Visual QR Code
        if (qr && !sanitizedPhone) {
          console.log('\n[WhatsApp] Generating visual QR code...');
          const paths = await saveVisualQrFiles(qr);

          if (paths) {
            console.log(`\n=============================================================`);
            console.log(`📸 CLEAN QR SAVED:`);
            console.log(`   - Image File: ${paths.pngPath}`);
            console.log(`   - HTML Page : ${paths.htmlPath}`);
            console.log(`=============================================================`);

            if (onProgress) {
              try {
                const qrDataUrl = await QRCode.toDataURL(qr, { width: 360, margin: 2 });
                onProgress({ type: 'qr', qrDataUrl, pngPath: paths.pngPath, htmlPath: paths.htmlPath });
              } catch (_) {}
            }

            if (openBrowser) {
              try {
                if (process.platform === 'win32') {
                  exec(`start "" "${paths.htmlPath}"`);
                } else if (process.platform === 'darwin') {
                  exec(`open "${paths.htmlPath}"`);
                } else {
                  exec(`xdg-open "${paths.htmlPath}"`);
                }
                openBrowser = false;
              } catch (_) {}
            }
          }

          console.log('\n[Terminal ASCII Preview]:');
          qrcodeTerminal.generate(qr, { small: true });
          console.log('\n[Tip] View qr.png or qr.html for a perfectly proportioned QR code.\n');
        }

        // Connection Lifecycle
        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(`[WhatsApp Event] Connection closed (code: ${statusCode || 'unknown'}).`);

          if (statusCode === DisconnectReason.loggedOut) {
            console.error('[WhatsApp] Device logged out. Please remove auth_info and re-authenticate.');
            finish(new Error('Device logged out.'));
            return;
          }

          // Crucial: When you enter the pairing code, WhatsApp issues a 515 restartRequired
          // We MUST reconnect immediately so the login handshake completes!
          if (shouldReconnect && !hasResolved) {
            console.log(`[WhatsApp] Reconnecting session to complete authentication handshake...`);
            setTimeout(connect, 1500);
          } else if (!hasResolved) {
            finish(new Error(`Connection closed unexpectedly with status ${statusCode}.`));
          }
        } else if (connection === 'open') {
          console.log(`\n=============================================================`);
          console.log(`✅ WHATSAPP AUTHENTICATION SUCCESSFUL!`);
          console.log(`Credentials saved permanently to: ${resolvedAuthDir}`);
          console.log(`Device is now paired and ready for automated reporting.`);
          console.log(`=============================================================\n`);
          if (onProgress) {
            onProgress({ type: 'connected' });
          }
          cleanupVisualQrFiles();
          
          setTimeout(() => {
            finish();
          }, 2000);
        }
      });
    }

    connect();
  });
}

/**
 * Connects to WhatsApp using saved auth_info and lists all participating groups
 * with their Group JIDs (ending in @g.us) for targeted reporting.
 * 
 * @param {string} [authFolder='./auth_info']
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function listWhatsAppGroups(authFolder = './auth_info') {
  const resolvedAuthDir = path.resolve(authFolder);
  if (!fs.existsSync(resolvedAuthDir)) {
    throw new Error(`Auth folder not found at ${resolvedAuthDir}. Run 'node agent.js --phone <number>' first.`);
  }

  const { state } = await useMultiFileAuthState(resolvedAuthDir);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));
  const logger = pino({ level: 'silent' });

  return new Promise((resolve, reject) => {
    let currentSock = null;
    const timeoutHandle = setTimeout(() => {
      if (currentSock) currentSock.end();
      reject(new Error('Timed out fetching WhatsApp groups.'));
    }, 30000);

    const sockFactory = makeWASocket.default || makeWASocket;
    currentSock = sockFactory({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome')
    });

    currentSock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        try {
          console.log('[WhatsApp] Connected. Fetching groups...');
          const groups = await currentSock.groupFetchAllParticipating();
          const list = [];
          for (const [id, meta] of Object.entries(groups)) {
            list.push({ id, name: meta.subject || 'Unnamed Group' });
          }
          clearTimeout(timeoutHandle);
          currentSock.end();
          resolve(list);
        } catch (err) {
          clearTimeout(timeoutHandle);
          currentSock.end();
          reject(err);
        }
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        if (statusCode === DisconnectReason.loggedOut) {
          clearTimeout(timeoutHandle);
          currentSock.end();
          reject(new Error('Session logged out.'));
        }
      }
    });
  });
}

