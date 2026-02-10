"""
日志配置文件。

负责配置应用程序的日志格式、级别和处理器。
"""

from __future__ import annotations

import logging.config


def configure_logging(level: str) -> None:
    """
    配置日志系统。

    Args:
        level: 日志级别（如 "INFO", "DEBUG", "ERROR"）。
    """
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "standard": {
                    "format": "%(asctime)s %(levelname)s %(name)s: %(message)s",
                }
            },
            "handlers": {
                "default": {
                    "class": "logging.StreamHandler",
                    "formatter": "standard",
                }
            },
            "root": {
                "handlers": ["default"],
                "level": level,
            },
        }
    )
