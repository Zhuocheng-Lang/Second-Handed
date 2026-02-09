from db.mysql import get_cursor


def insert_message(
    trade_id: str, buyer_chat_pubkey: str, sender_pubkey: str, ciphertext: str
):
    """ """
    new_sql = """
    INSERT INTO chats (
        trade_id,
        buyer_chat_pubkey,
        sender_pubkey,
        ciphertext,
        timestamp
    ) VALUES (%s, %s, %s, %s, UNIX_TIMESTAMP(NOW()))
    """
    old_sql = """
    INSERT INTO chats (
        trade_id,
        ciphertext,
        timestamp,
        sender_chat_pubkey
    ) VALUES (%s, %s, UNIX_TIMESTAMP(NOW()), %s)
    """

    with get_cursor() as cursor:
        try:
            cursor.execute(
                new_sql, (trade_id, buyer_chat_pubkey, sender_pubkey, ciphertext)
            )
        except Exception:
            #  buyer_chat_pubkey / sender_pubkey
            cursor.execute(old_sql, (trade_id, ciphertext, sender_pubkey))


def get_messages(trade_id: str, limit: int = 100):
    """ """
    new_sql = """
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
    old_sql = """
    SELECT 
        id,
        trade_id,
        ciphertext,
        timestamp,
        sender_chat_pubkey
    FROM chats
    WHERE trade_id = %s
    ORDER BY timestamp ASC
    LIMIT %s
    """

    with get_cursor() as cursor:
        try:
            cursor.execute(new_sql, (trade_id, limit))
            rows = cursor.fetchall()
        except Exception:
            cursor.execute(old_sql, (trade_id, limit))
            rows = cursor.fetchall()

    normalized = []
    new_columns = [
        "id",
        "trade_id",
        "buyer_chat_pubkey",
        "sender_pubkey",
        "ciphertext",
        "timestamp",
    ]
    old_columns = ["id", "trade_id", "ciphertext", "timestamp", "sender_chat_pubkey"]

    for row in rows:
        # 处理元组或字典
        if isinstance(row, dict):
            row_dict = row
        else:
            # 尝试使用新的列名，如果失败则使用旧的
            try:
                row_dict = dict(zip(new_columns, row))
            except Exception as e:
                row_dict = dict(zip(old_columns, row))  # TODO: 添加日志或错误处理

        # 规范化字段
        if "sender_pubkey" not in row_dict and "sender_chat_pubkey" in row_dict:
            row_dict["sender_pubkey"] = row_dict["sender_chat_pubkey"]
        if "buyer_chat_pubkey" not in row_dict:
            row_dict["buyer_chat_pubkey"] = None

        normalized.append(row_dict)
    return normalized
