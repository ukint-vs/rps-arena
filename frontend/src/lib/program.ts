import { GearApi } from "@gear-js/api";
import { Sails } from "sails-js";
import { SailsIdlParser } from "sails-js-parser";
import { decodeAddress } from "@polkadot/util-crypto";
import { u8aToHex } from "@polkadot/util";
import idlRaw from "@/assets/rps_arena.idl?raw";

/** Convert SS58 or hex address to 0x-prefixed hex */
function toHexAddress(address: string): string {
  if (address.startsWith("0x")) return address;
  try {
    return u8aToHex(decodeAddress(address));
  } catch {
    return address;
  }
}

let cachedSails: Sails | null = null;
let cachedProgramId: string | null = null;
let activeProgramId: `0x${string}` | null = null;

export function setActiveProgramId(pid: `0x${string}`): void {
  if (pid !== activeProgramId) {
    activeProgramId = pid;
    cachedSails = null;
    cachedProgramId = null;
  }
}

export function resetProgram(): void {
  cachedSails = null;
  cachedProgramId = null;
}

export async function getProgram(api: GearApi): Promise<Sails> {
  const pid = activeProgramId;
  if (!pid) throw new Error("No active program ID set");

  if (cachedSails && cachedProgramId === pid) return cachedSails;

  const parser = await SailsIdlParser.new();
  const sails = new Sails(parser);
  sails.parseIdl(idlRaw);
  sails.setApi(api);
  sails.setProgramId(pid);

  cachedSails = sails;
  cachedProgramId = pid;
  return sails;
}

// Types matching the IDL
export type Move = "Rock" | "Paper" | "Scissors";

export type GameStatus =
  | "WaitingForOpponent"
  | "BothCommitted"
  | "Settled"
  | "Cancelled";

export type GameResult = "Win" | "Lose" | "Draw";

export interface GameInfo {
  id: number | string;
  creator: string;
  opponent: string | null;
  status: GameStatus;
  creator_commitment: string;
  opponent_commitment: string | null;
  creator_move: Move | null;
  opponent_move: Move | null;
  winner: string | null;
  result: GameResult | null;
  created_at_block: number;
  committed_at_block: number | null;
  reveal_deadline_blocks: number;
}

export interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
  games_played: number;
}

// Queries — sails-js 0.5.1 queries take ONLY function args (no origin)
export async function queryOpenGames(api: GearApi): Promise<GameInfo[]> {
  const sails = await getProgram(api);
  const result = await sails.services.Rps.queries.OpenGames().call();
  return result as GameInfo[];
}

export async function queryLeaderboard(
  api: GearApi
): Promise<[string, PlayerStats][]> {
  const sails = await getProgram(api);
  const result = await sails.services.Rps.queries.Leaderboard().call();
  return result as [string, PlayerStats][];
}

export async function queryGameState(
  api: GearApi,
  gameId: number
): Promise<GameInfo | null> {
  const sails = await getProgram(api);
  const result = await sails.services.Rps.queries.GameState(gameId).call();
  return result as GameInfo | null;
}

export async function queryMyGames(
  api: GearApi,
  player: string
): Promise<GameInfo[]> {
  const sails = await getProgram(api);
  const hexPlayer = toHexAddress(player);
  console.log("[RPS] queryMyGames hex:", hexPlayer);
  const result = await sails.services.Rps.queries.MyGames(hexPlayer).call();
  console.log("[RPS] queryMyGames result:", result);
  return result as GameInfo[];
}

export async function queryComputeCommitment(
  api: GearApi,
  mv: Move,
  salt: string
): Promise<string> {
  const sails = await getProgram(api);
  const result = await sails.services.Rps.queries.ComputeCommitment(
    mv,
    salt
  ).call();
  return result as string;
}

// Transactions
export async function txCreateGame(
  api: GearApi,
  account: string,
  commitment: string,
  signer?: unknown
) {
  const sails = await getProgram(api);
  const tx = sails.services.Rps.functions.CreateGame(commitment);
  tx.withAccount(account, { signer } as Record<string, unknown>);
  await tx.calculateGas();
  const { response } = await tx.signAndSend();
  return response();
}

export async function txJoinGame(
  api: GearApi,
  account: string,
  gameId: number,
  commitment: string,
  signer?: unknown
) {
  const sails = await getProgram(api);
  const tx = sails.services.Rps.functions.JoinGame(gameId, commitment);
  tx.withAccount(account, { signer } as Record<string, unknown>);
  await tx.calculateGas();
  const { response } = await tx.signAndSend();
  return response();
}

export async function txReveal(
  api: GearApi,
  account: string,
  gameId: number,
  mv: Move,
  salt: string,
  signer?: unknown
) {
  const sails = await getProgram(api);
  const tx = sails.services.Rps.functions.Reveal(gameId, mv, salt);
  tx.withAccount(account, { signer } as Record<string, unknown>);
  await tx.calculateGas();
  const { response } = await tx.signAndSend();
  return response();
}

export async function txCancelGame(
  api: GearApi,
  account: string,
  gameId: number,
  signer?: unknown
) {
  const sails = await getProgram(api);
  const tx = sails.services.Rps.functions.CancelGame(gameId);
  tx.withAccount(account, { signer } as Record<string, unknown>);
  await tx.calculateGas();
  const { response } = await tx.signAndSend();
  return response();
}
