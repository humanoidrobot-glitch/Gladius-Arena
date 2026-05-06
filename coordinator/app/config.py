from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://gladius:gladius@localhost:5432/gladius"
    helius_api_key: str = ""
    helius_webhook_secret: str = ""
    helius_webhook_url: str = "http://localhost:8000/api/v1/webhooks/helius"
    rpc_url: str = "https://api.devnet.solana.com"
    jupiter_price_api_url: str = "https://lite-api.jup.ag/price/v3"
    jwt_secret: str = "dev-only-change-in-production-please-use-32-plus-bytes"
    jwt_ttl_seconds: int = 24 * 3600
    nonce_ttl_seconds: int = 5 * 60
    admin_wallet: str = ""


settings = Settings()
