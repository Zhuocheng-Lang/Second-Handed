"""
区块链数据持久化模块。

负责区块记录的写入、获取和列表查询。
"""

from server.infrastructure.db.mysql import get_cursor
from typing import Any, cast


def insert_block(block: dict):
    """
    持久化存储新区块。

    Args:
        block: 区块信息字典。
    """
    sql = """
    INSERT INTO blocks (
        block_index,
        prev_hash,
        block_hash,
        timestamp,
        type,
        payload_json
    ) VALUES (%s, %s, %s, %s, %s, %s)
    """

    with get_cursor() as cursor:
        cursor.execute(
            sql,
            (
                block["index"],
                block["prev_hash"],
                block["hash"],
                block["timestamp"],
                block["type"],
                block["payload_json"],
            ),
        )


def get_last_block() -> dict[str, Any] | None:
    """
    获取最新的区块。

    Returns:
        Optional[dict]: 最新区块信息字典。
    """
    sql = """
    SELECT * FROM blocks
    ORDER BY block_index DESC
    LIMIT 1
    """

    with get_cursor() as cursor:
        cursor.execute(sql)
        result = cursor.fetchone()
        return cast(dict[str, Any] | None, result)


def get_blocks_since(index: int) -> list[dict[str, Any]]:
    """
    获取指定索引之后的所有区块。

    Args:
        index: 起始区块索引。

    Returns:
        list[dict]: 区块信息列表。
    """
    sql = """
    SELECT * FROM blocks
    WHERE block_index > %s
    ORDER BY block_index ASC
    """

    with get_cursor() as cursor:
        cursor.execute(sql, (index,))
        result = cursor.fetchall()
        return cast(list[dict[str, Any]], result)


def get_all_blocks() -> list[dict[str, Any]]:
    """
    获取区块链中所有的区块。

    Returns:
        list[dict]: 按索引升序排列的所有区块列表。
    """
    sql = """
    SELECT * FROM blocks
    ORDER BY block_index ASC
    """

    with get_cursor() as cursor:
        cursor.execute(sql)
        result = cursor.fetchall()
        return cast(list[dict[str, Any]], result)
