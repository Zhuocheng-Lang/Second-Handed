import logging

from server.infrastructure.db.mysql import get_cursor

logger = logging.getLogger(__name__)


def insert_message(
    trade_id: str, buyer_chat_pubkey: str, sender_pubkey: str, ciphertext: str
):
    """ """
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
    """ """
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
