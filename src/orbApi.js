/**
 * Local Orb telemetry entry point — src/orbApi.js
 *
 * Reports only the genuine Orb sensor installed on this machine.
 */
import { ensureOrbRunning } from './orbGuardian.js';
import { getLocalOrbTelemetry } from './orbLocal.js';
import { getOrbCloudTelemetry } from './orbCloud.js';

/**
 * Reads live telemetry from the Orb sensor installed on this machine.
 *
 * @param {object} config System configuration
 * @returns {Promise<Array<object>>} List of real, non-synthetic site objects
 */
export async function getAllSitesTelemetry(config) {
  const apiToken = config?.orb?.apiToken;

  if (apiToken) {
    try {
      const cloudSites = await getOrbCloudTelemetry(config);
      if (Array.isArray(cloudSites) && cloudSites.length > 0) {
        console.log(`[Orb API] Using Orb Cloud telemetry for ${cloudSites.length} site(s).`);
        return cloudSites;
      }
    } catch (cloudError) {
      console.warn(`[Orb API] Orb Cloud telemetry unavailable: ${cloudError.message}. Falling back to local Orb data.`);
    }
  }

  try {
    const orbStatus = await ensureOrbRunning({ autoLaunch: true, maxWaitMs: 15000 });
    if (!orbStatus.isRunning) {
      throw new Error(`Orb is not running, so a live report cannot be created. ${orbStatus.error || 'Install Orb or start it on this computer.'}`);
    }
    const localSites = await getLocalOrbTelemetry(config);
    if (Array.isArray(localSites) && localSites.length > 0) return localSites;
  } catch (localError) {
    console.warn(`[Orb Local] Local Orb telemetry unavailable: ${localError.message}`);
  }

  throw new Error('No valid Orb telemetry source is available. Check the Orb API token and/or the local Orb installation.');
}
