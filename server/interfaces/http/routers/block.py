"""
区块链审计路由模块。

提供导出原始区块链数据的接口，用于审计或数据同步。
"""

from fastapi import APIRouter

from server.application.blockchain.service import get_raw_blocks

router = APIRouter(prefix="/blocks")


@router.get("/export")
async def export_blocks():
    """
    导出所有区块数据。

    直接从数据库中获取所有区块的原始记录。

    Returns:
        dict: 包含所有区块数据的字典。
    """
    blocks = get_raw_blocks()
    return {"blocks": blocks}
