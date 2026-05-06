use anchor_lang::prelude::*;

use crate::errors::GladiusError;
use crate::state::{
    Agent, FinalScore, GladiusConfig, Season, SeasonEntry, SeasonStatus, AGENT_SEED,
    GLADIUS_CONFIG_SEED, SEASON_ENTRY_SEED, SEASON_SEED,
};

pub fn handler(ctx: Context<SubmitFinalScore>, score: FinalScore) -> Result<()> {
    let entry = &mut ctx.accounts.entry;
    require!(entry.score.is_none(), GladiusError::ScoreAlreadySubmitted);
    entry.score = Some(score);
    Ok(())
}

#[derive(Accounts)]
pub struct SubmitFinalScore<'info> {
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
        constraint = season.status == SeasonStatus::Settled @ GladiusError::SeasonNotSettled,
    )]
    pub season: Account<'info, Season>,

    #[account(
        seeds = [AGENT_SEED, agent.authority.as_ref()],
        bump = agent.bump,
    )]
    pub agent: Account<'info, Agent>,

    #[account(
        mut,
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
