import { useState, useRef, useEffect } from "react";
import {
  NETWORKS,
  type NetworkConfig,
  type NetworkId,
} from "../lib/network";

type Props = {
  activeNetwork: NetworkConfig;
  onSwitch: (config: NetworkConfig) => void;
  disabled?: boolean;
};

const DOT_COLORS: Record<NetworkId, string> = {
  mainnet: "bg-emerald-500",
  testnet: "bg-yellow-500",
  custom: "bg-purple-500",
};

function isValidProgramId(pid: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(pid);
}

export function NetworkSelector({ activeNetwork, onSwitch, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customPid, setCustomPid] = useState("");
  const [customEndpoint, setCustomEndpoint] = useState<"mainnet" | "testnet">(
    "testnet"
  );
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCustom(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectPreset = (id: "mainnet" | "testnet") => {
    onSwitch(NETWORKS[id]);
    setOpen(false);
    setShowCustom(false);
  };

  const connectCustom = () => {
    if (!isValidProgramId(customPid)) return;
    onSwitch({
      id: "custom",
      label: "Custom",
      endpoint: NETWORKS[customEndpoint].endpoint,
      programId: customPid as `0x${string}`,
    });
    setOpen(false);
    setShowCustom(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`flex items-center gap-2 text-sm bg-[#1a1a1a] px-3 py-1.5 rounded-md border border-gray-800 transition-colors ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:border-gray-600 cursor-pointer"
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${DOT_COLORS[activeNetwork.id]}`}
        />
        <span className="text-gray-300">{activeNetwork.label}</span>
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-[#141414] border border-gray-800 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Mainnet */}
          <button
            onClick={() => selectPreset("mainnet")}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#1a1a1a] transition-colors ${
              activeNetwork.id === "mainnet" ? "bg-[#1a1a1a]" : ""
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <div>
              <div className="text-sm font-medium text-gray-200">Mainnet</div>
              <div className="text-xs text-gray-500">
                wss://rpc.vara.network
              </div>
            </div>
            {activeNetwork.id === "mainnet" && (
              <span className="ml-auto text-emerald-500 text-xs">Active</span>
            )}
          </button>

          {/* Testnet */}
          <button
            onClick={() => selectPreset("testnet")}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#1a1a1a] transition-colors ${
              activeNetwork.id === "testnet" ? "bg-[#1a1a1a]" : ""
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
            <div>
              <div className="text-sm font-medium text-gray-200">Testnet</div>
              <div className="text-xs text-gray-500">
                wss://testnet.vara.network
              </div>
            </div>
            {activeNetwork.id === "testnet" && (
              <span className="ml-auto text-emerald-500 text-xs">Active</span>
            )}
          </button>

          {/* Divider */}
          <div className="border-t border-gray-800" />

          {/* Custom */}
          <button
            onClick={() => setShowCustom(!showCustom)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#1a1a1a] transition-colors ${
              activeNetwork.id === "custom" ? "bg-[#1a1a1a]" : ""
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
            <div className="text-sm font-medium text-gray-200">
              Custom Contract
            </div>
            {activeNetwork.id === "custom" && (
              <span className="ml-auto text-emerald-500 text-xs">Active</span>
            )}
            <svg
              className={`w-3 h-3 text-gray-500 transition-transform ml-auto ${showCustom ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showCustom && (
            <div className="px-4 pb-4 space-y-3">
              {/* Endpoint toggle */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Endpoint
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCustomEndpoint("mainnet")}
                    className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                      customEndpoint === "mainnet"
                        ? "bg-emerald-600 text-white"
                        : "bg-[#1a1a1a] text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    Mainnet RPC
                  </button>
                  <button
                    onClick={() => setCustomEndpoint("testnet")}
                    className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                      customEndpoint === "testnet"
                        ? "bg-yellow-600 text-white"
                        : "bg-[#1a1a1a] text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    Testnet RPC
                  </button>
                </div>
              </div>

              {/* Program ID input */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Program ID
                </label>
                <input
                  type="text"
                  value={customPid}
                  onChange={(e) => setCustomPid(e.target.value)}
                  placeholder="0x..."
                  className={`w-full text-xs font-mono bg-[#0a0a0a] border rounded-md px-3 py-2 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500 ${
                    customPid && !isValidProgramId(customPid)
                      ? "border-red-500"
                      : "border-gray-700"
                  }`}
                />
                {customPid && !isValidProgramId(customPid) && (
                  <p className="text-xs text-red-400 mt-1">
                    Must be 0x + 64 hex characters
                  </p>
                )}
              </div>

              {/* Connect button */}
              <button
                onClick={connectCustom}
                disabled={!isValidProgramId(customPid)}
                className="w-full text-xs py-2 rounded-md font-medium transition-colors bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Connect
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
