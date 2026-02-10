from __future__ import annotations

from typing import Any
from collections.abc import Awaitable, Callable


MessageHandler = Callable[[str, dict[str, Any]], Awaitable[None]]


class BaseChatBroker:
    async def connect(self) -> None:
        raise NotImplementedError

    async def close(self) -> None:
        raise NotImplementedError

    async def publish(self, trade_id: str, message: dict[str, Any]) -> None:
        raise NotImplementedError

    async def add_participant(
        self, trade_id: str, identity_pubkey: str, chat_pubkey: str | None
    ) -> None:
        raise NotImplementedError

    async def remove_participant(
        self, trade_id: str, identity_pubkey: str, chat_pubkey: str | None
    ) -> None:
        raise NotImplementedError

    async def get_participants(self, trade_id: str) -> list[dict[str, Any]]:
        raise NotImplementedError

    async def listen(self, handler: MessageHandler) -> None:
        raise NotImplementedError


class NoopChatBroker(BaseChatBroker):
    async def connect(self) -> None:
        return None

    async def close(self) -> None:
        return None

    async def publish(self, trade_id: str, message: dict[str, Any]) -> None:
        return None

    async def add_participant(
        self, trade_id: str, identity_pubkey: str, chat_pubkey: str | None
    ) -> None:
        return None

    async def remove_participant(
        self, trade_id: str, identity_pubkey: str, chat_pubkey: str | None
    ) -> None:
        return None

    async def get_participants(self, trade_id: str) -> list[dict[str, Any]]:
        return []

    async def listen(self, handler: MessageHandler) -> None:
        return None
