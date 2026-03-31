#![no_std]

use sails_rs::{
    cell::RefCell,
    collections::BTreeMap,
    gstd::{exec, msg},
    prelude::*,
};

// ── Types ──────────────────────────────────────────────────────────────────

pub type GameId = u64;

#[derive(Clone, Debug, Encode, Decode, TypeInfo, PartialEq, Eq)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub enum Move {
    Rock,
    Paper,
    Scissors,
}

#[derive(Clone, Debug, Encode, Decode, TypeInfo, PartialEq, Eq)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub enum GameResult {
    Win,
    Lose,
    Draw,
}

#[derive(Clone, Debug, Encode, Decode, TypeInfo, PartialEq, Eq)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub enum GameStatus {
    WaitingForOpponent,
    BothCommitted,
    Settled,
    Cancelled,
}

#[derive(Clone, Debug, Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub struct GameInfo {
    pub id: GameId,
    pub creator: ActorId,
    pub opponent: Option<ActorId>,
    pub status: GameStatus,
    pub creator_commitment: H256,
    pub opponent_commitment: Option<H256>,
    pub creator_move: Option<Move>,
    pub opponent_move: Option<Move>,
    pub winner: Option<ActorId>,
    pub result: Option<GameResult>,
    pub created_at_block: u32,
    pub committed_at_block: Option<u32>,
    pub reveal_deadline_blocks: u32,
}

#[derive(Clone, Debug, Default, Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub struct PlayerStats {
    pub wins: u32,
    pub losses: u32,
    pub draws: u32,
    pub games_played: u32,
}

// ── Events ──────────────────────────────────────────────────────────────────

#[derive(Clone, Debug, PartialEq, Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub enum RpsEvent {
    GameCreated {
        game_id: GameId,
        creator: ActorId,
    },
    GameJoined {
        game_id: GameId,
        opponent: ActorId,
    },
    MoveRevealed {
        game_id: GameId,
        player: ActorId,
    },
    GameSettled {
        game_id: GameId,
        winner: Option<ActorId>,
        result: GameResult,
    },
    GameCancelled {
        game_id: GameId,
    },
}

// ── State ───────────────────────────────────────────────────────────────────

pub struct ArenaData {
    pub next_game_id: GameId,
    pub games: BTreeMap<GameId, GameInfo>,
    pub leaderboard: BTreeMap<ActorId, PlayerStats>,
    pub reveal_timeout: u32,
}

impl ArenaData {
    pub fn new(reveal_timeout: u32) -> Self {
        Self {
            next_game_id: 1,
            games: BTreeMap::new(),
            leaderboard: BTreeMap::new(),
            reveal_timeout,
        }
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

fn determine_winner(a: &Move, b: &Move) -> GameResult {
    match (a, b) {
        (Move::Rock, Move::Scissors)
        | (Move::Paper, Move::Rock)
        | (Move::Scissors, Move::Paper) => GameResult::Win,
        (Move::Rock, Move::Rock)
        | (Move::Paper, Move::Paper)
        | (Move::Scissors, Move::Scissors) => GameResult::Draw,
        _ => GameResult::Lose,
    }
}

/// Verify a commitment: blake2b_256(SCALE(move) ++ salt_bytes) == commitment.
/// Uses gstd's exec::env_vars for block hash as a simple on-chain hash check.
/// Actually, we use a simpler approach: the commitment is just the raw
/// concatenation hash. Agents compute it client-side the same way.
///
/// For on-chain verification, we re-derive the commitment from (move, salt)
/// using a deterministic encoding and compare.
fn verify_commitment(mv: &Move, salt: &[u8], commitment: &H256) -> bool {
    // Encode: SCALE(move) ++ salt
    let mut data = mv.encode();
    data.extend_from_slice(salt);
    // Simple hash: XOR-fold the data into 32 bytes for a basic commitment.
    // This is NOT cryptographically strong, but sufficient for a game demo.
    // In production, use sp-core-hashing or a proper blake2.
    let hash = simple_hash(&data);
    hash == *commitment
}

/// A simple deterministic hash for no_std environments.
/// Folds data into 32 bytes using XOR with position mixing.
/// NOT cryptographic — good enough for a game demo commitment scheme.
fn simple_hash(data: &[u8]) -> H256 {
    let mut result = [0u8; 32];
    for (i, &byte) in data.iter().enumerate() {
        let idx = i % 32;
        result[idx] ^= byte;
        // Mix in position
        result[(idx + 1) % 32] =
            result[(idx + 1) % 32].wrapping_add(byte.wrapping_mul((i as u8).wrapping_add(1)));
    }
    H256::from(result)
}

// ── Service ─────────────────────────────────────────────────────────────────

pub struct RpsArenaService<'a> {
    data: &'a RefCell<ArenaData>,
}

impl<'a> RpsArenaService<'a> {
    pub fn new(data: &'a RefCell<ArenaData>) -> Self {
        Self { data }
    }
}

#[sails_rs::service]
impl RpsArenaService<'_> {
    /// Create a new game with your committed move hash.
    /// Commitment = simple_hash(SCALE(move) ++ salt_bytes).
    /// Use the query ComputeCommitment to generate your commitment.
    #[export]
    pub fn create_game(&mut self, commitment: H256) -> GameId {
        let caller = msg::source();
        let mut data = self.data.borrow_mut();

        let game_id = data.next_game_id;
        data.next_game_id += 1;

        let game = GameInfo {
            id: game_id,
            creator: caller,
            opponent: None,
            status: GameStatus::WaitingForOpponent,
            creator_commitment: commitment,
            opponent_commitment: None,
            creator_move: None,
            opponent_move: None,
            winner: None,
            result: None,
            created_at_block: exec::block_height(),
            committed_at_block: None,
            reveal_deadline_blocks: data.reveal_timeout,
        };

        data.games.insert(game_id, game);
        game_id
    }

