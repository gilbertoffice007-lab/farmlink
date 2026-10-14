import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_ENV: str = "development"
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "farmlink"
    JWT_SECRET_KEY: str = "replace-with-a-secure-random-secret-min-32-chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    UPLOAD_DIR: str = "/tmp/farmlink-uploads" if os.getenv("VERCEL") else "./uploads"
    MAX_UPLOAD_MB: int = 5
    SEED_ADMIN_EMAIL: str = "admin@farmlink.example.com"
    SEED_ADMIN_PASSWORD: str = "change-me-before-deploy"

    @property
    def cors_origins_list(self) -> list:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
