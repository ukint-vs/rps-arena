use rps_arena_client::{
    GameInfo, GameResult, GameStatus, Move, PlayerStats, RpsArenaClient, RpsArenaClientCtors,
    RpsArenaClientProgram, rps::Rps as RpsTrait,
};
use sails_rs::client::{Actor, GearEnv, GtestEnv};
use sails_rs::prelude::*;

const PLAYER_1: u64 = 42;
const PLAYER_2: u64 = 43;
const REVEAL_TIMEOUT: u32 = 10;

fn compute_commitment(mv: &Move, salt: &str) -> H256 {
    let mut data = mv.encode();
    data.extend_from_slice(salt.as_bytes());
    let mut result = [0u8; 32];
    for (i, &byte) in data.iter().enumerate() {
        let idx = i % 32;
        result[idx] ^= byte;
        result[(idx + 1) % 32] =
            result[(idx + 1) % 32].wrapping_add(byte.wrapping_mul((i as u8).wrapping_add(1)));
    }
    H256::from(result)
}

type RpsActor = Actor<RpsArenaClientProgram, GtestEnv>;
type RpsSvc = sails_rs::client::Service<rps_arena_client::rps::RpsImpl, GtestEnv>;

async fn deploy() -> (GtestEnv, RpsActor, RpsActor) {
    let system = sails_rs::gtest::System::new();
    system.init_logger();
    system.mint_to(PLAYER_1, 1_000_000_000_000_000);
    system.mint_to(PLAYER_2, 1_000_000_000_000_000);

    let env1 = GtestEnv::new(system, PLAYER_1.into());

    let wasm_path = concat!(
        env!("CARGO_TARGET_DIR"),
        "/wasm32-unknown-unknown/wasm32-gear/debug/rps_arena.opt.wasm"
    );
    let code_id = env1.system().submit_code_file(wasm_path);

    let deployment = env1.deploy::<RpsArenaClientProgram>(code_id, b"salt1234".to_vec());
    let ctor = deployment.new(REVEAL_TIMEOUT);
    let actor1: RpsActor = ctor.create_program().unwrap().await.unwrap();

    let env2 = env1.clone().with_actor_id(PLAYER_2.into());
    let actor2: RpsActor = Actor::new(env2, actor1.id());

    (env1, actor1, actor2)
}

#[tokio::test]
async fn test_create_game() {
    let (_env, actor1, _actor2): (GtestEnv, RpsActor, RpsActor) = deploy().await;
    let mut svc: RpsSvc = actor1.rps();

    let commitment = compute_commitment(&Move::Rock, "my_salt");
    let game_id: u64 = svc.create_game(commitment).await.unwrap();
    assert_eq!(game_id, 1);

    let game: Option<GameInfo> = svc.game_state(game_id).query().unwrap();
    let game = game.unwrap();
    assert_eq!(game.status, GameStatus::WaitingForOpponent);
    assert_eq!(game.creator, ActorId::from(PLAYER_1));
}

#[tokio::test]
async fn test_open_games() {
    let (_env, actor1, _actor2): (GtestEnv, RpsActor, RpsActor) = deploy().await;
    let mut svc: RpsSvc = actor1.rps();

    let c = compute_commitment(&Move::Rock, "salt1");
    let _: u64 = svc.create_game(c).await.unwrap();

    let open: Vec<GameInfo> = svc.open_games().query().unwrap();
    assert_eq!(open.len(), 1);
}

#[tokio::test]
async fn test_join_game() {
    let (_env, actor1, actor2): (GtestEnv, RpsActor, RpsActor) = deploy().await;

    let mut svc1: RpsSvc = actor1.rps();
    let c1 = compute_commitment(&Move::Rock, "salt1");
    let game_id: u64 = svc1.create_game(c1).await.unwrap();

    let mut svc2: RpsSvc = actor2.rps();
    let c2 = compute_commitment(&Move::Paper, "salt2");
    let _: () = svc2.join_game(game_id, c2).await.unwrap();

    let game: Option<GameInfo> = svc1.game_state(game_id).query().unwrap();
    let game = game.unwrap();
    assert_eq!(game.status, GameStatus::BothCommitted);
    assert_eq!(game.opponent, Some(ActorId::from(PLAYER_2)));
}

