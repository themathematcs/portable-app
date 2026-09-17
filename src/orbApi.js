/**
 * Local Orb telemetry entry point — src/orbApi.js
 *
 * Reports only the genuine Orb sensor installed on this machine.
 */
import { getLocalOrbTelemetry } from './orbLocal.js';

/**
 * Reads live telemetry from the Orb sensor installed on this machine.
 *
 * @param {object} config System configuration
 * @returns {Promise<Array<object>>} List of real, non-synthetic site objects
 */
export async function getAllSitesTelemetry(config) {
  return getLocalOrbTelemetry();
}
