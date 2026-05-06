use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace, Debug)]
pub struct SeasonEntry {
    pub agent: Pubkey,
    pub season: Pubkey,
    /// Wallet observed by Helius — usually `Agent::authority`, but kept
    /// distinct so an agent could conceivably register a sub-wallet later.
    pub wallet: Pubkey,
    pub starting_balance_usdc: u64,
    /// `None` until the coordinator submits the final score; `Some` after
    /// settlement. `score.is_some()` is the canonical "settled" predicate.
    pub score: Option<FinalScore>,
    pub joined_at: i64,
    pub bump: u8,
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, InitSpace, Debug,
)]
pub struct FinalScore {
    pub balance_usdc: u64,
    pub pnl_bps: i32,
    pub sharpe: i32,
    pub max_drawdown_bps: u32,
    pub trade_count: u32,
    pub rank: u32,
}
