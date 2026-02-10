"""
聊天服务模块。

负责管理聊天室、分发实时消息以及通过代理(broker)协调多个服务器实例间的消息同步。
"""

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


def set_broker(broker: BaseChatBroker) -> None:
    """
    设置全局聊天代理实例。

    Args:
        broker: 实现了 BaseChatBroker 接口的代理实例。
    """
    global _broker
    _broker = broker


async def run_broker_listener() -> None:
    """
    启动代理消息监听器。

    持续接收来自代理的消息并处理，直到被取消或发生异常。
    """
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
    将用户连接加入指定的交易聊天室。

    Args:
        trade_id: 交易 ID。
        conn: 物理连接对象（如 WebSocketConnection）。
        identity_pubkey: 用户身份公钥。
        chat_pubkey: 可选，该用户的聊天公钥。
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


async def leave_room(trade_id: str, conn):
    """
    将用户连接从指定的交易聊天室中移除。

    Args:
        trade_id: 交易 ID。
        conn: 之前加入的物理连接对象。
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


async def broadcast_join(
    trade_id: str, identity_pubkey: str, chat_pubkey: str | None = None
):
    """
    广播用户加入聊天室的消息。

    Args:
        trade_id: 交易 ID。
        identity_pubkey: 用户身份公钥。
        chat_pubkey: 可选，该用户的聊天公钥。
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


async def relay(
    trade_id: str, ciphertext: str, sender_chat_pubkey: str, buyer_chat_pubkey: str
):
    """
    中继密文消息给相关参与者。

    将收到的加密消息分发给所有连接，并持久化到数据库。

    Args:
        trade_id: 交易 ID。
        ciphertext: 加密的消息内容。
        sender_chat_pubkey: 发送者的聊天公钥。
        buyer_chat_pubkey: 交易买家的聊天公钥（用于数据库索引/检索）。
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


async def get_room_info(trade_id: str):
    """
    获取指定聊天室的当前状态和参与者信息。

    优先尝试通过代理获取在线参与者列表，若不可用则使用本地缓存。

    Args:
        trade_id: 交易 ID。

    Returns:
        list[dict]: 参与者的状态信息列表。
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


def get_chat_history(trade_id: str, limit: int = 100):
    """
    获取指定交易的历史聊天消息记录。

    Args:
        trade_id: 交易 ID。
        limit: 限制返回消息的最大数量，默认 100。

    Returns:
        list[dict]: 历史聊天消息列表。
    """
    return get_messages(trade_id, limit)


def get_current_timestamp():
    """
    获取当前的 UNIX 时间戳。

    Returns:
        int: 当前时间的秒级时间戳。
    """
    import time

    return int(time.time())


async def _emit(trade_id: str, message: dict) -> None:
    """内部函数：分发消息到本地并发布到代理。"""
    await _broadcast_local(trade_id, dict(message))
    publish_message = dict(message)
    publish_message["origin_id"] = _broker_id
    await _broker.publish(trade_id, publish_message)


async def _handle_broker_message(trade_id: str, message: dict) -> None:
    """回调函数：处理来自代理的消息。"""
    if message.get("origin_id") == _broker_id:
        return
    clean_message = dict(message)
    clean_message.pop("origin_id", None)
    await _broadcast_local(trade_id, clean_message)


async def _broadcast_local(trade_id: str, message: dict) -> None:
    """内部函数：将消息广播给本地所有活跃的 WebSocket 连接。"""
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
