from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://medicalfield_app:change-me@localhost:5432/medicalfield"
    jwt_public_key_path: Path = Path("../auth-service/secrets/jwt-public.pem")
    jwt_issuer: str = "medicalfield-auth"
    jwt_audience: str = "medicalfield-services"
    service_name: str = "medication-service"


@lru_cache
def get_settings() -> Settings:
    return Settings()

