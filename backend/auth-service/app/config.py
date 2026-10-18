from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configurações externas; nenhum segredo possui valor real no código."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    database_url: str = "postgresql://medicalfield_app:change-me@localhost:5432/medicalfield"
    jwt_private_key_path: Path = Path("./secrets/jwt-private.pem")
    jwt_public_key_path: Path = Path("./secrets/jwt-public.pem")
    jwt_issuer: str = "medicalfield-auth"
    jwt_audience: str = "medicalfield-services"
    access_token_minutes: int = Field(default=15, ge=5, le=60)
    refresh_token_hours: int = Field(default=12, ge=1, le=168)
    offline_grant_hours: int = Field(default=12, ge=1, le=72)
    service_name: str = "auth-service"


@lru_cache
def get_settings() -> Settings:
    return Settings()

