import { httpGet, httpPost } from "./http.js";

/**
 * 获取聊天历史
 * GET /chat/history/{tradeId}
 * @param tradeId 交易ID
 * @param limit 历史消息数量限制
 * @returns 聊天历史列表
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
 * GET /chat/room/{tradeId}
 * @param tradeId 交易ID
 * @returns 房间详情
 */
export async function getChatRoomInfo(tradeId: string): Promise<any> {
  if (!tradeId) {
    throw new Error("getChatRoomInfo: tradeId required");
  }

  return httpGet(`/chat/room/${tradeId}`);
}

/**
 * 获取交易聊天信息
 * GET /trade/{tradeId}/chat-info
 * @param tradeId 交易ID
 * @returns 交易聊天相关元数据
 */
export async function getTradeChatInfo(tradeId: string): Promise<any> {
  if (!tradeId) {
    throw new Error("getTradeChatInfo: tradeId required");
  }

  return httpGet(`/trade/${tradeId}/chat-info`);
}

/**
 * 更新聊天公钥
 * POST /trade/{tradeId}/update-chat-pubkey
 * @param tradeId 交易ID
 * @param identityPubkey 身份公钥
 * @param chatPubkey 聊天公钥
 * @returns 更新结果
 */
export async function updateChatPubkey(tradeId: string, identityPubkey: string, chatPubkey: string): Promise<any> {
  return httpPost(`/trade/${tradeId}/update-chat-pubkey`, {
    identity_pubkey: identityPubkey,
    chat_pubkey: chatPubkey
  });
}

/**
 * 获取对方的聊天公钥
 * GET /trade/{tradeId}/peer-chat-pubkey/{identityPubkey}
 * @param tradeId 交易ID
 * @param identityPubkey 自身身份公钥
 * @returns 对方的聊天公钥
 */
export async function getPeerChatPubkey(tradeId: string, identityPubkey: string): Promise<any> {
  return httpGet(`/trade/${tradeId}/peer-chat-pubkey/${identityPubkey}`);
}

/**
 * 导出区块链（原始 blocks 表）
 * GET /blocks/export
 * @returns 区块链导出数据
 */
export async function exportBlocks(): Promise<any> {
  return httpGet("/blocks/export");
}