    /// Join an existing game with your committed move hash.
    #[export]
    pub fn join_game(&mut self, game_id: GameId, commitment: H256) {
        let caller = msg::source();
        let mut data = self.data.borrow_mut();

        let game = data
            .games
            .get_mut(&game_id)
            .unwrap_or_else(|| panic!("Game {} not found", game_id));

        assert!(
            game.status == GameStatus::WaitingForOpponent,
            "Game is not waiting for opponent"
        );
        assert!(game.creator != caller, "Cannot play against yourself");

        game.opponent = Some(caller);
        game.opponent_commitment = Some(commitment);
        game.status = GameStatus::BothCommitted;
        game.committed_at_block = Some(exec::block_height());
    }

    /// Reveal your move and salt. Contract verifies commitment.
    #[export]
    pub fn reveal(&mut self, game_id: GameId, mv: Move, salt: String) {
        let caller = msg::source();
        let mut data = self.data.borrow_mut();

        let game = data
            .games
            .get_mut(&game_id)
            .unwrap_or_else(|| panic!("Game {} not found", game_id));

        assert!(
            game.status == GameStatus::BothCommitted,
            "Game is not in BothCommitted state"
        );

        if caller == game.creator {
            assert!(game.creator_move.is_none(), "Already revealed");
            assert!(
                verify_commitment(&mv, salt.as_bytes(), &game.creator_commitment),
                "Commitment mismatch"
            );
            game.creator_move = Some(mv);
        } else if Some(caller) == game.opponent {
            assert!(game.opponent_move.is_none(), "Already revealed");
            assert!(
                verify_commitment(
                    &mv,
                    salt.as_bytes(),
                    game.opponent_commitment.as_ref().unwrap()
                ),
                "Commitment mismatch"
            );
            game.opponent_move = Some(mv);
        } else {
            panic!("You are not a player in this game");
        }

        // Check if both revealed — settle the game
        if game.creator_move.is_some() && game.opponent_move.is_some() {
            let result = determine_winner(
                game.creator_move.as_ref().unwrap(),
                game.opponent_move.as_ref().unwrap(),
            );

            let winner = match result {
                GameResult::Win => Some(game.creator),
                GameResult::Lose => Some(game.opponent.unwrap()),
                GameResult::Draw => None,
            };

            game.winner = winner;
            game.result = Some(result.clone());
            game.status = GameStatus::Settled;

            // Update leaderboard
            let creator = game.creator;
            let opponent = game.opponent.unwrap();

            match result {
                GameResult::Win => {
                    let stats = data.leaderboard.entry(creator).or_default();
                    stats.wins += 1;
                    stats.games_played += 1;
                    let stats = data.leaderboard.entry(opponent).or_default();
                    stats.losses += 1;
                    stats.games_played += 1;
                }
                GameResult::Lose => {
                    let stats = data.leaderboard.entry(creator).or_default();
                    stats.losses += 1;
                    stats.games_played += 1;
                    let stats = data.leaderboard.entry(opponent).or_default();
                    stats.wins += 1;
                    stats.games_played += 1;
                }
                GameResult::Draw => {
                    let stats = data.leaderboard.entry(creator).or_default();
                    stats.draws += 1;
                    stats.games_played += 1;
                    let stats = data.leaderboard.entry(opponent).or_default();
                    stats.draws += 1;
                    stats.games_played += 1;
                }
            }
        }
    }

