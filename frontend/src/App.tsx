import { useState, useEffect, useCallback } from "react";
import { GearApi } from "@gear-js/api";
import { Header } from "./components/Header";
import { CreateGame } from "./components/CreateGame";
import { GameCard } from "./components/GameCard";
import { Leaderboard } from "./components/Leaderboard";
import {
  listWallets,
  enableWallet,
  type WalletAccount,
} from "./lib/wallet";
import type { GameInfo } from "./lib/program";
import { queryOpenGames, queryMyGames } from "./lib/program";

const STORAGE_SOURCE = "rps.wallet.source";
const STORAGE_ADDR = "rps.wallet.address";

export default function App() {
  const [api, setApi] = useState<GearApi | null>(null);
  const [apiStatus, setApiStatus] = useState<"connecting" | "ready" | "error">("connecting");
  const [wallets, setWallets] = useState<string[]>([]);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [signer, setSigner] = useState<unknown>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const [openGames, setOpenGames] = useState<GameInfo[]>([]);
  const [myGames, setMyGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const triggerRefresh = useCallback(() => setRefresh((n) => n + 1), []);

  // Connect API
  useEffect(() => {
    let cancelled = false;
    GearApi.create({ providerAddress: import.meta.env.VITE_NODE_ENDPOINT })
      .then((a) => { if (!cancelled) { setApi(a); setApiStatus("ready"); } })
      .catch(() => { if (!cancelled) setApiStatus("error"); });
    return () => { cancelled = true; };
  }, []);

  // Auto-reconnect wallet
  useEffect(() => {
    listWallets().then(setWallets);
    const saved = localStorage.getItem(STORAGE_SOURCE);
    if (saved) {
      enableWallet(saved).then(({ accounts, signer: s }) => {
        const addr = localStorage.getItem(STORAGE_ADDR);
        const pick = accounts.find((a) => a.address === addr) ?? accounts[0];
        if (pick) { setAccount(pick); setSigner(s); }
      }).catch(() => {});
    }
  }, []);

  // Fetch balance
  useEffect(() => {
    if (!api || apiStatus !== "ready" || !account) return;
    let cancelled = false;
    const fetch = async () => {
      try {
        const raw: any = await (api as any).query.system.account(account.address);
        if (cancelled) return;
        const free = BigInt(raw.data.free.toString());
        const vara = Number(free) / 1e12;
        setBalance(vara.toFixed(vara < 0.01 ? 4 : 2));
      } catch { if (!cancelled) setBalance(null); }
    };
    fetch();
    const id = setInterval(fetch, 12000);
    return () => { cancelled = true; clearInterval(id); };
  }, [api, apiStatus, account]);

  // Fetch games — poll every 6s (roughly 1 block on Vara)
  useEffect(() => {
    if (!api || apiStatus !== "ready") return;
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const open = await queryOpenGames(api);
        if (cancelled) return;
        setOpenGames(open);

        if (account) {
          const my = await queryMyGames(api, account.address);
          if (cancelled) return;
          setMyGames(my);
        } else {
          setMyGames([]);
        }
      } catch (e) {
        console.error("[RPS] Fetch failed:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    fetchAll();
    const interval = setInterval(fetchAll, 6000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [api, apiStatus, account, refresh]);

  const connectWallet = async (source: string) => {
    const { accounts, signer: s } = await enableWallet(source);
    if (accounts.length === 0) return;
    setAccount(accounts[0]);
    setSigner(s);
    localStorage.setItem(STORAGE_SOURCE, source);
    localStorage.setItem(STORAGE_ADDR, accounts[0].address);
  };

  const disconnect = () => {
    setAccount(null); setSigner(null); setBalance(null);
    localStorage.removeItem(STORAGE_SOURCE);
    localStorage.removeItem(STORAGE_ADDR);
  };

  // Deduplicate: my active games (not in open)
  const myActiveGames = myGames.filter(
    (g) => g.status !== "WaitingForOpponent" || 
           (account && g.creator === account.address)
  );

  // Open games I didn't create
  const joinableGames = account 
    ? openGames.filter((g) => {
        // Compare with both formats
        const myHex = account.address.startsWith("0x") ? account.address : "";
        return g.creator !== account.address && g.creator !== myHex;
      })
    : openGames;

  // My open games (waiting for opponent)
  const myOpenGames = account
    ? openGames.filter((g) => g.creator === account.address)
    : [];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200">
      <Header
        account={account}
        balance={balance}
        wallets={wallets}
        apiStatus={apiStatus}
        onConnect={connectWallet}
        onDisconnect={disconnect}
      />

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {apiStatus === "connecting" && (
          <div className="text-center py-20 text-gray-500">Connecting to Vara Network...</div>
        )}
        {apiStatus === "error" && (
          <div className="text-center py-20 text-red-400">Failed to connect. Check your network.</div>
        )}

        {apiStatus === "ready" && api && (
          <>
            {/* Create game */}
            {account && (
              <CreateGame api={api} account={account.address} signer={signer} onCreated={triggerRefresh} />
            )}

            {/* My active games needing action */}
            {myActiveGames.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  🎮 Your Games
                </h2>
                <div className="space-y-3">
                  {myActiveGames.map((game) => (
                    <GameCard
                      key={String(game.id)}
                      game={game}
                      api={api}
                      account={account}
                      signer={signer}
                      onAction={triggerRefresh}
                      perspective="player"
                    />
                  ))}
                </div>
              </section>
            )}

            {/* My open games waiting for opponent */}
            {myOpenGames.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  ⏳ Waiting for Opponent
                </h2>
                <div className="space-y-3">
                  {myOpenGames.map((game) => (
                    <GameCard
                      key={String(game.id)}
                      game={game}
                      api={api}
                      account={account}
                      signer={signer}
                      onAction={triggerRefresh}
                      perspective="creator"
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Open games to join */}
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                ⚔️ Open Challenges
                <span className="text-sm font-normal text-gray-500">
                  ({joinableGames.length})
                </span>
              </h2>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : joinableGames.length === 0 ? (
                <div className="text-center py-8 bg-[#141414] border border-gray-800 rounded-xl text-gray-500">
                  No open challenges. Create one above!
                </div>
              ) : (
                <div className="space-y-3">
                  {joinableGames.map((game) => (
                    <GameCard
                      key={String(game.id)}
                      game={game}
                      api={api}
                      account={account}
                      signer={signer}
                      onAction={triggerRefresh}
                      perspective="challenger"
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Leaderboard */}
            <Leaderboard api={api} refresh={refresh} />
          </>
        )}
      </div>

      <footer className="text-center py-6 text-gray-600 text-xs border-t border-gray-800/50">
        RPS Arena — Built by an AI agent on Vara Network •{" "}
        <a href="https://github.com/ukint-vs/rps-arena" className="text-emerald-600 hover:text-emerald-400">Source</a>
      </footer>
    </div>
  );
}
