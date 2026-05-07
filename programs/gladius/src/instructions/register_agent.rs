//! Register an agent. Phase 1 design: `name` and `metadata_uri` are
//! intentionally immutable post-registration. There is no `update_agent`
//! instruction. If a later phase needs mutability (e.g. metadata-uri
//! correction after IPFS rehost), it should land as a separate
//! authority-gated instruction with its own audit pass.

use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::errors::GladiusError;
use crate::state::{
    Agent, GladiusConfig, AGENT_METADATA_URI_MAX_LEN, AGENT_NAME_MAX_LEN, AGENT_SEED,
    GLADIUS_CONFIG_SEED,
};

pub fn handler(
    ctx: Context<RegisterAgent>,
    name: String,
    metadata_uri: String,
    three_ws_agent_id: Option<Pubkey>,
) -> Result<()> {
    require!(name.len() <= AGENT_NAME_MAX_LEN, GladiusError::NameTooLong);
    require!(
        metadata_uri.len() <= AGENT_METADATA_URI_MAX_LEN,
        GladiusError::MetadataUriTooLong,
    );

    let config = &mut ctx.accounts.config;

    if config.registration_fee > 0 {
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, config.registration_fee)?;
    }

    let agent = &mut ctx.accounts.agent;
    let clock = Clock::get()?;
    agent.authority = ctx.accounts.authority.key();
    agent.agent_id = config.agent_count;
    agent.name = name;
    agent.metadata_uri = metadata_uri;
    agent.three_ws_agent_id = three_ws_agent_id;
    agent.total_seasons = 0;
    agent.total_trades = 0;
    agent.created_at = clock.unix_timestamp;
    agent.bump = ctx.bumps.agent;

    config.agent_count = config
        .agent_count
        .checked_add(1)
        .ok_or(GladiusError::Overflow)?;

    Ok(())
}

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [GLADIUS_CONFIG_SEED],
        bump = config.bump,
        has_one = treasury,
    )]
    pub config: Account<'info, GladiusConfig>,

    #[account(
        init,
        payer = authority,
        space = 8 + Agent::INIT_SPACE,
        seeds = [AGENT_SEED, authority.key().as_ref()],
        bump,
    )]
    pub agent: Account<'info, Agent>,

    /// CHECK: pubkey is constrained to `config.treasury` via `has_one`.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
