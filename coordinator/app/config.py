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
    # Snapshot worker interval. 0 disables the worker (useful for tests
    # and for running a coordinator that only serves the API + WS).
    snapshot_interval_seconds: int = 60

    # Custom-GLB avatar uploads. Local-disk backend by default — set to
    # an absolute path or leave as a relative dir for dev.
    avatar_storage_dir: str = "./uploads/avatars"
    avatar_max_bytes: int = 50 * 1024 * 1024  # 50 MB
    avatar_url_prefix: str = "/api/v1/avatars/files"


settings = Settings()
