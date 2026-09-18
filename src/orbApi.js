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
  console.log('Full loaded config object:', JSON.stringify(config, null, 2));
  console.log('process.env.ORB_API_TOKEN exists:', !!process.env.ORB_API_TOKEN);
  console.log('config.orb?.apiToken exists:', !!config?.orb?.apiToken);
  console.log('config.apiKey exists:', !!config?.apiKey);

  const apiToken = config?.orb?.apiToken;
  const apiUrl = (config?.orb?.apiUrl || 'https://panel.orb.net').replace(/\/$/, '');

  console.log(`[Orb API Debug] Token detected: ${Boolean(apiToken)} | length=${apiToken?.length ?? 0} | source=${apiToken ? 'config.orb.apiToken' : 'missing'}`);
  console.log(`[Orb API Debug] Cloud endpoint target: ${apiUrl}/api/v2/organizations`);

  if (apiToken) {
    try {
      console.log('[Orb API Debug] Entering Orb Cloud request path.');
      const cloudSites = await getOrbCloudTelemetry(config);
      console.log(`[Orb API Debug] Cloud result type=${Array.isArray(cloudSites) ? 'array' : typeof cloudSites} | length=${Array.isArray(cloudSites) ? cloudSites.length : 'n/a'}`);
      if (Array.isArray(cloudSites) && cloudSites.length > 0) {
        console.log(`[Orb API] Using Orb Cloud telemetry for ${cloudSites.length} site(s).`);
        return cloudSites;
      }
      console.log('[Orb API Debug] Cloud call returned no usable sites. Falling back to local Orb telemetry.');
    } catch (cloudError) {
      console.warn(`[Orb API Debug] Cloud request failed with error: ${cloudError.message}`);
      console.warn('[Orb API Debug] Cloud fallback triggered to local Orb data.');
    }
  } else {
    console.warn('[Orb API Debug] No Orb API token is present, so cloud telemetry is disabled.');
  }

  try {
    const orbStatus = await ensureOrbRunning({ autoLaunch: true, maxWaitMs: 15000 });
    if (!orbStatus.isRunning) {
      throw new Error(`Orb is not running, so a live report cannot be created. ${orbStatus.error || 'Install Orb or start it on this computer.'}`);
    }
    const localSites = await getLocalOrbTelemetry(config);
    if (Array.isArray(localSites) && localSites.length > 0) return localSites;
  } catch (localError) {
    console.warn(`[Orb Local Debug] Local Orb fallback error: ${localError.message}`);
  }

  throw new Error('No valid Orb telemetry source is available. Check the Orb API token and/or the local Orb installation.');
}