#[tokio::test]
async fn test_creator_wins() {
    let (_env, actor1, actor2): (GtestEnv, RpsActor, RpsActor) = deploy().await;

    let mut svc1: RpsSvc = actor1.rps();
    let mut svc2: RpsSvc = actor2.rps();

    let c1 = compute_commitment(&Move::Rock, "s1");
    let game_id: u64 = svc1.create_game(c1).await.unwrap();

    let c2 = compute_commitment(&Move::Scissors, "s2");
    let _: () = svc2.join_game(game_id, c2).await.unwrap();

    let _: () = svc1.reveal(game_id, Move::Rock, "s1".into()).await.unwrap();
    let _: () = svc2
        .reveal(game_id, Move::Scissors, "s2".into())
        .await
        .unwrap();

    let game: Option<GameInfo> = svc1.game_state(game_id).query().unwrap();
    let game = game.unwrap();
    assert_eq!(game.status, GameStatus::Settled);
    assert_eq!(game.result, Some(GameResult::Win));
    assert_eq!(game.winner, Some(ActorId::from(PLAYER_1)));

    let lb: Vec<(ActorId, PlayerStats)> = svc1.leaderboard().query().unwrap();
    let p1 = lb
        .iter()
        .find(|(id, _)| *id == ActorId::from(PLAYER_1))
        .unwrap();
    assert_eq!(p1.1.wins, 1);
    assert_eq!(p1.1.games_played, 1);
}

#[tokio::test]
async fn test_opponent_wins() {
    let (_env, actor1, actor2): (GtestEnv, RpsActor, RpsActor) = deploy().await;

    let mut svc1: RpsSvc = actor1.rps();
    let mut svc2: RpsSvc = actor2.rps();

    let c1 = compute_commitment(&Move::Paper, "s1");
    let game_id: u64 = svc1.create_game(c1).await.unwrap();

    let c2 = compute_commitment(&Move::Scissors, "s2");
    let _: () = svc2.join_game(game_id, c2).await.unwrap();

    let _: () = svc1
        .reveal(game_id, Move::Paper, "s1".into())
        .await
        .unwrap();
    let _: () = svc2
        .reveal(game_id, Move::Scissors, "s2".into())
        .await
        .unwrap();

    let game: Option<GameInfo> = svc1.game_state(game_id).query().unwrap();
    let game = game.unwrap();
    assert_eq!(game.result, Some(GameResult::Lose));
    assert_eq!(game.winner, Some(ActorId::from(PLAYER_2)));
}

#[tokio::test]
async fn test_draw() {
    let (_env, actor1, actor2): (GtestEnv, RpsActor, RpsActor) = deploy().await;

    let mut svc1: RpsSvc = actor1.rps();
    let mut svc2: RpsSvc = actor2.rps();

    let c1 = compute_commitment(&Move::Paper, "s1");
    let game_id: u64 = svc1.create_game(c1).await.unwrap();

    let c2 = compute_commitment(&Move::Paper, "s2");
    let _: () = svc2.join_game(game_id, c2).await.unwrap();

    let _: () = svc1
        .reveal(game_id, Move::Paper, "s1".into())
        .await
        .unwrap();
    let _: () = svc2
        .reveal(game_id, Move::Paper, "s2".into())
        .await
        .unwrap();

    let game: Option<GameInfo> = svc1.game_state(game_id).query().unwrap();
    let game = game.unwrap();
    assert_eq!(game.result, Some(GameResult::Draw));
    assert_eq!(game.winner, None);
}

#[tokio::test]
async fn test_cancel_game() {
    let (_env, actor1, _actor2): (GtestEnv, RpsActor, RpsActor) = deploy().await;
    let mut svc: RpsSvc = actor1.rps();

    let c = compute_commitment(&Move::Rock, "salt");
    let game_id: u64 = svc.create_game(c).await.unwrap();

    let _: () = svc.cancel_game(game_id).await.unwrap();

    let game: Option<GameInfo> = svc.game_state(game_id).query().unwrap();
    assert_eq!(game.unwrap().status, GameStatus::Cancelled);
}

#[tokio::test]
async fn test_commitment_verification() {
    let (_env, actor1, _actor2): (GtestEnv, RpsActor, RpsActor) = deploy().await;
    let svc: RpsSvc = actor1.rps();

    let on_chain: H256 = svc
        .compute_commitment(Move::Rock, "test_salt".into())
        .query()
        .unwrap();

    let local = compute_commitment(&Move::Rock, "test_salt");
    assert_eq!(on_chain, local);
}
