"""
交易应用服务模块。

负责验证交易合法性、维护交易状态机以及协调区块写入。
核心逻辑包括：
1. 验证前端生成的哈希和签名。
2. 管理交易从创建到完成或取消的状态转换。
3. 将有效的交易操作作为区块追加到区块链中。
"""

from server.domain.crypto.verify import verify_signature
from server.domain.crypto.hash import hash_object
from server.application.blockchain.service import append_block, get_all_blocks

from server.infrastructure.db.trades import (
    get_trade,
    list_trades as db_list_trades,
    insert_trade,
    update_trade_status,
    update_trade_chat_pubkey,
    update_trade_join,
    get_trade_with_chat_info,
)


def verify_create(
    trade_id: str,
    content_hash: str,
    seller_pubkey: str,
    signature: str,
    description=None,
    price=None,
):
    """
    验证创建交易请求是否合法。

    前端需保证 trade_id 等于创建体哈希，且签名由卖家私钥对 trade_id 签署。

    Args:
        trade_id: 交易 ID（由前端计算的哈希）。
        content_hash: 交易内容的哈希。
        seller_pubkey: 卖家的身份公钥。
        signature: 卖家的签名字符串。
        description: 可选，交易描述。
        price: 可选，价格。

    Returns:
        dict: 构造好的 CREATE 类型区块数据。

    Raises:
        Exception: 交易已存在或卖家签名验证失败。
    """

    # 1. trade_id 必须唯一
    if get_trade(trade_id):
        raise Exception("Trade already exists")

    # 2. 验证卖家签名（签名对象就是 trade_id）
    if not verify_signature(
        pubkey=seller_pubkey,
        hash=trade_id,
        signature=signature,
    ):
        raise Exception("Invalid seller signature")

    # 3. 构造 CREATE 区块（不写状态）
    block = {
        "type": "CREATE",
        "trade_id": trade_id,
        "payload": {
            "content_hash": content_hash,
            "seller_pubkey": seller_pubkey,
            "description": description,
            "price": price,
        },
        "signatures": {
            "seller": signature,
        },
    }

    return block


def verify_complete(
    trade_id: str,
    complete_hash: str,
    seller_sig: str,
    buyer_sig: str,
):
    """
    验证完成交易请求是否合法。

    验证买卖双方对交易完成确认哈希的签名。

    Args:
        trade_id: 交易 ID。
        complete_hash: 由前端生成的完成交易哈希。
        seller_sig: 卖家的签名数据。
        buyer_sig: 买家的签名数据。

    Returns:
        dict: 构造好的 COMPLETE 类型区块数据。

    Raises:
        Exception: 交易不存在、状态非法或任一方签名验证失败。
    """

    trade = get_trade(trade_id)
    if trade is None:
        raise Exception("Trade not found")

    # 1. 状态机检查
    if trade["status"] != "OPEN":
        raise Exception("Trade is not open")

    seller_pubkey = trade["seller_pubkey"]
    buyer_pubkey = trade.get("buyer_pubkey")

    if buyer_pubkey is None:
        raise Exception("Buyer pubkey not set")

    # 2. 验卖家签名
    if not verify_signature(
        pubkey=seller_pubkey,
        hash=complete_hash,
        signature=seller_sig,
    ):
        raise Exception("Invalid seller signature")

    # 3. 验买家签名
    if not verify_signature(
        pubkey=buyer_pubkey,
        hash=complete_hash,
        signature=buyer_sig,
    ):
        raise Exception("Invalid buyer signature")

    # 4. ?? COMPLETE ??
    block = {
        "type": "COMPLETE",
        "trade_id": trade_id,
        "payload": {"trade_id": trade_id, "result": "COMPLETED"},
        "hash": complete_hash,
        "signatures": {
            "seller": seller_sig,
            "buyer": buyer_sig,
        },
    }

    return block


def verify_cancel(
    trade_id: str,
    cancel_hash: str,
    seller_sig: str,
):
    """
    验证取消交易请求是否合法。

    仅允许卖家发起取消操作，并验证卖家签名。

    Args:
        trade_id: 交易 ID。
        cancel_hash: 由前端生成的取消交易哈希。
        seller_sig: 卖家的签名数据。

    Returns:
        dict: 构造好的 CANCEL 类型区块数据。

    Raises:
        Exception: 交易不存在、状态非法、哈希不匹配或卖家签名验证失败。
    """

    trade = get_trade(trade_id)
    if trade is None:
        raise Exception("Trade not found")

    # 1. 状态机检查
    if trade["status"] != "OPEN":
        raise Exception("Trade is not open")

    seller_pubkey = trade["seller_pubkey"]

    # 2. 只有卖家可以取消
    if not verify_signature(
        pubkey=seller_pubkey,
        hash=cancel_hash,
        signature=seller_sig,
    ):
        raise Exception("Invalid seller signature")

    # 3. 构造相同的body结构来验证hash一致性
    import time

    body = {
        "trade_id": trade_id,
        "result": "CANCELLED",
        "timestamp": int(time.time()),
    }

    # 验证hash与body的一致性
    local_hash = hash_object(body)
    if local_hash != cancel_hash:
        raise Exception("Hash mismatch")

    # 4. 构造 CANCEL 区块
    block = {
        "type": "CANCEL",
        "trade_id": trade_id,
        "payload": body,
        "hash": cancel_hash,
        "signatures": {
            "seller": seller_sig,
        },
    }

    return block


