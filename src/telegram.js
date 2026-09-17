import fs from 'node:fs';
import axios from 'axios';
import FormData from 'form-data';

/**
 * Delays execution for a specified duration.
 * @param {number} ms 
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends a photo with caption to a Telegram chat using Telegram Bot API (`sendPhoto`).
 * Incorporates exponential backoff retries to withstand intermittent network drops.
 * 
 * @param {object} params
 * @param {string} params.botToken Telegram Bot Token
 * @param {string} params.chatId Target Telegram Chat ID or Channel Username
 * @param {string} params.imagePath Absolute or relative path to the image file
 * @param {string} params.caption Formatted caption string
 * @param {number} [params.timeoutMs=30000] HTTP request timeout in ms
 * @param {number} [params.maxRetries=3] Number of retry attempts
 * @returns {Promise<object>} Telegram API response data
 */
export async function sendTelegramReport({
  botToken,
  chatId,
  imagePath,
  caption,
  timeoutMs = 30000,
  maxRetries = 3
}) {
  if (!botToken || !chatId) {
    throw new Error('Telegram botToken and chatId are required.');
  }

  if (imagePath && !fs.existsSync(imagePath)) {
    throw new Error(`Cannot send Telegram photo: Image file not found at ${imagePath}`);
  }

  const endpoint = `https://api.telegram.org/bot${botToken}/${imagePath ? 'sendPhoto' : 'sendMessage'}`;

  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    attempt++;
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('parse_mode', 'Markdown');
    if (imagePath) {
      form.append('caption', caption);
      form.append('photo', fs.createReadStream(imagePath));
    } else {
      form.append('text', caption);
    }

    try {
      console.log(`[Telegram] Sending report to chat ${chatId} (Attempt ${attempt}/${maxRetries})...`);

      const response = await axios.post(endpoint, form, {
        headers: form.getHeaders(),
        timeout: timeoutMs,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: (status) => status === 200
      });

      if (response.data && response.data.ok) {
        console.log(`[Telegram] Report successfully dispatched. Message ID: ${response.data.result?.message_id}`);
        return response.data;
      } else {
        throw new Error(`Telegram API responded ok=false: ${JSON.stringify(response.data)}`);
      }
    } catch (err) {
      lastError = err;
      const errorMsg = err.response?.data?.description || err.message;
      const status = err.response?.status;

      console.warn(`[Telegram] Dispatch attempt ${attempt} failed: ${errorMsg} (HTTP ${status || 'N/A'})`);

      // If client error (400 Bad Request, 401 Unauthorized, 404 Not Found), retrying usually won't help
      if (status && status >= 400 && status < 500 && status !== 429) {
        console.error(`[Telegram] Client error detected (${status}). Halting retries.`);
        break;
      }

      if (attempt < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s...
        const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
        console.log(`[Telegram] Waiting ${backoffMs / 1000}s before next attempt...`);
        await sleep(backoffMs);
      }
    }
  }

  throw new Error(`Telegram dispatch failed after ${attempt} attempt(s). Root cause: ${lastError?.message || 'Unknown error'}`);
}
