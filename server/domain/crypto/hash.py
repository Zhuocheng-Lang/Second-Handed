"""
加密哈希领域逻辑模块。

提供确定性 JSON 序列化和 SHA-256 哈希计算能力。
"""

import json
import hashlib
from typing import Any


def canonical_json(obj: Any) -> str:
    """
    将 Python 对象序列化为规范化的 JSON 字符串。

    通过对键进行排序并移除多余空格，确保相同的对象始终产生相同的字符串表示，
    从而保证哈希计算的确定性。

    Args:
        obj: 待序列化的 Python 对象。

    Returns:
        str: 规范化的 JSON 字符串。

    Raises:
        ValueError: 当对象无法以规范化形式进行 JSON 序列化时抛出。
    """

    try:
        return json.dumps(
            obj,
            sort_keys=True,  # 键顺序固定
            separators=(",", ":"),  # 去掉所有空格
            ensure_ascii=False,  # 保留 UTF-8，与前端一致
        )
    except (TypeError, ValueError) as e:
        # 不允许不确定序列化的对象
        raise ValueError("Object is not JSON-serializable in canonical form") from e


def hash_object(obj: Any) -> str:
    """
    计算任意 Python 对象的 SHA-256 哈希值。

    Args:
        obj: 待计算哈希的对象。

    Returns:
        str: 计算得到的十六进制哈希字符串。
    """

    canonical = canonical_json(obj)  # 规范化 JSON
    data = canonical.encode("utf-8")  # 明确转为 bytes
    digest = hashlib.sha256(data).hexdigest()  # SHA-256
    return digest