def apply_block(block: dict):
    """
    应用并持久化区块。

    将区块追加到区块链，并同步更新交易状态表。这是修改系统状态的唯一入口。

    Args:
        block: 待应用的区块数据字典。
    """

    # 1. 追加区块（append-only）
    append_block(block)

    block_type = block["type"]
    trade_id = block["trade_id"]

    # 2. 更新状态快照表
    if block_type == "CREATE":
        insert_trade(
            {
                "trade_id": trade_id,
                "seller_pubkey": block["payload"]["seller_pubkey"],
                "content_hash": block["payload"]["content_hash"],
                "description": block["payload"].get("description"),
                "price": block["payload"].get("price"),
                "status": "OPEN",
            }
        )

    elif block_type == "COMPLETE":
        update_trade_status(trade_id, "COMPLETED")

    elif block_type == "CANCEL":
        update_trade_status(trade_id, "CANCELLED")


def rebuild_state():
    """
    从区块链数据重建交易状态。

    清空当前交易表并遍历所有区块，仅用于系统初始化或修复。
    """
    from server.infrastructure.db.trades import clear_trades

    clear_trades()

    for block in get_all_blocks():
        block_type = block["type"]
        trade_id = block["trade_id"]

        if block_type == "CREATE":
            insert_trade(
                {
                    "trade_id": trade_id,
                    "seller_pubkey": block["payload"]["seller_pubkey"],
                    "content_hash": block["payload"]["content_hash"],
                    "status": "OPEN",
                }
            )

        elif block_type == "COMPLETE":
            update_trade_status(trade_id, "COMPLETED")

        elif block_type == "CANCEL":
            update_trade_status(trade_id, "CANCELLED")


def join_trade(trade_id: str, buyer_pubkey: str, buyer_chat_pubkey: dict | None = None):
    """
    更新交易信息，记录买家加入。

    Args:
        trade_id: 交易 ID。
        buyer_pubkey: 买家身份公钥。
        buyer_chat_pubkey: 可选，买家聊天公钥。
    """
    if buyer_chat_pubkey is None:
        buyer_chat_pubkey = {}

    update_trade_join(
        trade_id=trade_id,
        buyer_pubkey=buyer_pubkey,
        buyer_chat_pubkey=buyer_chat_pubkey,
    )


def get_trade_detail(trade_id: str):
    """
    获取交易的详细信息（包含聊天相关的公钥）。

    Args:
        trade_id: 交易 ID。

    Returns:
        dict: 交易详情字典。
    """
    return get_trade_with_chat_info(trade_id)


def get_trade_record(trade_id: str):
    """
    获取交易的基础数据库记录。

    Args:
        trade_id: 交易 ID。

    Returns:
        dict: 原始数据库记录字典。
    """
    return get_trade(trade_id)


def list_trade_records(limit: int = 50):
    """
    获取交易记录列表。

    Args:
        limit: 返回记录的最大数量，默认 50。

    Returns:
        list[dict]: 交易记录列表。
    """
    return db_list_trades(limit=limit)


# 聊天相关功能
# ============================================================


def get_trade_chat_info(trade_id: str):
    """
    获取交易的聊天配置信息。

    Args:
        trade_id: 交易 ID。

    Returns:
        Optional[dict]: 包含买卖双方公钥及状态的信息，未找到交易则返回 None。
    """
    trade = get_trade(trade_id)
    if trade is None:
        return None

    # 返回聊天相关信息
    return {
        "trade_id": trade["trade_id"],
        "seller_pubkey": trade["seller_pubkey"],
        "buyer_pubkey": trade.get("buyer_pubkey"),
        "seller_chat_pubkey": trade.get("seller_chat_pubkey"),
        "buyer_chat_pubkey": trade.get("buyer_chat_pubkey"),
        "status": trade["status"],
    }


def update_chat_pubkey(trade_id: str, identity_pubkey: str, chat_pubkey: str):
    """
    更新交易参与者的聊天公钥。

    根据身份公钥识别参与者角色并更新相应的聊天公钥。

    Args:
        trade_id: 交易 ID。
        identity_pubkey: 参与者的身份公钥。
        chat_pubkey: 该参与者的新聊天公钥。

    Returns:
        dict: 更新成功状态。

    Raises:
        Exception: 交易不存在或该用户不是交易的有效参与方。
    """
    trade = get_trade(trade_id)
    if trade is None:
        raise Exception("Trade not found")

    # 检查用户是否为交易参与方
    if trade["seller_pubkey"] == identity_pubkey:
        # 更新卖家聊天公钥
        update_trade_chat_pubkey(
            trade_id=trade_id,
            identity_pubkey=identity_pubkey,
            chat_pubkey=chat_pubkey,
            is_seller=True,
        )
    elif trade.get("buyer_pubkey") == identity_pubkey:
        # 更新买家聊天公钥
        update_trade_chat_pubkey(
            trade_id=trade_id,
            identity_pubkey=identity_pubkey,
            chat_pubkey=chat_pubkey,
            is_seller=False,
        )
    else:
        raise Exception("User is not a participant in this trade")

    return {"success": True}


def get_peer_chat_pubkey(trade_id: str, identity_pubkey: str):
    """
    获取交易对方的聊天公钥。

    Args:
        trade_id: 交易 ID。
        identity_pubkey: 调用者的身份公钥。

    Returns:
        Optional[str]: 对方的聊天公钥，如果未能成功识别对方则返回 None。
    """
    trade = get_trade(trade_id)
    if trade is None:
        return None

    # 确定对方身份
    if trade["seller_pubkey"] == identity_pubkey:
        # 自己是卖家，返回买家的聊天公钥
        return trade.get("buyer_chat_pubkey")
    elif trade.get("buyer_pubkey") == identity_pubkey:
        # 自己是买家，返回卖家的聊天公钥
        return trade.get("seller_chat_pubkey")
    else:
        return None
