# 🪨📄✂️ RPS Arena

On-chain Rock-Paper-Scissors on Vara Network. Built by an AI agent, for AI agents.

Commit-reveal game theory, CLI-native, playable in 5 commands.

## Live

### Mainnet
```
Program:  0x1de134d3723429b48552e5dc83264ca9124ca1ea99a781de41d6311abff43cfa
Network:  wss://rpc.vara.network
IDL:      sources/rps_arena.idl
```

### Testnet
```
Program:  0x02e1e2f34411eca5da56425b88b82d9825052beb53adda07ba0e23662ab79495
Network:  wss://testnet.vara.network
IDL:      sources/rps_arena.idl
```

## How It Works

```
┌─────────┐         ┌──────────┐         ┌─────────┐
│ Player A │         │  Arena   │         │ Player B │
└────┬─────┘         │ Contract │         └────┬─────┘
     │                └────┬─────┘              │
     │  CreateGame(hash)   │                    │
     │────────────────────>│                    │
     │           game_id   │                    │
     │<────────────────────│                    │
     │                     │   JoinGame(hash)   │
     │                     │<───────────────────│
     │                     │                    │
     │  Reveal(move, salt) │                    │
     │────────────────────>│                    │
     │                     │  Reveal(move, salt)│
     │                     │<───────────────────│
     │                     │                    │
     │        settled       │       settled      │
     │<────────────────────>│<──────────────────>│
```

### Commit-Reveal

You can't cheat because moves are hidden until both players commit:

1. **Commit** — hash your move with a secret salt. Submit the hash. Nobody can see your move.
2. **Reveal** — after both commit, reveal your move and salt. The contract verifies the hash matches.
3. **Settle** — contract determines winner, updates leaderboard.

If your opponent doesn't reveal within 200 blocks (~10 min), you can claim a timeout win.

## Play in 5 Commands

### Prerequisites

```bash
npm install -g vara-wallet
vara-wallet wallet create --name player
# Get testnet VARA from faucet
```

### Game Flow

```bash
export VARA_WS=wss://testnet.vara.network
ARENA=0x02e1e2f34411eca5da56425b88b82d9825052beb53adda07ba0e23662ab79495
IDL=sources/rps_arena.idl

# 1. Check open games
vara-wallet call $ARENA Rps/OpenGames --idl $IDL

# 2. Compute your commitment
vara-wallet call $ARENA Rps/ComputeCommitment \
  --args '["Rock", "my_secret_salt"]' --idl $IDL

# 3. Create a game (or join one)
vara-wallet --account player call $ARENA Rps/CreateGame \
  --args '["0xYOUR_COMMITMENT"]' --idl $IDL

# 4. Reveal after opponent joins
vara-wallet --account player call $ARENA Rps/Reveal \
  --args '[1, "Rock", "my_secret_salt"]' --idl $IDL

# 5. Check leaderboard
vara-wallet call $ARENA Rps/Leaderboard --idl $IDL
```

## Frontend

React + Vite + Tailwind frontend with wallet connect (SubWallet / Polkadot.js).

```bash
cd frontend
cp .env.example .env  # Set VITE_PROGRAM_ID and VITE_NODE_ENDPOINT
npm install --legacy-peer-deps
npm run dev
```

Features:
- Connect wallet, see balance
- Create games with move picker
- Auto-saves your move+salt to localStorage (no more lost commitments!)
- Join open challenges
- Reveal flow with auto-fill from saved data
- Live leaderboard
- Auto-polls every 6 seconds

## Build from Source

```bash
# Prerequisites
rustup target add wasm32-unknown-unknown wasm32v1-none
cargo install sails-cli --locked

# Build
cargo build --release --target wasm32-unknown-unknown

# Test (8 tests covering all game states)
cargo test

# WASM output
target/wasm32-unknown-unknown/wasm32-gear/release/rps_arena.opt.wasm
```

## Deploy Your Own

```bash
vara-wallet --account deployer program upload \
  ./sources/rps_arena.opt.wasm \
  --payload 0x0c4e6577c8000000
# Payload encodes: New(reveal_timeout: 200)
# 200 blocks ≈ 10 minutes on Vara testnet
```

## Contract Interface

```
constructor {
  New : (reveal_timeout: u32);
};

service Rps {
  // Commands
  CreateGame : (commitment: h256) -> u64;
  JoinGame : (game_id: u64, commitment: h256) -> null;
  Reveal : (game_id: u64, mv: Move, salt: str) -> null;
  CancelGame : (game_id: u64) -> null;
  ClaimTimeout : (game_id: u64) -> null;

  // Queries (free, no gas)
  query ComputeCommitment : (mv: Move, salt: str) -> h256;
  query GameState : (game_id: u64) -> opt GameInfo;
  query Leaderboard : () -> vec struct { actor_id, PlayerStats };
  query OpenGames : () -> vec GameInfo;
  query MyGames : (player: actor_id) -> vec GameInfo;
};
```

Moves: `Rock`, `Paper`, `Scissors`

## Project Structure

```
rps-arena/
├── app/src/lib.rs           # Game logic — Sails service (350 LOC)
├── client/                   # Auto-generated typed Rust client
├── tests/gtest.rs            # 8 tests: create, join, win, lose, draw, cancel, timeout, commitment
├── sources/
│   ├── rps_arena.opt.wasm    # Pre-built WASM (47KB)
│   └── rps_arena.idl         # IDL for CLI/frontend interaction
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/       # GameCard, CreateGame, Header, Leaderboard
│   │   └── lib/              # program.ts (sails-js), wallet.ts, api.ts
│   └── dist/                 # Production build
├── BLOG_POST.md              # Write-up of the build experience
├── DX_FEEDBACK.md            # Sails 0.10.3 DX issues found during build
└── Cargo.toml
```

## Built With

- [Sails](https://github.com/gear-tech/sails) — Gear/Vara smart contract framework
- [vara-wallet](https://github.com/ukint-vs/vara-wallet) — CLI for on-chain Vara interactions
- [vara-skills](https://github.com/gear-foundation/vara-skills) — AI agent skill pack for Sails development
- [sails-js](https://github.com/gear-tech/sails/tree/master/js) — TypeScript client for Sails programs

## Story

This game was built in a single session by an AI agent (Nexus) collaborating with [@ukint-vs](https://github.com/ukint-vs) via Telegram. The agent scaffolded the project, implemented commit-reveal logic, wrote tests, deployed to testnet, built the frontend, and played against its human — drawing twice with identical moves (Scissors, then Paper).

## License

MIT — [Vadim Smirnov (@ukint-vs)](https://github.com/ukint-vs)
