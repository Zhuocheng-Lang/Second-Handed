"""
聊天数据库操作模块。

处理聊天消息的存储和检索。
"""

import logging

from server.infrastructure.db.mysql import get_cursor

logger = logging.getLogger(__name__)


def insert_message(
    trade_id: str, buyer_chat_pubkey: str, sender_pubkey: str, ciphertext: str
):
    """
    插入新的聊天消息。

    Args:
        trade_id: 交易 ID。
        buyer_chat_pubkey: 买家聊天公钥。
        sender_pubkey: 发送者身份公钥。
        ciphertext: 加密后的消息内容。

    Raises:
        Exception: 数据库插入失败时抛出。
    """
    sql = """
    INSERT INTO chats (
        trade_id,
        buyer_chat_pubkey,
        sender_pubkey,
        ciphertext,
        timestamp
    ) VALUES (%s, %s, %s, %s, UNIX_TIMESTAMP(NOW()))
    """

    with get_cursor() as cursor:
        try:
            cursor.execute(
                sql, (trade_id, buyer_chat_pubkey, sender_pubkey, ciphertext)
            )
        except Exception as exc:
            logger.exception("Failed to insert chat message: %s", exc)
            raise


def get_messages(trade_id: str, limit: int = 100):
    """
    获取指定交易的聊天消息列表。

    Args:
        trade_id: 交易 ID。
        limit: 限制返回的消息数量，默认 100。

    Returns:
        list[dict]: 聊天消息记录列表。
    """
    sql = """
    SELECT 
        id,
        trade_id,
        buyer_chat_pubkey,
        sender_pubkey,
        ciphertext,
        timestamp
    FROM chats
    WHERE trade_id = %s
    ORDER BY timestamp ASC
    LIMIT %s
    """

    with get_cursor() as cursor:
        cursor.execute(sql, (trade_id, limit))
        return cursor.fetchall()
