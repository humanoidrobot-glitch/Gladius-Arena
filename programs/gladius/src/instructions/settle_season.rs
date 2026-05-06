use anchor_lang::prelude::*;

use crate::errors::GladiusError;
use crate::state::{Season, SeasonStatus, SEASON_SEED};

pub fn handler(ctx: Context<SettleSeason>) -> Result<()> {
    let season = &mut ctx.accounts.season;
    require!(
        season.status == SeasonStatus::Active,
        GladiusError::SeasonNotActive,
    );
    season.status = SeasonStatus::Settled;
    Ok(())
}

#[derive(Accounts)]
pub struct SettleSeason<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [SEASON_SEED, season.season_id.to_le_bytes().as_ref()],
        bump = season.bump,
        has_one = authority @ GladiusError::Unauthorized,
    )]
    pub season: Account<'info, Season>,
}
