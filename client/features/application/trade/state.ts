import type { IdentityKeyPair } from "../../domain/crypto/index.js";

/** 交易功能全局状态管理 */
export const tradeState = {
  /** 当前交易 ID */
  currentTradeId: null as string | null,
  /** 当前交易完整数据 */
  currentTrade: null as any,
  /** 当前用户身份密钥对 */
  currentIdentity: null as IdentityKeyPair | null,
};
