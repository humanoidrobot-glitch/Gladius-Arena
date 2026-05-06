from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://gladius:gladius@localhost:5432/gladius"
    helius_api_key: str = ""
    helius_webhook_secret: str = ""
    rpc_url: str = "https://api.devnet.solana.com"


settings = Settings()
