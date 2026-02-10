"""
区块链服务模块。

负责区块链的逻辑操作，包括生成区块、计算区块哈希以及维护链的完整性。
"""

import time
import hashlib
import json

from server.infrastructure.db.blocks import (
    get_last_block,
    insert_block,
    get_all_blocks as db_get_all_blocks,
)


def get_latest_block():
    """
    获取区块链上的最后一个区块。

    Returns:
        Optional[dict]: 格式化后的最新区块信息，如果链为空则返回 None。
    """
    block = get_last_block()
    if block is None:
        return None

    # 转换数据库格式为内部格式
    return {
        "index": block["block_index"],
        "prev_hash": block["prev_hash"],
        "hash": block["block_hash"],
        "timestamp": block["timestamp"],
        "type": block["type"],
        "payload": json.loads(block["payload_json"]),
    }


def get_raw_blocks():
    """
    获取数据库中存储的原始区块数据列表。

    Returns:
        list[dict]: 原始区块记录列表。
    """
    return db_get_all_blocks()


def get_all_blocks():
    """
    获取并转换所有区块信息，通常用于重建系统状态。

    Returns:
        list[dict]: 包含类型、交易 ID、负载和签名的区块列表。
    """
    blocks = []
    for block in db_get_all_blocks():
        payload = json.loads(block["payload_json"])
        blocks.append(
            {
                "type": block["type"],
                "trade_id": payload["trade_id"],
                "payload": payload["payload"],
                "signatures": payload.get("signatures", {}),
            }
        )

    return blocks


def compute_block_hash(block):
    """
    计算给定区块数据的 SHA-256 哈希值。

    哈希对象由索引、前一个区块哈希、负载内容和时间戳拼接而成。

    Args:
        block: 包含 index, prev_hash, payload 和 timestamp 的区块字典。

    Returns:
        str: 计算得到的十六进制哈希字符串。
    """
    block_string = (
        str(block["index"])
        + block["prev_hash"]
        + json.dumps(block["payload"], sort_keys=True)
        + str(block["timestamp"])
    )

    return hashlib.sha256(block_string.encode()).hexdigest()


def append_block(block_data):
    """
    追加新区块到区块链中。

    该过程包括验证前一个区块的哈希、构造完整负载、计算当前区块哈希并持久化到数据库。

    Args:
        block_data: 初始区块数据，需包含 type, trade_id, payload, signatures。

    Returns:
        dict: 最终写入数据库的完整区块数据。

    Raises:
        Exception: 当区块链哈希链断裂或校验失败时抛出。
    """
    last_block = get_latest_block()

    if last_block is None:
        # 创世区块
        index = 0
        prev_hash = "0" * 64
    else:
        index = last_block["index"] + 1
        prev_hash = last_block["hash"]

    # 构造完整的区块 payload（包含 type, trade_id, payload, signatures）
    full_payload = {
        "type": block_data["type"],
        "trade_id": block_data["trade_id"],
        "payload": block_data["payload"],
        "signatures": block_data.get("signatures", {}),
    }

    # 计算区块 hash
    block_for_hash = {
        "index": index,
        "prev_hash": prev_hash,
        "payload": full_payload,
        "timestamp": int(time.time()),
    }
    block_hash = compute_block_hash(block_for_hash)

    # 构造要写入数据库的区块
    db_block = {
        "index": index,
        "prev_hash": prev_hash,
        "hash": block_hash,
        "timestamp": int(time.time()),
        "type": block_data["type"],
        "payload_json": json.dumps(full_payload, ensure_ascii=False),
    }

    #  prev_hash 必须对得上
    if last_block is not None and db_block["prev_hash"] != last_block["hash"]:
        raise Exception("Blockchain broken: prev_hash mismatch")

    insert_block(db_block)

    return db_block
