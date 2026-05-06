use anchor_lang::prelude::*;

use crate::errors::GladiusError;
use crate::state::{Season, SeasonStatus, SEASON_SEED};

pub fn handler(ctx: Context<StartSeason>) -> Result<()> {
    let season = &mut ctx.accounts.season;
    require!(
        season.status == SeasonStatus::Pending,
        GladiusError::SeasonNotPending,
    );

    let clock = Clock::get()?;
    require!(
        season.end_time > clock.unix_timestamp,
        GladiusError::InvalidEndTime,
    );

    season.status = SeasonStatus::Active;
    season.start_time = Some(clock.unix_timestamp);
    Ok(())
}

#[derive(Accounts)]
pub struct StartSeason<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [SEASON_SEED, season.season_id.to_le_bytes().as_ref()],
        bump = season.bump,
        has_one = authority @ GladiusError::Unauthorized,
    )]
    pub season: Account<'info, Season>,
}
