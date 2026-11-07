from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///data/app.db"
    cors_origin: str = "http://localhost:5173"
    # Generous defaults — a dev/CRUD baseline, not a hard guard.
    rate_limit_max: int = 300
    rate_limit_window_minutes: int = 15

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
