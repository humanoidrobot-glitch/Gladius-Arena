use anchor_lang::prelude::*;

#[error_code]
pub enum GladiusError {
    #[msg("Caller is not the configured authority")]
    Unauthorized,
    #[msg("Numeric overflow")]
    Overflow,
    #[msg("Agent name exceeds maximum length")]
    NameTooLong,
    #[msg("Agent metadata URI exceeds maximum length")]
    MetadataUriTooLong,
    #[msg("Season name exceeds maximum length")]
    SeasonNameTooLong,
    #[msg("Season description exceeds maximum length")]
    DescriptionTooLong,
    #[msg("Trading universe exceeds maximum length")]
    TradingUniverseTooLarge,
    #[msg("Season config is invalid")]
    InvalidSeasonConfig,
    #[msg("Season end time must be in the future")]
    InvalidEndTime,
    #[msg("Season is not accepting new entries")]
    SeasonNotJoinable,
    #[msg("Season has reached its participant cap")]
    SeasonFull,
    #[msg("Season is not in Pending status")]
    SeasonNotPending,
    #[msg("Season is not in Active status")]
    SeasonNotActive,
}
