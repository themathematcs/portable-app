import fs from 'node:fs';
import path from 'node:path';
import screenshot from 'screenshot-desktop';

/**
 * Captures the current desktop environment natively and saves it to a file.
 * Avoids any heavy headless browser runtime overhead (Puppeteer/Chromium).
 * 
 * @param {string} targetFilePath Destination path for the captured image (e.g. ./report_img.png)
 * @param {object} [options={}] Additional screenshot-desktop options (e.g. format)
 * @returns {Promise<string>} The absolute path to the captured screenshot
 */
export async function captureScreenToFile(targetFilePath, options = {}) {
  const absolutePath = path.resolve(targetFilePath);
  const targetDir = path.dirname(absolutePath);

  // Ensure target directory exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  try {
    const captureOpts = {
      filename: absolutePath,
      format: options.format || 'png'
    };
    if (options.screen !== undefined && options.screen !== null) {
      captureOpts.screen = options.screen;
    }

    const filename = await screenshot(captureOpts);
    
    // Verify that the file was created and has non-zero size
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Screenshot capture completed but file not found at: ${absolutePath}`);
    }

    const stats = fs.statSync(absolutePath);
    if (stats.size === 0) {
      throw new Error(`Screenshot captured an empty (0-byte) file at: ${absolutePath}`);
    }

    // Diagnostic: Check if image is suspiciously small (solid black frame usually < 45KB)
    if (stats.size < 45000) {
      console.warn(
        `[Capture Warning] Captured image size is unusually small (${Math.round(stats.size / 1024)}KB). ` +
        `If the image appears black, Windows display sleep/lock is active. ` +
        `Disable screen sleep via: 'powercfg /change monitor-timeout-ac 0'.`
      );
    }

    return absolutePath;
  } catch (err) {
    throw new Error(`Screen capture failed on host environment: ${err.message}`);
  }
}

/**
 * Lists all connected displays/monitors for targeted capture.
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function listScreens() {
  return screenshot.listDisplays();
}

/**
 * Captures screenshot directly as an in-memory Buffer.
 * Useful if direct streaming is preferred without writing to disk.
 * 
 * @param {string} [format='png'] Image format
 * @returns {Promise<Buffer>}
 */
export async function captureScreenToBuffer(format = 'png') {
  try {
    const imgBuffer = await screenshot({ format });
    if (!imgBuffer || imgBuffer.length === 0) {
      throw new Error('Screenshot returned an empty buffer');
    }
    return imgBuffer;
  } catch (err) {
    throw new Error(`Screen buffer capture failed: ${err.message}`);
  }
}

/**
 * Safely cleans up temporary image file from disk.
 * Will not throw if file is already gone or locked; logs any issues.
 * 
 * @param {string} filePath Path of the file to clean up
 * @returns {boolean} True if deleted, false if file did not exist
 */
export function cleanupTempFile(filePath) {
  if (!filePath) return false;

  try {
    const resolvedPath = path.resolve(filePath);
    if (fs.existsSync(resolvedPath)) {
      fs.unlinkSync(resolvedPath);
      return true;
    }
  } catch (err) {
    console.warn(`[Cleanup Warning] Could not remove temp file '${filePath}': ${err.message}`);
  }
  return false;
}
