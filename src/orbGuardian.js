import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ORB_APP_SHELL_IDS = [
  'shell:AppsFolder\\Orb_rwe8ryttnqs9e!ORB',
  'Orb',
  'Orb.exe'
];

const ORB_EXECUTABLE_CANDIDATES = [
  'C:/Program Files/Orb/Orb.exe',
  'C:/Program Files (x86)/Orb/Orb.exe',
  'C:/Program Files/Orb App/Orb.exe',
  'C:/Program Files (x86)/Orb App/Orb.exe',
  'C:/ProgramData/Orb/Orb.exe',
  'C:/Users/Orb/Orb.exe'
];

const ORB_SEARCH_ROOTS = () => {
  const roots = [];
  if (process.env.ProgramFiles) roots.push(process.env.ProgramFiles);
  if (process.env['ProgramFiles(x86)']) roots.push(process.env['ProgramFiles(x86)']);
  if (process.env.ProgramData) roots.push(process.env.ProgramData);
  if (process.env.USERPROFILE) roots.push(process.env.USERPROFILE);
  if (process.env.LOCALAPPDATA) roots.push(process.env.LOCALAPPDATA);
  if (process.env.PUBLIC) roots.push(process.env.PUBLIC);
  return [...new Set(roots.filter(Boolean))];
};

export async function discoverOrbExecutable() {
  const searchedPaths = [...new Set([...ORB_EXECUTABLE_CANDIDATES, ...ORB_SEARCH_ROOTS()])];
  const result = {
    found: false,
    executablePath: null,
    searchedPaths: [],
    appIds: [...ORB_APP_SHELL_IDS],
    error: null
  };

  const script = [
    "$orbAppIds = @('shell:AppsFolder\\Orb_rwe8ryttnqs9e!ORB','Orb','Orb.exe');",
    "$orbPaths = @('C:/Program Files/Orb/Orb.exe','C:/Program Files (x86)/Orb/Orb.exe','C:/Program Files/Orb App/Orb.exe','C:/Program Files (x86)/Orb App/Orb.exe','C:/ProgramData/Orb/Orb.exe');",
    "$roots = @();",
    "if ($env:ProgramFiles) { $roots += $env:ProgramFiles }",
    "if (${env:ProgramFiles(x86)}) { $roots += ${env:ProgramFiles(x86)} }",
    "if ($env:ProgramData) { $roots += $env:ProgramData }",
    "if ($env:USERPROFILE) { $roots += $env:USERPROFILE }",
    "if ($env:LOCALAPPDATA) { $roots += $env:LOCALAPPDATA }",
    "if ($env:PUBLIC) { $roots += $env:PUBLIC }",
    "foreach ($id in $orbAppIds) {",
    "  try {",
    "    $cmd = Get-Command $id -ErrorAction Stop;",
    "    if ($cmd -and $cmd.Source) {",
    "      Write-Output \"FOUND:$($cmd.Source)\";",
    "      return;",
    "    }",
    "  } catch {}",
    "}",
    "foreach ($p in $orbPaths) {",
    "  if (Test-Path $p) {",
    "    Write-Output \"FOUND:$p\";",
    "    return;",
    "  }",
    "}",
    "foreach ($root in $roots) {",
    "  if ($root -and (Test-Path $root)) {",
    "    foreach ($candidate in (Get-ChildItem -Path $root -Filter 'Orb.exe' -Recurse -ErrorAction SilentlyContinue -File | Select-Object -ExpandProperty FullName)) {",
    "      Write-Output \"SEARCHED:$candidate\";",
    "    }",
    "  }",
    "}",
    "Write-Output 'NOT_FOUND'"
  ].join(' ');

  try {
    const { stdout } = await execAsync(`powershell -NoProfile -Command "${script.replace(/\r?\n/g, ' ')}"`);
    const lines = (stdout || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    for (const line of lines) {
      if (line.startsWith('FOUND:')) {
        result.found = true;
        result.executablePath = line.replace('FOUND:', '').trim();
        break;
      }
      if (line.startsWith('SEARCHED:')) {
        result.searchedPaths.push(line.replace('SEARCHED:', '').trim());
      }
    }

    if (!result.found) {
      result.error = `Orb executable was not found. Checked standard install folders and app IDs.`;
      const uniqueSearches = [...new Set([
        ...searchedPaths,
        ...result.searchedPaths,
        ...result.appIds
      ])];
      result.searchedPaths = uniqueSearches.filter(Boolean);
    }
  } catch (error) {
    result.error = `Orb detection failed: ${error.message}`;
    result.searchedPaths = [...new Set(searchedPaths)];
  }

  if (result.found && !result.executablePath) {
    result.executablePath = result.searchedPaths.find((value) => value.toLowerCase().endsWith('orb.exe')) || null;
  }

  return result;
}

/**
 * Checks if the Orb process is currently running on the system.
 * 
 * @returns {Promise<{isRunning: boolean, pid: number|null, memoryMb: number|null}>}
 */
export async function checkOrbStatus() {
  try {
    const cmd = `powershell -NoProfile -Command "Get-Process -Name Orb -ErrorAction SilentlyContinue | Select-Object -First 1 Id, WorkingSet64 | ConvertTo-Json"`;
    const { stdout } = await execAsync(cmd);
    if (stdout && stdout.trim().startsWith('{')) {
      const parsed = JSON.parse(stdout);
      const memMb = parsed.WorkingSet64 ? Math.round(parsed.WorkingSet64 / (1024 * 1024)) : null;
      return {
        isRunning: true,
        pid: parsed.Id,
        memoryMb: memMb
      };
    }
  } catch (_) {}

  return {
    isRunning: false,
    pid: null,
    memoryMb: null
  };
}

/**
 * Ensures the Orb application is running. If offline, automatically launches it
 * and waits up to maxWaitMs for the process to register.
 * 
 * @param {object} [options={}]
 * @param {boolean} [options.autoLaunch=true] Whether to auto-start if not running
 * @param {number} [options.maxWaitMs=8000] Maximum milliseconds to wait for launch
 * @returns {Promise<{isRunning: boolean, pid: number|null, autoStarted: boolean, error: string|null}>}
 */
export async function ensureOrbRunning({ autoLaunch = true, maxWaitMs = 8000 } = {}) {
  let status = await checkOrbStatus();
  if (status.isRunning) {
    return {
      isRunning: true,
      pid: status.pid,
      memoryMb: status.memoryMb,
      autoStarted: false,
      error: null
    };
  }

  const discovery = await discoverOrbExecutable();

  if (!autoLaunch) {
    return {
      isRunning: false,
      pid: null,
      autoStarted: false,
      error: discovery.error || 'Orb process is not running (auto-launch disabled).',
      searchedPaths: discovery.searchedPaths,
      executablePath: discovery.executablePath,
      appIds: discovery.appIds
    };
  }

  if (!discovery.found || !discovery.executablePath) {
    const noLaunchMessage = discovery.error || 'Orb installation path or app identifier could not be found on this machine.';
    console.error(`[Orb Guardian] ${noLaunchMessage}`);
    return {
      isRunning: false,
      pid: null,
      autoStarted: false,
      error: noLaunchMessage,
      searchedPaths: discovery.searchedPaths,
      executablePath: discovery.executablePath,
      appIds: discovery.appIds
    };
  }

  console.log(`[Orb Guardian] ⚠️ Orb process is NOT running. Initiating auto-launch using ${discovery.executablePath}...`);

  try {
    const launchCmd = `powershell -NoProfile -Command "Start-Process '${discovery.executablePath.replace(/'/g, "''")}' -ErrorAction Stop; Write-Output 'LAUNCHED:${discovery.executablePath}'"`;
    const { stdout } = await execAsync(launchCmd);
    if (stdout && stdout.includes('LAUNCHED:')) {
      console.log(`[Orb Guardian] ${stdout.trim()}`);
    }
  } catch (launchErr) {
    console.error(`[Orb Guardian] Failed to launch Orb: ${launchErr.message}`);
    return {
      isRunning: false,
      pid: null,
      autoStarted: true,
      error: `Auto-launch command failed: ${launchErr.message}`,
      searchedPaths: discovery.searchedPaths,
      executablePath: discovery.executablePath,
      appIds: discovery.appIds
    };
  }

  // Poll for process spin-up
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    await sleep(1000);
    status = await checkOrbStatus();
    if (status.isRunning) {
      console.log(`[Orb Guardian] ✅ Orb successfully launched (PID: ${status.pid}, Memory: ${status.memoryMb}MB).`);
      return {
        isRunning: true,
        pid: status.pid,
        memoryMb: status.memoryMb,
        autoStarted: true,
        error: null
      };
    }
  }

  return {
    isRunning: false,
    pid: null,
    autoStarted: true,
    error: `Orb auto-launch initiated but process did not register within ${maxWaitMs / 1000}s.`
  };
}

