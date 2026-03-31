import { useState } from "react";
import type { GearApi } from "@gear-js/api";
import { type WalletAccount } from "../lib/wallet";
import { CopyAddress } from "./CopyAddress";
import type { GameInfo, Move } from "../lib/program";
import {
  queryComputeCommitment,
  txJoinGame,
  txReveal,
  txCancelGame,
} from "../lib/program";
import { decodeAddress } from "@polkadot/util-crypto";
import { u8aToHex } from "@polkadot/util";

function toHex(addr: string): string {
  if (addr.startsWith("0x")) return addr;
  try { return u8aToHex(decodeAddress(addr)); } catch { return addr; }
}

const MOVE_EMOJI: Record<string, string> = { Rock: "🪨", Paper: "📄", Scissors: "✂️" };
const MOVES: Move[] = ["Rock", "Paper", "Scissors"];

type Props = {
  game: GameInfo;
  api: GearApi;
  account: WalletAccount | null;
  signer: unknown;
  networkId: string;
  onAction: () => void;
  onTxStart?: () => void;
  onTxEnd?: () => void;
  perspective: "player" | "creator" | "challenger";
};

export function GameCard({ game, api, account, signer, networkId, onAction, onTxStart, onTxEnd, perspective }: Props) {
  const [selectedMove, setSelectedMove] = useState<Move | null>(null);
  const [salt, setSalt] = useState(() => Math.random().toString(36).slice(2, 10));
  // Auto-fill from localStorage if we saved the commitment
  const savedCommitment = (() => {
    try {
      const raw = localStorage.getItem(`rps.game.${networkId}.${game.id}`);
      if (raw) return JSON.parse(raw) as { move: Move; salt: string };
    } catch {}
    return null;
  })();

  const [revealSalt, setRevealSalt] = useState(savedCommitment?.salt ?? "");
  const [revealMove, setRevealMove] = useState<Move | null>(savedCommitment?.move ?? null);
  const [showReveal, setShowReveal] = useState(!!savedCommitment);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const isCreator = account ? game.creator === toHex(account.address) : false;
  const myMove = isCreator ? game.creator_move : game.opponent_move;
  const theirMove = isCreator ? game.opponent_move : game.creator_move;
  const needsReveal = game.status === "BothCommitted" && !myMove;

  // Result from my perspective
  let myResult = game.result;
  if (game.status === "Settled" && game.result && !isCreator) {
    if (game.result === "Win") myResult = "Lose";
    else if (game.result === "Lose") myResult = "Win";
  }

  const handleJoin = async () => {
    if (!account || !selectedMove) return;
    setActing(true); setError(null); onTxStart?.();
    try {
      const commitment = await queryComputeCommitment(api, selectedMove, salt);
      await txJoinGame(api, account.address, Number(game.id), commitment, signer);
      // Save move+salt to localStorage so we can reveal later
      const key = `rps.game.${networkId}.${game.id}`;
      localStorage.setItem(key, JSON.stringify({ move: selectedMove, salt }));
      console.log(`[RPS] Saved commitment for game #${game.id}: move=${selectedMove}, salt=${salt}`);
      onAction();
    } catch (e: any) {
      setError(e.message || "Failed to join");
    } finally { setActing(false); onTxEnd?.(); }
  };

  const handleReveal = async () => {
    if (!account || !revealMove || !revealSalt) return;
    setActing(true); setError(null); onTxStart?.();
    try {
      await txReveal(api, account.address, Number(game.id), revealMove, revealSalt, signer);
      onAction();
    } catch (e: any) {
      setError(e.message || "Failed to reveal");
    } finally { setActing(false); onTxEnd?.(); }
  };

  const handleCancel = async () => {
    if (!account) return;
    setActing(true); setError(null); onTxStart?.();
    try {
      await txCancelGame(api, account.address, Number(game.id), signer);
      onAction();
    } catch (e: any) {
      setError(e.message || "Failed to cancel");
    } finally { setActing(false); onTxEnd?.(); }
  };

  return (
    <div className="bg-[#141414] border border-gray-800 rounded-xl p-5 transition-colors hover:border-gray-700">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-gray-500">#{String(game.id)}</span>
          <StatusBadge status={game.status} />
        </div>
        {game.status === "Settled" && myResult && (
          <span className={`text-sm font-semibold ${
            myResult === "Win" ? "text-emerald-400" : myResult === "Lose" ? "text-red-400" : "text-gray-400"
          }`}>
            {myResult === "Win" ? "🏆 Won" : myResult === "Lose" ? "💀 Lost" : "🤝 Draw"}
          </span>
        )}
      </div>

      {/* Settled game — show moves */}
      {game.status === "Settled" && (
        <div className="flex items-center justify-center gap-8 py-4">
          <div className="text-center">
            <div className="text-3xl">{myMove ? MOVE_EMOJI[myMove] : "❓"}</div>
            <div className="text-xs text-gray-500 mt-1">You</div>
          </div>
          <span className="text-gray-600 text-lg">vs</span>
          <div className="text-center">
            <div className="text-3xl">{theirMove ? MOVE_EMOJI[theirMove] : "❓"}</div>
            <div className="text-xs text-gray-500 mt-1">Opponent</div>
          </div>
        </div>
      )}

      {/* BothCommitted — show reveal or waiting */}
      {game.status === "BothCommitted" && (
        <div className="mt-3">
          {needsReveal ? (
            <div className="space-y-3">
              <p className="text-sm text-blue-400">Your turn — reveal your move!</p>
              <div className="flex gap-2">
                {MOVES.map((m) => (
                  <button key={m} onClick={() => setRevealMove(m)}
                    className={`flex-1 py-3 rounded-lg text-center border transition-all ${
                      revealMove === m ? "bg-blue-600/20 border-blue-500" : "bg-[#1a1a1a] border-gray-800 hover:border-gray-600"
                    }`}>
                    <span className="text-2xl">{MOVE_EMOJI[m]}</span>
                    <div className="text-xs mt-1 text-gray-400">{m}</div>
                  </button>
                ))}
              </div>
              <input type="text" value={revealSalt} onChange={(e) => setRevealSalt(e.target.value)}
                placeholder="Enter the salt you used when committing"
                className="w-full bg-[#1a1a1a] border border-gray-800 rounded-md px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
              <button onClick={handleReveal} disabled={!revealMove || !revealSalt || acting}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors">
                {acting ? "Revealing..." : "Reveal Move"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-3">
              <div className="text-2xl">{myMove ? MOVE_EMOJI[myMove] : "❓"}</div>
              <span className="text-sm text-yellow-400">⏳ Waiting for opponent to reveal...</span>
            </div>
          )}
        </div>
      )}

      {/* WaitingForOpponent — creator can cancel, others can join */}
      {game.status === "WaitingForOpponent" && (
        <div className="mt-3">
          {perspective === "creator" ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Waiting for someone to challenge you...</span>
              <button onClick={handleCancel} disabled={acting}
                className="px-4 py-2 text-sm text-gray-400 hover:text-red-400 border border-gray-800 rounded-lg transition-colors">
                {acting ? "..." : "Cancel"}
              </button>
            </div>
          ) : perspective === "challenger" && account ? (
            <>
              {expanded ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {MOVES.map((m) => (
                      <button key={m} onClick={() => setSelectedMove(m)}
                        className={`flex-1 py-3 rounded-lg text-center border transition-all ${
                          selectedMove === m ? "bg-emerald-600/20 border-emerald-500" : "bg-[#1a1a1a] border-gray-800 hover:border-gray-600"
                        }`}>
                        <span className="text-2xl">{MOVE_EMOJI[m]}</span>
                        <div className="text-xs mt-1 text-gray-400">{m}</div>
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Secret salt — save this! You need it to reveal.
                    </label>
                    <div className="flex gap-2">
                      <input type="text" value={salt} onChange={(e) => setSalt(e.target.value)}
                        className="flex-1 bg-[#1a1a1a] border border-gray-800 rounded-md px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none" />
                      <button onClick={() => setSalt(Math.random().toString(36).slice(2, 10))}
                        className="px-3 py-2 bg-[#1a1a1a] border border-gray-800 rounded-md text-gray-400 hover:text-white">🎲</button>
                    </div>
                  </div>
                  <button onClick={handleJoin} disabled={!selectedMove || acting}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors">
                    {acting ? "Joining..." : "Accept Challenge"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">
                    Created by <CopyAddress address={game.creator} />
                  </span>
                  <button onClick={() => setExpanded(true)}
                    className="px-5 py-2 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 border border-emerald-800/50 rounded-lg text-sm font-medium transition-colors">
                    ⚔️ Challenge
                  </button>
                </div>
              )}
            </>
          ) : (
            <span className="text-sm text-gray-500">
              By <CopyAddress address={game.creator} /> — connect wallet to play
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    WaitingForOpponent: "text-yellow-400 bg-yellow-900/20",
    BothCommitted: "text-blue-400 bg-blue-900/20",
    Settled: "text-emerald-400 bg-emerald-900/20",
    Cancelled: "text-gray-500 bg-gray-800",
  };
  const labels: Record<string, string> = {
    WaitingForOpponent: "Open",
    BothCommitted: "Reveal phase",
    Settled: "Settled",
    Cancelled: "Cancelled",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || ""}`}>
      {labels[status] || status}
    </span>
  );
}
