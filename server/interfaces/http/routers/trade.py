"""
交易路由模块。

定义处理交易相关请求的 HTTP 端点，包括列出交易、获取详情、创建、完成、取消以及加入交易等。
"""

from fastapi import APIRouter, HTTPException, status

from server.application.trade import service as trade_service
from server.application.trade.service import (
    verify_create,
    verify_complete,
    verify_cancel,
    apply_block,
    get_trade_chat_info,
    update_chat_pubkey,
    get_peer_chat_pubkey,
)
from server.interfaces.http.schemas.trade import (
    ChatPubkeyUpdateRequest,
    OperationStatus,
    TradeCancelRequest,
    TradeChatInfo,
    TradeCompleteRequest,
    TradeCreateRequest,
    TradeDetail,
    TradeJoinRequest,
    TradeListResponse,
)

router = APIRouter(prefix="/trade")


@router.get("/list", response_model=TradeListResponse)
async def get_trade_list():
    """
    获取交易列表。

    Returns:
        TradeListResponse: 包含前 50 条交易记录的响应对象。
    """
    trades = trade_service.list_trade_records(limit=50)
    # 转换数据库格式为 API 格式
    result = []
    for trade in trades:
        result.append(_serialize_trade(trade))
    return {"data": result}


@router.get("/{trade_id}", response_model=TradeDetail)
async def get_single_trade(trade_id: str):
    """
    获取单个交易的详细详情。

    Args:
        trade_id: 交易 ID。

    Returns:
        TradeDetail: 交易详情响应。

    Raises:
        HTTPException: 未找到指定交易时抛出 404 错误。
    """
    trade = trade_service.get_trade_record(trade_id)
    if trade is None:
        raise HTTPException(status_code=404, detail="Trade not found")

    return _serialize_trade(trade)


@router.post("/create", response_model=OperationStatus)
async def create_trade(payload: TradeCreateRequest):
    """
    提交并创建新交易。

    验证前端提交的哈希和卖家签名，验证通过后写入区块链。

    Args:
        payload: 创建交易的请求体。

    Returns:
        OperationStatus: 操作状态响应。
    """

    try:
        normalized = payload.to_input()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    try:
        block = verify_create(
            trade_id=normalized.trade_id,
            content_hash=normalized.content_hash,
            seller_pubkey=normalized.seller_pubkey,
            description=normalized.description,
            price=normalized.price,
            signature=normalized.signature,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    # 合法才写链
    apply_block(block)

    return {"status": "ok"}


# 完成交易    双签


@router.post("/complete", response_model=OperationStatus)
async def complete_trade(payload: TradeCompleteRequest):
    """
    提交并完成交易（双签验证）。

    验证卖家和买家的双重签名，验证通过后写入 COMPLETE 类型区块。

    Args:
        payload: 包含交易 ID、哈希及双方签名的请求体。

    Returns:
        OperationStatus: 操作状态响应。
    """

    try:
        block = verify_complete(
            trade_id=payload.trade_id,
            complete_hash=payload.complete_hash,
            seller_sig=payload.sig_seller,
            buyer_sig=payload.sig_buyer,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    apply_block(block)

    return {"status": "ok"}


@router.post("/cancel", response_model=OperationStatus)
async def cancel_trade(payload: TradeCancelRequest):
    """
    提交并取消交易（卖家单签）。

    仅允许卖家对未完成交易发起取消操作。

    Args:
        payload: 包含交易 ID、取消哈希及卖家签名的请求体。

    Returns:
        OperationStatus: 操作状态响应。
    """

    try:
        block = verify_cancel(
            trade_id=payload.trade_id,
            cancel_hash=payload.cancel_hash,
            seller_sig=payload.signature,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    apply_block(block)

    return {"status": "ok"}


@router.post("/{trade_id}/join", response_model=dict)
async def join_trade_api(trade_id: str, payload: TradeJoinRequest):
    """
    记录买家加入指定交易。

    Args:
        trade_id: 交易 ID。
        payload: 包含买家身份公钥的请求体。

    Returns:
        dict: 操作成功确认。
    """
    try:
        trade_service.join_trade(
            trade_id=trade_id,
            buyer_pubkey=payload.buyer_pubkey,
            buyer_chat_pubkey={},
        )
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e)) from e


# 聊天相关API
# ============================================================


@router.get("/{trade_id}/chat-info", response_model=TradeChatInfo)
async def get_trade_chat_info_api(trade_id: str):
    """
    获取交易的聊天室配置信息。

    Args:
        trade_id: 交易 ID。

    Returns:
        TradeChatInfo: 聊天相关参数信息。
    """
    try:
        chat_info = get_trade_chat_info(trade_id)
        if not chat_info:
            raise HTTPException(status_code=404, detail="Trade not found")
        return chat_info
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/{trade_id}/update-chat-pubkey", response_model=dict)
async def update_chat_pubkey_api(trade_id: str, payload: ChatPubkeyUpdateRequest):
    """
    更新参与者的聊天公钥。

    Args:
        trade_id: 交易 ID。
        payload: 包含身份公钥和新聊天公钥的请求体。

    Returns:
        dict: 更新结果描述。
    """
    identity_pubkey = payload.identity_pubkey
    chat_pubkey = payload.chat_pubkey

    try:
        result = update_chat_pubkey(trade_id, identity_pubkey, chat_pubkey)
        return result
    except Exception as e:
        raise HTTPException(500, str(e)) from e


@router.get("/{trade_id}/peer-chat-pubkey/{identity_pubkey}", response_model=dict)
async def get_peer_chat_pubkey_api(trade_id: str, identity_pubkey: str):
    """
    获取交易对方的聊天公钥。

    Args:
        trade_id: 交易 ID。
        identity_pubkey: 调用者的身份公钥。

    Returns:
        dict: 包含对方聊天公钥的响应。
    """
    try:
        peer_chat_pubkey = get_peer_chat_pubkey(trade_id, identity_pubkey)
        return {"success": True, "peer_chat_pubkey": peer_chat_pubkey}
    except Exception as e:
        raise HTTPException(500, str(e)) from e


def _serialize_trade(trade: dict) -> dict:
    """内部工具：将数据库记录转换为接口数据格式。"""
    return {
        "trade_id": trade["trade_id"],
        "seller_pubkey": trade["seller_pubkey"],
        "buyer_pubkey": trade.get("buyer_pubkey"),
        "status": trade["status"],
        "description": trade.get("description"),
        "price": trade.get("price"),
        "content_hash": trade.get("content_hash"),
        "created_at": trade.get("created_at"),
    }
