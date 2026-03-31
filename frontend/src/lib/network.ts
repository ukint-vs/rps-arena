export type NetworkId = "mainnet" | "testnet" | "custom";

export interface NetworkConfig {
  id: NetworkId;
  label: string;
  endpoint: string;
  programId: `0x${string}`;
}

export const NETWORKS: Record<"mainnet" | "testnet", NetworkConfig> = {
  mainnet: {
    id: "mainnet",
    label: "Mainnet",
    endpoint: "wss://rpc.vara.network",
    programId:
      "0x1de134d3723429b48552e5dc83264ca9124ca1ea99a781de41d6311abff43cfa",
  },
  testnet: {
    id: "testnet",
    label: "Testnet",
    endpoint: "wss://testnet.vara.network",
    programId:
      "0x02e1e2f34411eca5da56425b88b82d9825052beb53adda07ba0e23662ab79495",
  },
};

const STORAGE_KEY = "rps.network";

interface StoredNetwork {
  id: NetworkId;
  customEndpoint?: string;
  customProgramId?: string;
}

export function loadNetwork(): NetworkConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored: StoredNetwork = JSON.parse(raw);
      if (stored.id === "mainnet" || stored.id === "testnet") {
        return NETWORKS[stored.id];
      }
      if (
        stored.id === "custom" &&
        stored.customEndpoint &&
        stored.customProgramId &&
        /^0x[0-9a-fA-F]{64}$/.test(stored.customProgramId)
      ) {
        return {
          id: "custom",
          label: "Custom",
          endpoint: stored.customEndpoint,
          programId: stored.customProgramId as `0x${string}`,
        };
      }
    }
  } catch {}

  // Fallback: match env vars to a preset, or use them as custom
  const envEndpoint = import.meta.env.VITE_NODE_ENDPOINT;
  const envPid = import.meta.env.VITE_PROGRAM_ID;

  if (envEndpoint && envPid) {
    for (const net of Object.values(NETWORKS)) {
      if (net.endpoint === envEndpoint && net.programId === envPid) {
        return net;
      }
    }
    return {
      id: "custom",
      label: "Custom",
      endpoint: envEndpoint,
      programId: envPid as `0x${string}`,
    };
  }

  return NETWORKS.mainnet;
}

export function saveNetwork(config: NetworkConfig): void {
  const stored: StoredNetwork = { id: config.id };
  if (config.id === "custom") {
    stored.customEndpoint = config.endpoint;
    stored.customProgramId = config.programId;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}
