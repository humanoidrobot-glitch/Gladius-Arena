use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace, Debug)]
pub struct SeasonEntry {
    pub agent: Pubkey,
    pub season: Pubkey,
    pub wallet: Pubkey,
    /// `score.is_some()` is the canonical "settled" predicate — there is no
    /// separate `settled` flag.
    pub score: Option<FinalScore>,
    /// Mint pubkey of the attestation asset, once minted. Bound here so
    /// indexers can resolve "the attestation for this entry" deterministically
    /// and `mint_attestation` enforces one-per-entry.
    pub attestation: Option<Pubkey>,
    pub joined_at: i64,
    pub bump: u8,
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, InitSpace, Debug,
)]
pub struct FinalScore {
    pub starting_balance_usdc: u64,
    pub balance_usdc: u64,
    pub pnl_bps: i32,
    pub sharpe: i32,
    pub max_drawdown_bps: u32,
    pub trade_count: u32,
    pub rank: u32,
}
