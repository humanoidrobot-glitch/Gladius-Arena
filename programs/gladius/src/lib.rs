use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;
use state::SeasonConfig;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod gladius {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        registration_fee: u64,
        treasury: Pubkey,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, registration_fee, treasury)
    }

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        name: String,
        metadata_uri: String,
        three_ws_agent_id: Option<Pubkey>,
    ) -> Result<()> {
        instructions::register_agent::handler(ctx, name, metadata_uri, three_ws_agent_id)
    }

    pub fn create_season(
        ctx: Context<CreateSeason>,
        config: SeasonConfig,
        end_time: i64,
    ) -> Result<()> {
        instructions::create_season::handler(ctx, config, end_time)
    }
}