    /// Cancel a game you created that hasn't been joined yet.
    #[export]
    pub fn cancel_game(&mut self, game_id: GameId) {
        let caller = msg::source();
        let mut data = self.data.borrow_mut();

        let game = data
            .games
            .get_mut(&game_id)
            .unwrap_or_else(|| panic!("Game {} not found", game_id));

        assert!(game.creator == caller, "Only creator can cancel");
        assert!(
            game.status == GameStatus::WaitingForOpponent,
            "Can only cancel waiting games"
        );

        game.status = GameStatus::Cancelled;
    }

    /// Claim win if opponent didn't reveal in time.
    #[export]
    pub fn claim_timeout(&mut self, game_id: GameId) {
        let caller = msg::source();
        let mut data = self.data.borrow_mut();

        let game = data
            .games
            .get_mut(&game_id)
            .unwrap_or_else(|| panic!("Game {} not found", game_id));

        assert!(
            game.status == GameStatus::BothCommitted,
            "Game is not in BothCommitted state"
        );

        let deadline = game.committed_at_block.unwrap() + game.reveal_deadline_blocks;
        assert!(
            exec::block_height() > deadline,
            "Reveal deadline has not passed"
        );

        // Caller must have revealed, opponent must not have
        let (winner, loser) = if caller == game.creator
            && game.creator_move.is_some()
            && game.opponent_move.is_none()
        {
            (game.creator, game.opponent.unwrap())
        } else if Some(caller) == game.opponent
            && game.opponent_move.is_some()
            && game.creator_move.is_none()
        {
            (game.opponent.unwrap(), game.creator)
        } else {
            panic!(
                "Cannot claim timeout: either you haven't revealed or opponent already revealed"
            );
        };

        game.winner = Some(winner);
        game.result = Some(GameResult::Win);
        game.status = GameStatus::Settled;

        // Update leaderboard
        let stats = data.leaderboard.entry(winner).or_default();
        stats.wins += 1;
        stats.games_played += 1;
        let stats = data.leaderboard.entry(loser).or_default();
        stats.losses += 1;
        stats.games_played += 1;
    }

    // ── Queries ─────────────────────────────────────────────────────────

    /// Get info about a specific game.
    #[export]
    pub fn game_state(&self, game_id: GameId) -> Option<GameInfo> {
        self.data.borrow().games.get(&game_id).cloned()
    }

    /// Get the leaderboard sorted by wins.
    #[export]
    pub fn leaderboard(&self) -> Vec<(ActorId, PlayerStats)> {
        let data = self.data.borrow();
        let mut entries: Vec<_> = data
            .leaderboard
            .iter()
            .map(|(k, v)| (*k, v.clone()))
            .collect();
        entries.sort_by(|a, b| b.1.wins.cmp(&a.1.wins));
        entries
    }

    /// List games waiting for an opponent.
    #[export]
    pub fn open_games(&self) -> Vec<GameInfo> {
        self.data
            .borrow()
            .games
            .values()
            .filter(|g| g.status == GameStatus::WaitingForOpponent)
            .cloned()
            .collect()
    }

    /// List games for a specific player.
    #[export]
    pub fn my_games(&self, player: ActorId) -> Vec<GameInfo> {
        self.data
            .borrow()
            .games
            .values()
            .filter(|g| g.creator == player || g.opponent == Some(player))
            .cloned()
            .collect()
    }

    /// Helper: compute a commitment hash for a move and salt.
    /// Use this query to generate your commitment before creating/joining a game.
    #[export]
    pub fn compute_commitment(&self, mv: Move, salt: String) -> H256 {
        let mut data = mv.encode();
        data.extend_from_slice(salt.as_bytes());
        simple_hash(&data)
    }
}

// ── Program ─────────────────────────────────────────────────────────────────

use core::cell::UnsafeCell;

struct StaticData(UnsafeCell<Option<RefCell<ArenaData>>>);
unsafe impl Sync for StaticData {}

static ARENA_DATA: StaticData = StaticData(UnsafeCell::new(None));

fn arena_data() -> &'static RefCell<ArenaData> {
    unsafe {
        (*ARENA_DATA.0.get())
            .as_ref()
            .expect("Program not initialized")
    }
}

#[derive(Default)]
pub struct Program(());

#[sails_rs::program]
impl Program {
    /// Constructor: set reveal timeout in blocks (e.g., 100 blocks ≈ 5 minutes on Vara)
    pub fn new(reveal_timeout: u32) -> Self {
        unsafe {
            *ARENA_DATA.0.get() = Some(RefCell::new(ArenaData::new(reveal_timeout)));
        }
        Self(())
    }

    /// Exposed service
    pub fn rps(&self) -> RpsArenaService<'_> {
        RpsArenaService::new(arena_data())
    }
}
