use anchor_lang::prelude::*;

use crate::errors::GladiusError;
use crate::state::{
    GladiusConfig, Season, SeasonConfig, SeasonStatus, GLADIUS_CONFIG_SEED, SEASON_NAME_MAX_LEN,
    SEASON_SEED, SEASON_DESCRIPTION_MAX_LEN, TRADING_UNIVERSE_MAX_LEN,
};

pub fn handler(
    ctx: Context<CreateSeason>,
    config: SeasonConfig,
    end_time: i64,
) -> Result<()> {
    require!(
        config.name.len() <= SEASON_NAME_MAX_LEN,
        GladiusError::SeasonNameTooLong,
    );
    require!(
        config.description.len() <= SEASON_DESCRIPTION_MAX_LEN,
        GladiusError::DescriptionTooLong,
    );
    require!(
        config.trading_universe.len() <= TRADING_UNIVERSE_MAX_LEN,
        GladiusError::TradingUniverseTooLarge,
    );
    require!(config.max_agents > 0, GladiusError::InvalidSeasonConfig);

    let clock = Clock::get()?;
    require!(end_time > clock.unix_timestamp, GladiusError::InvalidEndTime);

    let admin_config = &mut ctx.accounts.gladius_config;
    let season = &mut ctx.accounts.season;

    season.season_id = admin_config.season_count;
    season.authority = ctx.accounts.authority.key();
    season.status = SeasonStatus::Pending;
    season.config = config;
    season.start_time = None;
    season.end_time = end_time;
    season.agent_count = 0;
    season.created_at = clock.unix_timestamp;
    season.bump = ctx.bumps.season;

    admin_config.season_count = admin_config
        .season_count
        .checked_add(1)
        .ok_or(GladiusError::Overflow)?;

    Ok(())
}

#[derive(Accounts)]
pub struct CreateSeason<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [GLADIUS_CONFIG_SEED],
        bump = gladius_config.bump,
        has_one = authority @ GladiusError::Unauthorized,
    )]
    pub gladius_config: Account<'info, GladiusConfig>,

    #[account(
        init,
        payer = authority,
        space = 8 + Season::INIT_SPACE,
        seeds = [SEASON_SEED, gladius_config.season_count.to_le_bytes().as_ref()],
        bump,
    )]
    pub season: Account<'info, Season>,

    pub system_program: Program<'info, System>,
}
