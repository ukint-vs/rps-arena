import { GearApi } from "@gear-js/api";

let cachedApi: GearApi | null = null;
let cachedEndpoint: string | null = null;

export async function getApi(endpoint: string): Promise<GearApi> {
  if (cachedApi && cachedEndpoint === endpoint) return cachedApi;

  // Disconnect old connection if switching endpoints
  if (cachedApi) {
    try {
      await cachedApi.disconnect();
    } catch {}
  }

  cachedApi = await GearApi.create({ providerAddress: endpoint });
  cachedEndpoint = endpoint;
  return cachedApi;
}

export function resetApi(): void {
  if (cachedApi) {
    try {
      cachedApi.disconnect();
    } catch {}
  }
  cachedApi = null;
  cachedEndpoint = null;
}
