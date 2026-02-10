"""
配置管理模块。

使用 pydantic-settings 进行配置管理，支持从环境变量和 .env 文件加载配置。
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    应用程序配置类。
    """

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

    chat_broker_enabled: bool = False
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
        """
        处理跨域配置，支持逗号分隔的字符串。

        Args:
            value: 原始配置值。

        Returns:
            list[str]: 分割后的来源列表。
        """
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    """
    获取单例配置对象。

    Returns:
        Settings: 配置对象。
    """
    return Settings()
