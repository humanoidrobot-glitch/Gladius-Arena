use anchor_lang::prelude::*;

use crate::state::{
    SEASON_DESCRIPTION_MAX_LEN, SEASON_NAME_MAX_LEN, TRADING_UNIVERSE_MAX_LEN,
};

#[account]
#[derive(InitSpace, Debug)]
pub struct Season {
    pub season_id: u64,
    pub authority: Pubkey,
    pub status: SeasonStatus,
    pub config: SeasonConfig,
    /// `None` until `start_season` runs; `Some(unix_ts)` after.
    pub start_time: Option<i64>,
    pub end_time: i64,
    pub agent_count: u32,
    pub created_at: i64,
    pub bump: u8,
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug,
)]
pub enum SeasonStatus {
    Pending,
    Active,
    Settled,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace, Debug)]
pub struct SeasonConfig {
    #[max_len(SEASON_NAME_MAX_LEN)]
    pub name: String,
    #[max_len(SEASON_DESCRIPTION_MAX_LEN)]
    pub description: String,
    #[max_len(TRADING_UNIVERSE_MAX_LEN)]
    pub trading_universe: Vec<Pubkey>,
    pub max_agents: u32,
    pub scoring_method: ScoringMethod,
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug,
)]
pub enum ScoringMethod {
    Pnl,
    Sharpe,
    RiskAdjusted,
}
