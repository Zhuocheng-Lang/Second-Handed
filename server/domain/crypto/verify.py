"""
加密验证领域逻辑模块。

负责 Ed25519 签名的验证，对接前端生成的加密数据。
参数对应关系：
- 公钥：Base64 编码的 Ed25519 原始公钥。
- 哈希：十六进制编码的 SHA-256 摘要。
- 签名：Base64 编码的 Ed25519 签名。
"""

import base64
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.exceptions import InvalidSignature


def _b64_to_bytes(data: str) -> bytes:
    """内部函数：将 Base64 字符串转换为字节序列。"""
    return base64.b64decode(data.encode("utf-8"))


def _hex_to_bytes(data: str) -> bytes:
    """内部函数：将十六进制字符串转换为字节序列。"""
    return bytes.fromhex(data)


def verify_signature(pubkey: str, hash: str, signature: str) -> bool:
    """
    验证给定的签名是否是通过私钥对特定哈希值签署的。

    Args:
        pubkey: Base64 编码的 Ed25519 公钥。
        hash: 十六进制字符串表示的哈希值。
        signature: Base64 编码的签名。

    Returns:
        bool: 验证成功返回 True，否则返回 False。
    """
    try:
        pk_bytes = _b64_to_bytes(pubkey)
        sig_bytes = _b64_to_bytes(signature)
        hash_bytes = _hex_to_bytes(hash)

        pk = Ed25519PublicKey.from_public_bytes(pk_bytes)
        pk.verify(sig_bytes, hash_bytes)
        return True

    except (InvalidSignature, ValueError):
        return False
