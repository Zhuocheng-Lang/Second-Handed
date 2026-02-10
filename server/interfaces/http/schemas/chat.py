from __future__ import annotations

from pydantic import BaseModel


class ChatAuthMessage(BaseModel):
    type: str
    identity_pubkey: str
    chat_pubkey: str


class ChatMessageItem(BaseModel):
    id: int
    trade_id: str
    ciphertext: str
    timestamp: int
    buyer_chat_pubkey: str | None = None
    sender_pubkey: str | None = None


class ChatHistoryResponse(BaseModel):
    success: bool
    messages: list[ChatMessageItem]


class ChatRoomParticipant(BaseModel):
    identity_pubkey: str
    chat_pubkey: str | None = None
    connected: bool


class ChatRoomInfoResponse(BaseModel):
    success: bool
    trade_id: str
    participants: list[ChatRoomParticipant]
    count: int
