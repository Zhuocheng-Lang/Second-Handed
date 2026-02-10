"""
聊天数据模型模块。

定义聊天接口相关的 WebSocket 认证消息及 HTTP 响应模型。
"""

from __future__ import annotations

from pydantic import BaseModel


class ChatAuthMessage(BaseModel):
    """WebSocket 认证消息模型。"""

    type: str
    identity_pubkey: str
    chat_pubkey: str


class ChatMessageItem(BaseModel):
    """单条聊天消息条目模型。"""

    id: int
    trade_id: str
    ciphertext: str
    timestamp: int
    buyer_chat_pubkey: str | None = None
    sender_pubkey: str | None = None


class ChatHistoryResponse(BaseModel):
    """聊天历史记录响应模型。"""

    success: bool
    messages: list[ChatMessageItem]


class ChatRoomParticipant(BaseModel):
    """聊天房间参与者状态模型。"""

    identity_pubkey: str
    chat_pubkey: str | None = None
    connected: bool


class ChatRoomInfoResponse(BaseModel):
    """聊天房间信息响应模型。"""

    success: bool
    trade_id: str
    participants: list[ChatRoomParticipant]
    count: int
