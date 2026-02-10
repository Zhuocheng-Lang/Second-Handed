import type { IdentityKeyPair } from "../../domain/crypto/index.js";

export const tradeState = {
  currentTradeId: null as string | null,
  currentTrade: null as any,
  currentIdentity: null as IdentityKeyPair | null,
};
