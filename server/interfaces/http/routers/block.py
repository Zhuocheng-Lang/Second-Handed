from fastapi import APIRouter

from server.application.blockchain.service import get_raw_blocks

router = APIRouter(prefix="/blocks")


@router.get("/export")
async def export_blocks():
    """
    导出区块链全部数据（原始 blocks 表）
    """
    blocks = get_raw_blocks()
    return {"blocks": blocks}
