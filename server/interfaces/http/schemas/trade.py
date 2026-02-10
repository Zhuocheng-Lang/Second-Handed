"""
交易数据模型模块。

定义交易接口所使用的 Pydantic 模型，包括请求体和响应体。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TradeSummary(BaseModel):
    """交易概要信息。"""

    trade_id: str
    seller_pubkey: str
    buyer_pubkey: str | None = None
    status: str
    description: str | None = None
    price: float | int | None = None
    content_hash: str | None = None
    created_at: datetime | None = None


class TradeDetail(TradeSummary):
    """交易详细信息。"""

    pass


class TradeListResponse(BaseModel):
    """交易列表响应。"""

    data: list[TradeSummary]


class OperationStatus(BaseModel):
    """操作状态响应。"""

    status: str


class TradeCreateBody(BaseModel):
    """创建交易负载。"""

    trade_id: str | None = None
    content_hash: str | None = None
    seller_pubkey: str | None = None
    description: str | None = None
    price: float | int | None = None


class TradeCreateRequest(BaseModel):
    """创建交易请求。"""

    trade_id: str | None = None
    content_hash: str | None = None
    seller_pubkey: str | None = None
    signature: str
    body: TradeCreateBody | None = None

    def to_input(self) -> "TradeCreateInput":
        """
        将请求转换为标准的输入格式，处理 body 和顶层字段的冗余。

        Returns:
            TradeCreateInput: 规范化后的输入数据。

        Raises:
            ValueError: 当缺少必需字段时抛出。
        """
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
    """规范化后的创建交易输入。"""

    trade_id: str
    content_hash: str
    seller_pubkey: str
    signature: str
    description: str | None = None
    price: float | int | None = None


class TradeCompleteRequest(BaseModel):
    """完成交易请求。"""

    model_config = ConfigDict(populate_by_name=True)

    trade_id: str
    complete_hash: str = Field(alias="hash")
    sig_seller: str
    sig_buyer: str


class TradeCancelRequest(BaseModel):
    """取消交易请求。"""

    model_config = ConfigDict(populate_by_name=True)

    trade_id: str
    cancel_hash: str = Field(alias="hash")
    signature: str


class TradeJoinRequest(BaseModel):
    """买家加入交易请求。"""

    buyer_pubkey: str


class ChatPubkeyUpdateRequest(BaseModel):
    """更新聊天公钥请求。"""

    identity_pubkey: str
    chat_pubkey: str


class TradeChatInfo(BaseModel):
    """交易聊天配置信息响应。"""

    trade_id: str
    seller_pubkey: str
    buyer_pubkey: str | None = None
    seller_chat_pubkey: Any | None = None
    buyer_chat_pubkey: Any | None = None
    status: str
