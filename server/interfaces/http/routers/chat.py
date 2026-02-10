"""
聊天路由模块。

包含处理实时聊天通信的 WebSocket 端点，以及获取历史消息和房间信息的 HTTP 接口。
"""

import asyncio
import json
import logging
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, status
from pydantic import ValidationError

from server.application.chat import service as chat_service
from server.application.trade import service as trade_service
from server.interfaces.http.schemas.chat import (
    ChatAuthMessage,
    ChatHistoryResponse,
    ChatRoomInfoResponse,
)

router = APIRouter(prefix="/ws/chat")
http_router = APIRouter(prefix="/chat")
logger = logging.getLogger(__name__)


@router.websocket("/{trade_id}")
async def chat_websocket(websocket: WebSocket, trade_id: str):
    """
    处理指定交易的 WebSocket 实时聊天连接。

    工作流程：
    1. 接受 WebSocket 连接并验证 trade_id 是否有效。
    2. 等待并验证来自客户端的 'auth' 认证消息。
    3. 将连接加入对应的聊天房间，并开启消息循环。
    4. 处理接收到的 CHAT（私聊）、JOIN（加入）和 PING（心跳）消息。
    5. 在断开连接或发生错误时退出房间。

    Args:
        websocket: WebSocket 连接实例。
        trade_id: 交易 ID。
    """
    # 1. 接受WebSocket连接
    await websocket.accept()
    logger.info("New websocket connection: trade_id=%s", trade_id)

    # 2. 验证交易ID是否存在
    trade = trade_service.get_trade_record(trade_id)
    if trade is None:
        logger.info("Trade not found for websocket: trade_id=%s", trade_id)
        await websocket.close(code=1008, reason="Trade not found")
        return

    # 3. 等待认证消息
    try:
        # 设置接收超时
        try:
            data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
        except asyncio.TimeoutError:
            await websocket.close(code=1008, reason="Authentication timeout")
            return

        try:
            auth_data = ChatAuthMessage.model_validate_json(data)
        except ValidationError:
            await websocket.close(code=1008, reason="Invalid authentication payload")
            return

        if auth_data.type != "auth":
            await websocket.close(code=1008, reason="Authentication required")
            return

        identity_pubkey = auth_data.identity_pubkey
        chat_pubkey = auth_data.chat_pubkey

        logger.info(
            "Websocket auth ok: trade_id=%s identity=%s",
            trade_id,
            identity_pubkey[:16],
        )

        # 4. 加入聊天房间
        await chat_service.join_room(trade_id, websocket, identity_pubkey, chat_pubkey)
        logger.info("Connection joined room: trade_id=%s", trade_id)

        # 5. 发送认证成功响应
        await websocket.send_json(
            {
                "type": "auth_response",
                "success": True,
                "trade_id": trade_id,
                "timestamp": int(time.time()),
            }
        )

        # 6. 持续接收并转发消息
        while True:
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
                message_type = message.get("type")

                if message_type == "CHAT":
                    # 处理聊天消息
                    ciphertext = message.get("ciphertext")
                    buyer_chat_pubkey = message.get("buyer_chat_pubkey") or chat_pubkey
                    if ciphertext:
                        # 中继消息
                        await chat_service.relay(
                            trade_id, ciphertext, chat_pubkey, buyer_chat_pubkey
                        )
                    else:
                        print("[chat_api] 收到无效的CHAT消息: 缺少ciphertext")

                elif message_type == "JOIN":
                    # 重新广播JOIN消息
                    await chat_service.broadcast_join(
                        trade_id, identity_pubkey, chat_pubkey
                    )

                elif message_type == "PING":
                    # 心跳响应
                    await websocket.send_json(
                        {"type": "PONG", "timestamp": int(time.time())}
                    )

                else:
                    logger.debug("Unknown message type: %s", message_type)

            except json.JSONDecodeError:
                logger.warning("Received non-JSON message length=%s", len(data))
                # 尝试作为纯文本密文处理
                await chat_service.relay(trade_id, data, chat_pubkey, chat_pubkey)
            except Exception as exc:
                logger.exception("Failed to process websocket message: %s", exc)

    except WebSocketDisconnect:
        logger.info("Websocket disconnected: trade_id=%s", trade_id)
        await chat_service.leave_room(trade_id, websocket)
    except Exception as exc:
        logger.exception("Websocket error: trade_id=%s error=%s", trade_id, exc)
        await chat_service.leave_room(trade_id, websocket)
        try:
            await websocket.close(code=1011, reason="Internal server error")
        except Exception:
            pass


@http_router.get("/history/{trade_id}", response_model=ChatHistoryResponse)
async def get_chat_history_api(trade_id: str, limit: int = 100):
    """
    获取指定交易的历史聊天记录。

    Args:
        trade_id: 交易 ID。
        limit: 限制返回消息的最大数量，默认 100。

    Returns:
        ChatHistoryResponse: 包含历史消息列表的响应。
    """
    try:
        messages = chat_service.get_chat_history(trade_id, limit)

        # 转换格式
        result = []
        for msg in messages:
            result.append(
                {
                    "id": msg["id"],
                    "trade_id": msg["trade_id"],
                    "ciphertext": msg["ciphertext"],
                    "timestamp": msg["timestamp"],
                    "buyer_chat_pubkey": msg.get("buyer_chat_pubkey"),
                    "sender_pubkey": msg.get("sender_pubkey"),
                }
            )

        return {"success": True, "messages": result}
    except Exception as exc:
        logger.exception("Failed to get chat history: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@http_router.get("/room/{trade_id}", response_model=ChatRoomInfoResponse)
async def get_chat_room_info(trade_id: str):
    """
    获取指定聊天房间的参与者及统计信息。

    Args:
        trade_id: 交易 ID。

    Returns:
        ChatRoomInfoResponse: 包含参与者列表和人数的响应。
    """
    try:
        room_info = await chat_service.get_room_info(trade_id)
        return {
            "success": True,
            "trade_id": trade_id,
            "participants": room_info,
            "count": len(room_info),
        }
    except Exception as exc:
        logger.exception("Failed to get room info: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )
