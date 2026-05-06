//! Sprint 1.5 stub — Sprint 5 replaces this body with an mpl-core CPI.

use anchor_lang::prelude::*;

use crate::errors::GladiusError;
use crate::state::{
    Agent, GladiusConfig, Season, SeasonEntry, AGENT_SEED, GLADIUS_CONFIG_SEED,
    SEASON_ENTRY_SEED, SEASON_SEED,
};

pub fn handler(ctx: Context<MintAttestation>) -> Result<()> {
    ctx.accounts
        .entry
        .score
        .ok_or(GladiusError::ScoreNotSubmitted)?;
    emit!(AttestationMinted {
        season_id: ctx.accounts.season.season_id,
        agent: ctx.accounts.agent.key(),
    });
    Ok(())
}

#[event]
pub struct AttestationMinted {
    pub season_id: u64,
    pub agent: Pubkey,
}

#[derive(Accounts)]
pub struct MintAttestation<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [GLADIUS_CONFIG_SEED],
        bump = gladius_config.bump,
        has_one = authority @ GladiusError::Unauthorized,
    )]
    pub gladius_config: Account<'info, GladiusConfig>,

    #[account(
        seeds = [SEASON_SEED, season.season_id.to_le_bytes().as_ref()],
        bump = season.bump,
    )]
    pub season: Account<'info, Season>,

    #[account(
        seeds = [AGENT_SEED, agent.authority.as_ref()],
        bump = agent.bump,
    )]
    pub agent: Account<'info, Agent>,

    #[account(
        seeds = [
            SEASON_ENTRY_SEED,
            season.season_id.to_le_bytes().as_ref(),
            agent.key().as_ref(),
        ],
        bump = entry.bump,
        has_one = season,
        has_one = agent,
    )]
    pub entry: Account<'info, SeasonEntry>,
}
