import { httpGet, httpPost } from "./http.js";

/**
 * 获取聊天历史
 */
export async function getChatHistory(tradeId: string, limit: number = 100): Promise<any[]> {
  if (!tradeId) {
    throw new Error("getChatHistory: tradeId required");
  }

  const response = await httpGet(`/chat/history/${tradeId}?limit=${limit}`);
  return response.messages || [];
}

/**
 * 获取聊天房间信息
 */
export async function getChatRoomInfo(tradeId: string): Promise<any> {
  if (!tradeId) {
    throw new Error("getChatRoomInfo: tradeId required");
  }

  return httpGet(`/chat/room/${tradeId}`);
}

/**
 * 获取交易聊天信息
 */
export async function getTradeChatInfo(tradeId: string): Promise<any> {
  if (!tradeId) {
    throw new Error("getTradeChatInfo: tradeId required");
  }

  return httpGet(`/trade/${tradeId}/chat-info`);
}

/**
 * 更新聊天公钥
 */
export async function updateChatPubkey(tradeId: string, identityPubkey: string, chatPubkey: string): Promise<any> {
  return httpPost(`/trade/${tradeId}/update-chat-pubkey`, {
    identity_pubkey: identityPubkey,
    chat_pubkey: chatPubkey
  });
}

/**
 * 获取对方的聊天公钥
 */
export async function getPeerChatPubkey(tradeId: string, identityPubkey: string): Promise<any> {
  return httpGet(`/trade/${tradeId}/peer-chat-pubkey/${identityPubkey}`);
}

/**
 * 导出区块链（原始 blocks 表）
 */
export async function exportBlocks(): Promise<any> {
  return httpGet("/blocks/export");
}
