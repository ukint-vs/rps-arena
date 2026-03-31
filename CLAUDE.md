# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RPS Arena — an on-chain Rock-Paper-Scissors game on Vara Network using the Sails framework. Commit-reveal mechanism prevents cheating. Live on mainnet and testnet.

## Build & Test Commands

```bash
# Build (requires wasm32-unknown-unknown target)
cargo build --release

# Test
cargo test --release

# Lint
cargo fmt --check
cargo clippy --release --all-targets -- -D warnings

# Frontend (from frontend/)
npm install --legacy-peer-deps
npm run dev        # dev server
npm run build      # production build
```

Prerequisites: `rustup target add wasm32-unknown-unknown wasm32v1-none`. CI also requires Binaryen (wasm-opt).

## Architecture

**Workspace members:** `app/` (smart contract) and `client/` (auto-generated typed Rust client).

```
app/src/lib.rs          Smart contract (Sails service, ~450 LOC)
    ↓ build.rs
WASM binary + IDL       Generated during cargo build
    ↓ client/build.rs
client/src/rps_arena_client.rs   Auto-generated typed client (DO NOT edit)
client/rps_arena_client.idl      Auto-generated IDL (DO NOT edit)
```

- `src/lib.rs` — Thin WASM binary wrapper, re-exports app
- `sources/` — Pre-built optimized WASM binary and IDL for deployment
- `tests/gtest.rs` — Integration tests using Sails gtest framework (8 tests)
- `frontend/` — React 18 + TypeScript + Tailwind + sails-js

### Contract design

State uses `UnsafeCell<Option<RefCell<ArenaData>>>` pattern to work around Rust 2024 `static_mut_refs` restrictions with Sails.

Game flow: CreateGame(commitment) → JoinGame(commitment) → Reveal(move, salt) × 2 → auto-settle. Timeout mechanism lets a player claim win if opponent doesn't reveal within `reveal_deadline_blocks`.

Custom `simple_hash` (XOR-fold) used because no hashing primitives available in `no_std`.

### Frontend

React app at `frontend/` uses sails-js to interact with the contract. Polls games every 6s, balance every 12s. Saves move+salt to localStorage for reveal recovery. Requires `.env` with `VITE_PROGRAM_ID` and `VITE_NODE_ENDPOINT` (see `.env.example`).

## CI

GitHub Actions (`.github/workflows/ci.yml`): fmt → clippy → build → test → validates auto-generated client files aren't manually modified.