/**
 * Attempts to bring the Orb window to the foreground and restore it if minimized.
 * Allows DWM to render before screen capture is taken.
 * 
 * @returns {Promise<boolean>}
 */
export async function focusOrbWindow() {
  if (process.platform !== 'win32') return false;

  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinUtil {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@ -ErrorAction SilentlyContinue

$p = Get-Process -Name Orb -ErrorAction SilentlyContinue | Select-Object -First 1
if ($p -and $p.MainWindowHandle -ne 0) {
    [WinUtil]::ShowWindow($p.MainWindowHandle, 9) | Out-Null # 9 = SW_RESTORE
    [WinUtil]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
    Write-Output "FOCUSED"
} else {
    Write-Output "NOT_FOUND"
}
`;

  try {
    const { stdout } = await execAsync(`powershell -NoProfile -Command "${script.replace(/\r?\n/g, ' ')}"`);
    return stdout.includes('FOCUSED');
  } catch (_) {
    return false;
  }
}

/**
 * Generates an emergency alert message when Orb cannot be started.
 * 
 * @param {object} config 
 * @param {string} errorDetails 
 * @returns {string}
 */
export function formatOrbOfflineAlert(config, errorDetails = '') {
  const siteName = config.site?.name || 'Remote Site';
  const isp = config.site?.isp || 'Unknown ISP';
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  return [
    `🚨 *CRITICAL SITE ALERT – ORB APPLICATION OFFLINE*`,
    `📅 Time: ${now}`,
    `📍 Site: ${siteName}`,
    `🌐 ISP: ${isp}`,
    ``,
    `🔴 *Status: Orb App is NOT running on site computer!*`,
    `⚠️ Auto-Recovery: Failed to start Orb process automatically.`,
    errorDetails ? `📝 Details: ${errorDetails}` : ``,
    ``,
    `🛠️ *Action Required:*`,
    `Please dispatch or contact the on-site technician to inspect the host computer.`
  ].filter(Boolean).join('\n');
}
