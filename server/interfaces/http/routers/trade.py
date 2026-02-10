# backend/api/trade_api.py

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


# GET —— 获取交易列表------list


@router.get("/list", response_model=TradeListResponse)
async def get_trade_list():
    """
    获取交易列表
    """
    trades = trade_service.list_trade_records(limit=50)
    # 转换数据库格式为 API 格式
    result = []
    for trade in trades:
        result.append(_serialize_trade(trade))
    return {"data": result}


# GET —— 获取单个交易 /id


@router.get("/{trade_id}", response_model=TradeDetail)
async def get_single_trade(trade_id: str):
    """
    获取单个交易详情
    """
    trade = trade_service.get_trade_record(trade_id)
    if trade is None:
        raise HTTPException(status_code=404, detail="Trade not found")

    return _serialize_trade(trade)


# CREATE —— 创建交易
@router.post("/create", response_model=OperationStatus)
async def create_trade(payload: TradeCreateRequest):
    """
    创建交易

    前端必须提供：
    - trade_id
    - content_hash
    - seller_pubkey
    - signature
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
    完成交易（卖家 + 买家双签）

    前端必须提供：
    - trade_id
    - complete_hash
    - seller_signature
    - buyer_signature
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


# CANCEL —— 取消交易（卖家单签）


@router.post("/cancel", response_model=OperationStatus)
async def cancel_trade(payload: TradeCancelRequest):
    """
    取消交易（仅卖家）

    前端必须提供：
    - trade_id
    - cancel_hash
    - seller_signature
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


# JOIN —— 买家加入交易


@router.post("/{trade_id}/join", response_model=dict)
async def join_trade_api(trade_id: str, payload: TradeJoinRequest):
    """
    买家加入交易（写入 buyer_pubkey）
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
    获取交易的聊天相关信息
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
    更新用户的聊天公钥
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
    获取对方的聊天公钥
    """
    try:
        peer_chat_pubkey = get_peer_chat_pubkey(trade_id, identity_pubkey)
        return {"success": True, "peer_chat_pubkey": peer_chat_pubkey}
    except Exception as e:
        raise HTTPException(500, str(e)) from e


def _serialize_trade(trade: dict) -> dict:
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
