use anchor_lang::prelude::*;

use crate::errors::GladiusError;
use crate::state::{
    Agent, Season, SeasonEntry, SeasonStatus, AGENT_SEED, SEASON_ENTRY_SEED, SEASON_SEED,
};

pub fn handler(ctx: Context<JoinSeason>) -> Result<()> {
    let season = &mut ctx.accounts.season;
    let agent = &mut ctx.accounts.agent;
    let entry = &mut ctx.accounts.entry;

    require!(
        matches!(season.status, SeasonStatus::Pending | SeasonStatus::Active),
        GladiusError::SeasonNotJoinable,
    );
    require!(
        season.agent_count < season.config.max_agents,
        GladiusError::SeasonFull,
    );

    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp < season.end_time,
        GladiusError::SeasonExpired,
    );

    entry.agent = agent.key();
    entry.season = season.key();
    entry.wallet = agent.authority;
    entry.score = None;
    entry.attestation = None;
    entry.joined_at = clock.unix_timestamp;
    entry.bump = ctx.bumps.entry;

    season.agent_count = season
        .agent_count
        .checked_add(1)
        .ok_or(GladiusError::Overflow)?;
    agent.total_seasons = agent
        .total_seasons
        .checked_add(1)
        .ok_or(GladiusError::Overflow)?;

    Ok(())
}

#[derive(Accounts)]
pub struct JoinSeason<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [AGENT_SEED, authority.key().as_ref()],
        bump = agent.bump,
        has_one = authority,
    )]
    pub agent: Account<'info, Agent>,

    #[account(
        mut,
        seeds = [SEASON_SEED, season.season_id.to_le_bytes().as_ref()],
        bump = season.bump,
    )]
    pub season: Account<'info, Season>,

    #[account(
        init,
        payer = authority,
        space = 8 + SeasonEntry::INIT_SPACE,
        seeds = [
            SEASON_ENTRY_SEED,
            season.season_id.to_le_bytes().as_ref(),
            agent.key().as_ref(),
        ],
        bump,
    )]
    pub entry: Account<'info, SeasonEntry>,

    pub system_program: Program<'info, System>,
}
