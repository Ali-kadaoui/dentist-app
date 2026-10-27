"""Application settings loaded from environment variables or a .env file."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the SMS gateway."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    transport: Literal["at", "hilink"] = "at"

    # AT command mode (pyserial). The Huawei E173z-1 exposes AT commands on a
    # USB COM port (usually "HUAWEI Mobile Connect - 3G Modem").
    at_port: str = "COM3"
    at_baud: int = Field(default=115200, ge=1200)
    at_command_timeout: float = Field(default=5.0, gt=0)
    at_send_timeout: float = Field(default=30.0, gt=0)
    at_retries: int = Field(default=1, ge=0, le=3)
    at_retry_delay: float = Field(default=3.0, ge=0)
    at_smsc: str | None = None

    # HiLink HTTP mode.
    hilink_base_url: str = "http://192.168.8.1"
    hilink_username: str | None = None
    hilink_password: str | None = None
    hilink_timeout: float = Field(default=15.0, gt=0)
    hilink_content_type: str = "text/xml"
    hilink_content_base64: bool = False

    # HTTP API behaviour.
    api_key: str | None = None
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    send_lock_timeout: float = Field(default=5.0, gt=0)
    max_sms_length: int = Field(default=160, ge=1, le=1000)
    log_level: str = "INFO"

    @field_validator("hilink_base_url")
    @classmethod
    def _strip_trailing_slash(cls, value: str) -> str:
        return value.rstrip("/")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
