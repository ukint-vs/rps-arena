import { encodeAddress, decodeAddress } from "@polkadot/util-crypto";

const APP_NAME = "RPS Arena";
const VARA_SS58 = 137;

type InjectedAccount = {
  address: string;
  name?: string;
  type?: string;
};

type Injected = {
  accounts: { get: () => Promise<InjectedAccount[]> };
  signer?: unknown;
};

type InjectedProvider = {
  enable?: (origin: string) => Promise<Injected>;
  connect?: (origin: string) => Promise<Injected>;
};

declare global {
  interface Window {
    injectedWeb3?: Record<string, InjectedProvider>;
  }
}

export type WalletAccount = {
  address: string;
  name?: string;
  source: string;
};

export function toVara(addr: string): string {
  try {
    return encodeAddress(decodeAddress(addr), VARA_SS58);
  } catch {
    return addr;
  }
}

export async function listWallets(): Promise<string[]> {
  for (let i = 0; i < 15; i++) {
    const sources = Object.entries(window.injectedWeb3 ?? {})
      .filter(([, p]) => p.enable || p.connect)
      .map(([s]) => s);
    if (sources.length > 0) return sources;
    await new Promise((r) => setTimeout(r, 200));
  }
  return [];
}

export async function enableWallet(
  source: string
): Promise<{ accounts: WalletAccount[]; signer: unknown }> {
  const provider = window.injectedWeb3?.[source];
  if (!provider) throw new Error(`Wallet "${source}" not found`);

  const injected = provider.enable
    ? await provider.enable(APP_NAME)
    : await provider.connect!(APP_NAME);

  const accounts = (await injected.accounts.get()).map((a) => ({
    address: toVara(a.address),
    name: a.name,
    source,
  }));

  return { accounts, signer: injected.signer };
}
