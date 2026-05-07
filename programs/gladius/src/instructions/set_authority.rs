//! Rotate the GladiusConfig authority. The current authority signs and
//! names a new pubkey (typically a Squads multisig at mainnet handover).
//! Lost-keys = bricked program without this — every admin instruction
//! gates on `has_one = authority @ Unauthorized`.

use anchor_lang::prelude::*;

use crate::errors::GladiusError;
use crate::state::{GladiusConfig, GLADIUS_CONFIG_SEED};

pub fn handler(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.authority = new_authority;

    emit!(AuthorityRotated {
        old_authority: ctx.accounts.authority.key(),
        new_authority,
    });
    Ok(())
}

#[event]
pub struct AuthorityRotated {
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}

#[derive(Accounts)]
pub struct SetAuthority<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [GLADIUS_CONFIG_SEED],
        bump = config.bump,
        has_one = authority @ GladiusError::Unauthorized,
    )]
    pub config: Account<'info, GladiusConfig>,
}
