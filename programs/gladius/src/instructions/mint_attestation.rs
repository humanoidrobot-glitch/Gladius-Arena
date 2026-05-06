//! Mint a Metaplex Core attestation asset for a settled SeasonEntry.
//!
//! The asset is non-transferable from day one (FreezeDelegate plugin
//! frozen=true) so the credential can't be sold, gifted, or laundered —
//! it represents this specific agent's recorded performance, full stop.
//!
//! Update authority is `gladius_config` (a PDA), so future plugin or
//! metadata corrections — e.g. metadata-uri pointing at a renderer that
//! gets re-hosted — can be performed by the Gladius authority without
//! touching the agent owner's signing keys.

use anchor_lang::prelude::*;
use mpl_core::{
    instructions::CreateV2CpiBuilder,
    types::{DataState, FreezeDelegate, Plugin, PluginAuthority, PluginAuthorityPair},
    ID as MPL_CORE_ID,
};

use crate::errors::GladiusError;
use crate::state::{
    Agent, GladiusConfig, Season, SeasonEntry, AGENT_SEED, GLADIUS_CONFIG_SEED,
    SEASON_ENTRY_SEED, SEASON_SEED,
};

pub fn handler(ctx: Context<MintAttestation>, metadata_uri: String) -> Result<()> {
    let _score = ctx
        .accounts
        .entry
        .score
        .ok_or(GladiusError::ScoreNotSubmitted)?;

    let season_id = ctx.accounts.season.season_id;
    let agent_name = ctx.accounts.agent.name.clone();
    let asset_name = format!("Gladius S{} — {}", season_id, agent_name);

    let plugins = vec![PluginAuthorityPair {
        plugin: Plugin::FreezeDelegate(FreezeDelegate { frozen: true }),
        authority: Some(PluginAuthority::UpdateAuthority),
    }];

    let config_bump = ctx.accounts.gladius_config.bump;
    let bump_slice = [config_bump];
    let config_signer_seeds: &[&[u8]] = &[GLADIUS_CONFIG_SEED, &bump_slice];
    let signer_seeds: &[&[&[u8]]] = &[config_signer_seeds];

    CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program)
        .asset(&ctx.accounts.asset)
        .collection(None)
        .authority(Some(&ctx.accounts.gladius_config.to_account_info()))
        .payer(&ctx.accounts.authority)
        .owner(Some(&ctx.accounts.agent_owner))
        .update_authority(Some(&ctx.accounts.gladius_config.to_account_info()))
        .system_program(&ctx.accounts.system_program)
        .data_state(DataState::AccountState)
        .name(asset_name)
        .uri(metadata_uri)
        .plugins(plugins)
        .invoke_signed(signer_seeds)?;

    emit!(AttestationMinted {
        season_id,
        agent: ctx.accounts.agent.key(),
        asset: ctx.accounts.asset.key(),
    });
    Ok(())
}

#[event]
pub struct AttestationMinted {
    pub season_id: u64,
    pub agent: Pubkey,
    pub asset: Pubkey,
}

#[derive(Accounts)]
pub struct MintAttestation<'info> {
    #[account(mut)]
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

    /// CHECK: a fresh keypair signing into a new Core asset account.
    #[account(mut, signer)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: must be the agent's owning wallet — receives the NFT.
    #[account(address = agent.authority)]
    pub agent_owner: UncheckedAccount<'info>,

    /// CHECK: pinned to the deployed mpl-core program.
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
