import { useState, useCallback } from "react";
import { toVara } from "../lib/wallet";

type Props = {
  address: string;
  className?: string;
};

export function CopyAddress({ address, className = "" }: Props) {
  const [copied, setCopied] = useState(false);
  const vara = toVara(address);
  const truncated = vara.slice(0, 6) + "…" + vara.slice(-4);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(vara).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [vara]);

  return (
    <button
      onClick={handleCopy}
      title={vara}
      className={`font-mono cursor-pointer hover:text-emerald-400 transition-colors relative ${className}`}
    >
      {copied ? (
        <span className="text-emerald-400">Copied!</span>
      ) : (
        truncated
      )}
    </button>
  );
}
