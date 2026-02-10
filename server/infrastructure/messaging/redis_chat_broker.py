from __future__ import annotations

import json
from typing import Any

import redis.asyncio as redis

from server.application.chat.broker import BaseChatBroker, MessageHandler


class RedisChatBroker(BaseChatBroker):
    def __init__(self, redis_url: str, channel_prefix: str = "chat") -> None:
        self._redis_url = redis_url
        self._channel_prefix = channel_prefix
        self._redis: Any | None = None
        self._pubsub: Any | None = None

    async def connect(self) -> None:
        self._redis = redis.from_url(self._redis_url, decode_responses=True)
        assert self._redis is not None
        self._pubsub = self._redis.pubsub()
        assert self._pubsub is not None
        await self._pubsub.psubscribe(f"{self._channel_prefix}:*")

    async def close(self) -> None:
        if self._pubsub is not None:
            await self._pubsub.close()
        if self._redis is not None:
            await self._redis.close()
            await self._redis.connection_pool.disconnect()

    async def publish(self, trade_id: str, message: dict[str, Any]) -> None:
        if self._redis is None:
            raise RuntimeError("Redis broker not initialized")
        channel = f"{self._channel_prefix}:{trade_id}"
        await self._redis.publish(channel, json.dumps(message))

    async def add_participant(
        self, trade_id: str, identity_pubkey: str, chat_pubkey: str | None
    ) -> None:
        if self._redis is None:
            raise RuntimeError("Redis broker not initialized")
        key = self._room_key(trade_id)
        entry = json.dumps(
            {
                "identity_pubkey": identity_pubkey,
                "chat_pubkey": chat_pubkey,
            }
        )
        await self._redis.sadd(key, entry)

    async def remove_participant(
        self, trade_id: str, identity_pubkey: str, chat_pubkey: str | None
    ) -> None:
        if self._redis is None:
            raise RuntimeError("Redis broker not initialized")
        key = self._room_key(trade_id)
        entry = json.dumps(
            {
                "identity_pubkey": identity_pubkey,
                "chat_pubkey": chat_pubkey,
            }
        )
        await self._redis.srem(key, entry)

    async def get_participants(self, trade_id: str) -> list[dict[str, Any]]:
        if self._redis is None:
            raise RuntimeError("Redis broker not initialized")
        key = self._room_key(trade_id)
        entries = await self._redis.smembers(key)
        participants: list[dict[str, Any]] = []
        for entry in entries:
            try:
                participants.append(json.loads(entry))
            except json.JSONDecodeError:
                continue
        return participants

    async def listen(self, handler: MessageHandler) -> None:
        if self._pubsub is None:
            raise RuntimeError("Redis broker not initialized")
        async for item in self._pubsub.listen():
            if item["type"] not in {"message", "pmessage"}:
                continue
            channel = item.get("channel")
            if channel is None:
                continue
            if isinstance(channel, bytes):
                channel_name = channel.decode("utf-8")
            else:
                channel_name = str(channel)
            trade_id = channel_name.split(":", 1)[1] if ":" in channel_name else ""
            if not trade_id:
                continue
            try:
                payload = json.loads(item.get("data") or "{}")
            except json.JSONDecodeError:
                continue
            await handler(trade_id, payload)

    def _room_key(self, trade_id: str) -> str:
        return f"chat_room:{trade_id}"
