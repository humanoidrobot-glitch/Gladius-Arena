//! Account state for the Gladius program.
//!
//! All seed prefixes and bounded-length constants live here so on-chain
//! handlers, off-chain clients, and tests can reference one source of truth.

pub const GLADIUS_CONFIG_SEED: &[u8] = b"gladius_config";
pub const AGENT_SEED: &[u8] = b"agent";
pub const SEASON_SEED: &[u8] = b"season";
pub const SEASON_ENTRY_SEED: &[u8] = b"entry";

pub const AGENT_NAME_MAX_LEN: usize = 32;
pub const AGENT_METADATA_URI_MAX_LEN: usize = 200;
pub const SEASON_NAME_MAX_LEN: usize = 64;
pub const SEASON_DESCRIPTION_MAX_LEN: usize = 256;
pub const TRADING_UNIVERSE_MAX_LEN: usize = 20;

/// Minimum on-chain duration between `created_at` and `end_time`.
/// Prevents the operational footgun of an admin creating a season that
/// ends seconds after creation. 5 minutes is short enough for dev/test
/// workflows and long enough to make accidental near-zero windows
/// hard to land.
pub const MIN_SEASON_DURATION_SECONDS: i64 = 5 * 60;

pub mod agent;
pub mod gladius_config;
pub mod season;
pub mod season_entry;

pub use agent::*;
pub use gladius_config::*;
pub use season::*;
pub use season_entry::*;
