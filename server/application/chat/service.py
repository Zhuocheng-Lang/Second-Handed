# backend/services/chat_service.py

import asyncio
import logging
from uuid import uuid4

from server.infrastructure.db.chats import insert_message, get_messages
from server.application.chat.broker import BaseChatBroker, NoopChatBroker

logger = logging.getLogger(__name__)

# 房间管理: trade_id -> list of (connection, identity_pubkey, chat_pubkey)
_rooms: dict[str, list[tuple]] = {}
_broker: BaseChatBroker = NoopChatBroker()
_broker_id = uuid4().hex

# -----------------------------
# 加入聊天室
# -----------------------------


def set_broker(broker: BaseChatBroker) -> None:
    global _broker
    _broker = broker


async def run_broker_listener() -> None:
    try:
        await _broker.listen(_handle_broker_message)
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.exception("Chat broker listener stopped: %s", exc)


async def join_room(
    trade_id: str, conn, identity_pubkey: str, chat_pubkey: str | None = None
):
    """
    将一个连接加入指定 trade_id 的聊天室
    """
    if trade_id not in _rooms:
        _rooms[trade_id] = []

    # 检查是否已经存在相同的连接
    for i, (existing_conn, existing_identity, existing_chat) in enumerate(
        _rooms[trade_id]
    ):
        if existing_conn == conn:
            # 更新现有连接的信息
            _rooms[trade_id][i] = (conn, identity_pubkey, chat_pubkey)
            return

    _rooms[trade_id].append((conn, identity_pubkey, chat_pubkey))

    # 向房间内的其他人广播 JOIN 消息
    try:
        await _broker.add_participant(trade_id, identity_pubkey, chat_pubkey)
    except Exception as exc:
        logger.exception("Failed to add participant: %s", exc)
    await broadcast_join(trade_id, identity_pubkey, chat_pubkey)


# -----------------------------
#  离开聊天室
# -----------------------------


async def leave_room(trade_id: str, conn):
    """
    将一个连接从聊天室中移除
    """
    if trade_id not in _rooms:
        return

    remaining = []
    removed: list[tuple[str, str | None]] = []

    for existing_conn, identity_pubkey, chat_pubkey in _rooms[trade_id]:
        if existing_conn == conn:
            removed.append((identity_pubkey, chat_pubkey))
        else:
            remaining.append((existing_conn, identity_pubkey, chat_pubkey))

    _rooms[trade_id] = remaining

    for identity_pubkey, chat_pubkey in removed:
        try:
            await _broker.remove_participant(trade_id, identity_pubkey, chat_pubkey)
        except Exception as exc:
            logger.exception("Failed to remove participant: %s", exc)

    # 如果房间空了，清理掉
    if not _rooms[trade_id]:
        del _rooms[trade_id]


# -----------------------------
# 广播 JOIN 消息
# -----------------------------


async def broadcast_join(
    trade_id: str, identity_pubkey: str, chat_pubkey: str | None = None
):
    """
    广播用户加入消息
    """
    if trade_id not in _rooms:
        return

    join_message = {
        "type": "JOIN",
        "trade_id": trade_id,
        "identity_pubkey": identity_pubkey,
        "chat_pubkey": chat_pubkey,
        "timestamp": get_current_timestamp(),
    }

    await _emit(trade_id, join_message)


# -----------------------------
# 中继密文消息
# -----------------------------


async def relay(
    trade_id: str, ciphertext: str, sender_chat_pubkey: str, buyer_chat_pubkey: str
):
    """
    将密文消息广播给同一 trade_id 下的所有连接
    同时将消息保存到数据库
    """
    if trade_id not in _rooms:
        return

    # 保存消息到数据库
    try:
        insert_message(trade_id, buyer_chat_pubkey, sender_chat_pubkey, ciphertext)
    except Exception as exc:
        logger.exception("Failed to persist chat message: %s", exc)

    # 构建消息
    message = {
        "type": "CHAT",
        "trade_id": trade_id,
        "sender_chat_pubkey": sender_chat_pubkey,
        "ciphertext": ciphertext,
        "timestamp": get_current_timestamp(),
    }

    await _emit(trade_id, message)


# -----------------------------
# 获取房间信息
# -----------------------------


async def get_room_info(trade_id: str):
    """
    获取房间信息
    """
    participants = await _broker.get_participants(trade_id)
    if participants:
        return [
            {
                "identity_pubkey": item.get("identity_pubkey"),
                "chat_pubkey": item.get("chat_pubkey"),
                "connected": True,
            }
            for item in participants
        ]

    return [
        {
            "identity_pubkey": identity_pubkey,
            "chat_pubkey": chat_pubkey,
            "connected": True,
        }
        for _, identity_pubkey, chat_pubkey in _rooms.get(trade_id, [])
    ]


# -----------------------------
# 获取历史消息
# -----------------------------


def get_chat_history(trade_id: str, limit: int = 100):
    """
    获取聊天历史
    """
    return get_messages(trade_id, limit)


# -----------------------------
# 工具函数
# -----------------------------


def get_current_timestamp():
    """
    获取当前时间戳
    """
    import time

    return int(time.time())


async def _emit(trade_id: str, message: dict) -> None:
    await _broadcast_local(trade_id, dict(message))
    publish_message = dict(message)
    publish_message["origin_id"] = _broker_id
    await _broker.publish(trade_id, publish_message)


async def _handle_broker_message(trade_id: str, message: dict) -> None:
    if message.get("origin_id") == _broker_id:
        return
    clean_message = dict(message)
    clean_message.pop("origin_id", None)
    await _broadcast_local(trade_id, clean_message)


async def _broadcast_local(trade_id: str, message: dict) -> None:
    if trade_id not in _rooms:
        return

    dead_conns = []
    for conn, _, _ in _rooms[trade_id]:
        try:
            await conn.send_json(message)
        except Exception:
            dead_conns.append(conn)

    for conn in dead_conns:
        await leave_room(trade_id, conn)
