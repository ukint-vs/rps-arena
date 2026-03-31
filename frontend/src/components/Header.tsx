import type { WalletAccount } from "../lib/wallet";
import type { NetworkConfig } from "../lib/network";
import { NetworkSelector } from "./NetworkSelector";
import { CopyAddress } from "./CopyAddress";

type Props = {
  account: WalletAccount | null;
  balance: string | null;
  wallets: string[];
  apiStatus: "connecting" | "ready" | "error";
  activeNetwork: NetworkConfig;
  onNetworkSwitch: (config: NetworkConfig) => void;
  switchDisabled?: boolean;
  onConnect: (source: string) => void;
  onDisconnect: () => void;
};


export function Header({
  account,
  balance,
  wallets,
  apiStatus,
  activeNetwork,
  onNetworkSwitch,
  switchDisabled,
  onConnect,
  onDisconnect,
}: Props) {
  return (
    <header className="flex items-center justify-between px-4 lg:px-8 py-5 border-b border-gray-800/50">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🪨📄✂️</span>
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-emerald-500">RPS</span>{" "}
          <span className="text-gray-400">Arena</span>
        </h1>
        <span
          className={`ml-2 w-2 h-2 rounded-full ${
            apiStatus === "ready"
              ? "bg-emerald-500"
              : apiStatus === "connecting"
              ? "bg-yellow-500 animate-pulse"
              : "bg-red-500"
          }`}
        />
        <NetworkSelector
          activeNetwork={activeNetwork}
          onSwitch={onNetworkSwitch}
          disabled={switchDisabled}
        />
      </div>

      <div className="flex items-center gap-3">
        {account ? (
          <div className="flex items-center gap-3">
            {balance && (
              <span className="text-sm text-gray-400">{balance} VARA</span>
            )}
            <span className="text-sm bg-[#1a1a1a] px-3 py-1.5 rounded-md border border-gray-800">
              <CopyAddress address={account.address} />
            </span>
            <button
              onClick={onDisconnect}
              className="text-sm text-gray-500 hover:text-red-400 transition-colors"
            >
              ✕
            </button>
          </div>
        ) : wallets.length > 0 ? (
          <div className="flex gap-2">
            {wallets.slice(0, 3).map((w) => (
              <button
                key={w}
                onClick={() => onConnect(w)}
                className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 rounded-md font-medium transition-colors"
              >
                {w}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-sm text-gray-500">
            Install SubWallet or Polkadot.js
          </span>
        )}
      </div>
    </header>
  );
}
