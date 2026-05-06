use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;
use state::{FinalScore, SeasonConfig};

declare_id!("6R9YnVRjEryqxDbE4p6PQvP6PaPuXKhntojAU7RzmSDA");

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

    pub fn join_season(ctx: Context<JoinSeason>) -> Result<()> {
        instructions::join_season::handler(ctx)
    }

    pub fn start_season(ctx: Context<StartSeason>) -> Result<()> {
        instructions::start_season::handler(ctx)
    }

    pub fn settle_season(ctx: Context<SettleSeason>) -> Result<()> {
        instructions::settle_season::handler(ctx)
    }

    pub fn submit_final_score(
        ctx: Context<SubmitFinalScore>,
        score: FinalScore,
    ) -> Result<()> {
        instructions::submit_final_score::handler(ctx, score)
    }

    pub fn mint_attestation(
        ctx: Context<MintAttestation>,
        metadata_uri: String,
    ) -> Result<()> {
        instructions::mint_attestation::handler(ctx, metadata_uri)
    }
}
