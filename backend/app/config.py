import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    MONGODB_URI: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "electricity_collection"
    JWT_SECRET: str = "super-secret-jwt-key-change-in-production-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours
    GOOGLE_MAPS_API_KEY: str = ""
    GOOGLE_MAPS_SERVER_API_KEY: str = ""
    ALLOWED_ORIGINS: str = "*"

    @property
    def maps_key(self) -> str:
        return self.GOOGLE_MAPS_SERVER_API_KEY or self.GOOGLE_MAPS_API_KEY

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
