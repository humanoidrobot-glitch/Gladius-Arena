use anchor_lang::prelude::*;

use crate::state::{AGENT_METADATA_URI_MAX_LEN, AGENT_NAME_MAX_LEN};

#[account]
#[derive(InitSpace, Debug)]
pub struct Agent {
    pub authority: Pubkey,
    pub agent_id: u64,
    #[max_len(AGENT_NAME_MAX_LEN)]
    pub name: String,
    #[max_len(AGENT_METADATA_URI_MAX_LEN)]
    pub metadata_uri: String,
    pub three_ws_agent_id: Option<Pubkey>,
    pub total_seasons: u32,
    pub total_trades: u64,
    pub created_at: i64,
    pub bump: u8,
}
