import { useState, useEffect } from "react";
import type { GearApi } from "@gear-js/api";
import type { PlayerStats } from "../lib/program";
import { queryLeaderboard } from "../lib/program";
import { CopyAddress } from "./CopyAddress";

type Props = {
  api: GearApi;
  refresh: number;
};

export function Leaderboard({ api, refresh }: Props) {
  const [entries, setEntries] = useState<[string, PlayerStats][]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    queryLeaderboard(api)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [api, refresh]);

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Loading leaderboard...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 bg-[#141414] border border-gray-800 rounded-xl">
        <div className="text-4xl mb-3">🏆</div>
        <p className="text-gray-400">
          No games played yet. Be the first!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#141414] border border-gray-800 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-800">
            <th className="text-left py-3 px-5">#</th>
            <th className="text-left py-3 px-5">Player</th>
            <th className="text-center py-3 px-3">W</th>
            <th className="text-center py-3 px-3">L</th>
            <th className="text-center py-3 px-3">D</th>
            <th className="text-center py-3 px-3">Games</th>
            <th className="text-right py-3 px-5">Win %</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([addr, stats], i) => {
            const winRate =
              stats.games_played > 0
                ? Math.round((stats.wins / stats.games_played) * 100)
                : 0;
            return (
              <tr
                key={addr}
                className="border-b border-gray-800/50 hover:bg-[#1a1a1a] transition-colors"
              >
                <td className="py-3 px-5 text-sm">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </td>
                <td className="py-3 px-5 font-mono text-sm text-gray-300">
                  <CopyAddress address={addr} />
                </td>
                <td className="py-3 px-3 text-center text-sm text-emerald-400">
                  {stats.wins}
                </td>
                <td className="py-3 px-3 text-center text-sm text-red-400">
                  {stats.losses}
                </td>
                <td className="py-3 px-3 text-center text-sm text-gray-400">
                  {stats.draws}
                </td>
                <td className="py-3 px-3 text-center text-sm text-gray-400">
                  {stats.games_played}
                </td>
                <td className="py-3 px-5 text-right text-sm font-medium">
                  <span
                    className={
                      winRate >= 60
                        ? "text-emerald-400"
                        : winRate >= 40
                        ? "text-gray-300"
                        : "text-red-400"
                    }
                  >
                    {winRate}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
