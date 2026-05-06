use anchor_lang::prelude::*;

use crate::state::{GladiusConfig, GLADIUS_CONFIG_SEED};

pub fn handler(
    ctx: Context<Initialize>,
    registration_fee: u64,
    treasury: Pubkey,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.season_count = 0;
    config.agent_count = 0;
    config.registration_fee = registration_fee;
    config.treasury = treasury;
    config.bump = ctx.bumps.config;
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + GladiusConfig::INIT_SPACE,
        seeds = [GLADIUS_CONFIG_SEED],
        bump,
    )]
    pub config: Account<'info, GladiusConfig>,

    pub system_program: Program<'info, System>,
}
