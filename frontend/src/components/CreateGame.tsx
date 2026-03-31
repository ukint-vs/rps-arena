import { useState } from "react";
import type { GearApi } from "@gear-js/api";
import type { Move } from "../lib/program";
import { queryComputeCommitment, txCreateGame } from "../lib/program";

type Props = {
  api: GearApi;
  account: string;
  signer: unknown;
  networkId: string;
  onCreated: () => void;
  onTxStart?: () => void;
  onTxEnd?: () => void;
};

const MOVES: Move[] = ["Rock", "Paper", "Scissors"];
const MOVE_EMOJI: Record<Move, string> = {
  Rock: "🪨",
  Paper: "📄",
  Scissors: "✂️",
};

export function CreateGame({ api, account, signer, networkId, onCreated, onTxStart, onTxEnd }: Props) {
  const [selectedMove, setSelectedMove] = useState<Move | null>(null);
  const [salt, setSalt] = useState(() =>
    Math.random().toString(36).slice(2, 10)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!selectedMove) return;
    setLoading(true);
    setError(null);
    onTxStart?.();

    try {
      const commitment = await queryComputeCommitment(api, selectedMove, salt);
      const result = await txCreateGame(api, account, commitment, signer);
      // Save move+salt — game ID is returned from the tx
      const gameId = result ?? "latest";
      const key = `rps.game.${networkId}.${gameId}`;
      localStorage.setItem(key, JSON.stringify({ move: selectedMove, salt }));
      console.log(`[RPS] Saved commitment for game #${gameId}: move=${selectedMove}, salt=${salt}`);
      onCreated();
      setSelectedMove(null);
      setSalt(Math.random().toString(36).slice(2, 10));
    } catch (e: any) {
      setError(e.message || "Failed to create game");
    } finally {
      setLoading(false);
      onTxEnd?.();
    }
  };

  return (
    <div className="bg-[#141414] border border-gray-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-4">Create a Game</h2>

      <div className="flex gap-3 mb-4">
        {MOVES.map((m) => (
          <button
            key={m}
            onClick={() => setSelectedMove(m)}
            className={`flex-1 py-4 rounded-lg text-center transition-all border ${
              selectedMove === m
                ? "bg-emerald-600/20 border-emerald-500 text-emerald-400"
                : "bg-[#1a1a1a] border-gray-800 hover:border-gray-600 text-gray-300"
            }`}
          >
            <div className="text-3xl mb-1">{MOVE_EMOJI[m]}</div>
            <div className="text-sm font-medium">{m}</div>
          </button>
        ))}
      </div>

      <div className="mb-4">
        <label className="block text-xs text-gray-500 mb-1">
          Secret salt (save this — you need it to reveal!)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={salt}
            onChange={(e) => setSalt(e.target.value)}
            className="flex-1 bg-[#1a1a1a] border border-gray-800 rounded-md px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
          />
          <button
            onClick={() => setSalt(Math.random().toString(36).slice(2, 10))}
            className="px-3 py-2 bg-[#1a1a1a] border border-gray-800 rounded-md text-sm text-gray-400 hover:text-white"
          >
            🎲
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={!selectedMove || loading}
        className={`w-full py-3 rounded-lg font-medium transition-colors ${
          selectedMove && !loading
            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
            : "bg-gray-800 text-gray-500 cursor-not-allowed"
        }`}
      >
        {loading ? "Creating..." : "Create Game"}
      </button>
    </div>
  );
}
