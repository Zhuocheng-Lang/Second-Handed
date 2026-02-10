import { deriveChatKey, decrypt, generateFingerprint } from "../../domain/crypto/index.js";
import { getChatHistory } from "../../interfaces/api/index.js";
import { state } from "./state.js";
import type { ChatSession } from "./types.js";
import { normalizeChatPubKey } from "./normalize.js";

/**
 * 根据交易信息建立初始聊天会话
 * @param tradeChatInfo 交易相关的聊天元数据
 */
export async function establishInitialSession(tradeChatInfo: any) {
  if (!state.identity) return;
  state.isSeller = tradeChatInfo.seller_pubkey === state.identity.publicKey;
  if (state.isSeller) {
    const pk = normalizeChatPubKey(tradeChatInfo.buyer_chat_pubkey);
    if (pk) await createSession(pk, false);
  } else {
    const pk = normalizeChatPubKey(tradeChatInfo.seller_chat_pubkey);
    if (pk) {
      state.sellerChatPubKey = pk;
      await createSession(pk, false);
    }
  }
}

/**
 * 创建或获取与特定对端的聊天会话
 * @param peerChatPubKey 对端聊天公钥
 * @param isInitiator 是否为发起方
 * @returns 聊天会话对象
 */
export async function createSession(peerChatPubKey: string, isInitiator = true): Promise<ChatSession> {
  if (state.sessions.has(peerChatPubKey)) return state.sessions.get(peerChatPubKey)!;

  if (!state.chatKeyPair || !state.currentTradeId) throw new Error("Chat not initialized");
  const chatKey = await deriveChatKey(state.chatKeyPair.privateKey, peerChatPubKey, state.currentTradeId);

  const session: ChatSession = {
    peerChatPubKey,
    chatKey,
    messages: [],
    unread: 0
  };

  state.sessions.set(peerChatPubKey, session);

  if (state.onNewSession) {
    const fingerprint = await generateFingerprint(peerChatPubKey);
    state.onNewSession({ chatPubKey: peerChatPubKey, fingerprint });
  }

  return session;
}

/**
 * 从服务器加载并解密聊天历史记录
 */
export async function loadChatHistory() {
  if (!state.currentTradeId) return;
  try {
    const history = await getChatHistory(state.currentTradeId);
    for (const msg of history) {
      const senderPubKey = msg.sender_pubkey;
      const buyerChatPubKey = msg.buyer_chat_pubkey;

      if (!state.isSeller && state.sellerChatPubKey && senderPubKey !== state.sellerChatPubKey) continue;

      let session: ChatSession | null = null;
      if (senderPubKey && senderPubKey !== state.myChatPubKeyStr) {
        session = state.sessions.get(senderPubKey) || await createSession(senderPubKey, false);
      } else if (state.isSeller && buyerChatPubKey) {
        session = state.sessions.get(buyerChatPubKey) || await createSession(buyerChatPubKey, false);
      }

      if (session) {
        try {
          const decrypted = await decrypt(session.chatKey, JSON.parse(msg.ciphertext));
          session.messages.push({
            trade_id: state.currentTradeId,
            sender_pubkey: senderPubKey,
            content: decrypted.content || decrypted.message || "",
            timestamp: new Date(msg.timestamp * 1000),
            type: "chat",
            isOwn: senderPubKey === state.myChatPubKeyStr
          });
        } catch (e) { }
      }
    }
  } catch (e) { }
}
