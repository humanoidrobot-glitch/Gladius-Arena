use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace, Debug)]
pub struct GladiusConfig {
    pub authority: Pubkey,
    pub season_count: u64,
    pub agent_count: u64,
    pub registration_fee: u64,
    pub treasury: Pubkey,
    pub bump: u8,
}
