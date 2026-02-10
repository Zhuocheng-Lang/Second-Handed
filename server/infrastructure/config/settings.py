from __future__ import annotations

from functools import lru_cache
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_title: str = "Second-hand Book Trading System"
    app_version: str = "1.0"
    allowed_origins: list[str] = Field(
        default_factory=lambda: [
            "http://127.0.0.1:5500",
            "http://localhost:5500",
        ]
    )

    db_host: str = "localhost"
    db_user: str = "root"
    db_password: str = "root"
    db_name: str = "second_hands"
    db_charset: str = "utf8mb4"
    db_pool_size: int = 10

    chat_broker_enabled: bool = True
    redis_url: str = "redis://localhost:6379/0"

    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def split_origins(cls, value: Any) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
