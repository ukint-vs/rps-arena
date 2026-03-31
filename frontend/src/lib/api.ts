import { GearApi } from "@gear-js/api";

let cachedApi: GearApi | null = null;
let cachedEndpoint: string | null = null;

export async function getApi(): Promise<GearApi> {
  const endpoint = import.meta.env.VITE_NODE_ENDPOINT;
  if (cachedApi && cachedEndpoint === endpoint) return cachedApi;

  cachedApi = await GearApi.create({ providerAddress: endpoint });
  cachedEndpoint = endpoint;
  return cachedApi;
}

export const PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID as `0x${string}`;
