from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TradeSummary(BaseModel):
    trade_id: str
    seller_pubkey: str
    buyer_pubkey: str | None = None
    status: str
    description: str | None = None
    price: float | int | None = None
    content_hash: str | None = None
    created_at: datetime | None = None


class TradeDetail(TradeSummary):
    pass


class TradeListResponse(BaseModel):
    data: list[TradeSummary]


class OperationStatus(BaseModel):
    status: str


class TradeCreateBody(BaseModel):
    trade_id: str | None = None
    content_hash: str | None = None
    seller_pubkey: str | None = None
    description: str | None = None
    price: float | int | None = None


class TradeCreateRequest(BaseModel):
    trade_id: str | None = None
    content_hash: str | None = None
    seller_pubkey: str | None = None
    signature: str
    body: TradeCreateBody | None = None

    def to_input(self) -> "TradeCreateInput":
        if self.body:
            trade_id = self.trade_id or self.body.trade_id
            content_hash = self.body.content_hash
            seller_pubkey = self.body.seller_pubkey
            description = self.body.description
            price = self.body.price
        else:
            trade_id = self.trade_id
            content_hash = self.content_hash
            seller_pubkey = self.seller_pubkey
            description = None
            price = None

        missing = []
        if not trade_id:
            missing.append("trade_id")
        if not content_hash:
            missing.append("content_hash")
        if not seller_pubkey:
            missing.append("seller_pubkey")
        if not self.signature:
            missing.append("signature")

        if missing:
            raise ValueError(f"Missing field: {', '.join(missing)}")

        assert trade_id is not None
        assert content_hash is not None
        assert seller_pubkey is not None

        return TradeCreateInput(
            trade_id=trade_id,
            content_hash=content_hash,
            seller_pubkey=seller_pubkey,
            signature=self.signature,
            description=description,
            price=price,
        )


class TradeCreateInput(BaseModel):
    trade_id: str
    content_hash: str
    seller_pubkey: str
    signature: str
    description: str | None = None
    price: float | int | None = None


class TradeCompleteRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    trade_id: str
    complete_hash: str = Field(alias="hash")
    sig_seller: str
    sig_buyer: str


class TradeCancelRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    trade_id: str
    cancel_hash: str = Field(alias="hash")
    signature: str


class TradeJoinRequest(BaseModel):
    buyer_pubkey: str


class ChatPubkeyUpdateRequest(BaseModel):
    identity_pubkey: str
    chat_pubkey: str


class TradeChatInfo(BaseModel):
    trade_id: str
    seller_pubkey: str
    buyer_pubkey: str | None = None
    seller_chat_pubkey: Any | None = None
    buyer_chat_pubkey: Any | None = None
    status: str
