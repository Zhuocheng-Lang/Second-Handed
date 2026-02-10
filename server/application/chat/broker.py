"""
聊天消息代理基类模块。

定义了聊天消息发布、订阅以及参与者管理的基础接口。
"""

from __future__ import annotations

from typing import Any
from collections.abc import Awaitable, Callable


MessageHandler = Callable[[str, dict[str, Any]], Awaitable[None]]


class BaseChatBroker:
    """
    聊天消息代理的抽象基类。
    """

    async def connect(self) -> None:
        """建立代理连接。"""
        raise NotImplementedError

    async def close(self) -> None:
        """关闭代理连接。"""
        raise NotImplementedError

    async def publish(self, trade_id: str, message: dict[str, Any]) -> None:
        """
        向指定交易的主题发布消息。

        Args:
            trade_id: 交易 ID。
            message: 待发布的自定义消息字典。
        """
        raise NotImplementedError

    async def add_participant(
        self, trade_id: str, identity_pubkey: str, chat_pubkey: str | None
    ) -> None:
        """
        向指定交易添加聊天参与者。

        Args:
            trade_id: 交易 ID。
            identity_pubkey: 参与者的身份公钥。
            chat_pubkey: 参与者的聊天公钥。
        """
        raise NotImplementedError

    async def remove_participant(
        self, trade_id: str, identity_pubkey: str, chat_pubkey: str | None
    ) -> None:
        """
        从指定交易移除聊天参与者。

        Args:
            trade_id: 交易 ID。
            identity_pubkey: 参与者的身份公钥。
            chat_pubkey: 参与者的聊天公钥。
        """
        raise NotImplementedError

    async def get_participants(self, trade_id: str) -> list[dict[str, Any]]:
        """
        获取指定交易的当前在线参与者列表。

        Args:
            trade_id: 交易 ID。

        Returns:
            list[dict]: 包含在线参与者信息的列表。
        """
        raise NotImplementedError

    async def listen(self, handler: MessageHandler) -> None:
        """
        开启监听模式，阻塞当前协程并处理收到的消息。

        Args:
            handler: 处理消息的异步回调函数，接收 trade_id 和消息内容作为参数。
        """
        raise NotImplementedError


class NoopChatBroker(BaseChatBroker):
    """
    不执行任何操作的消息代理实现（用于禁用聊天代理的情景）。
    """

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
