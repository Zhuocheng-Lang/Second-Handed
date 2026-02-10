import { API_BASE } from "./http.js";

/** WebSocket 全局状态 */
let chatSocket: WebSocket | null = null;
let chatSocketCallbacks: ((data: any) => void)[] = [];

let currentTradeId: string | null = null;
let currentIdentityPubkey: string | null = null;

/**
 * 打开聊天 WebSocket 连接
 * @param tradeId 交易ID
 * @param identityPubkey 身份公钥
 * @param chatPubkey 临时聊天公钥（用于加密）
 * @param onMessage 收到消息时的回调函数
 * @returns WebSocket 实例
 */
export async function openChatSocket(tradeId: string, identityPubkey: string, chatPubkey: string | null, onMessage: (data: any) => void): Promise<WebSocket> {
  if (!tradeId || !identityPubkey) {
    throw new Error("openChatSocket: tradeId and identityPubkey required");
  }

  if (chatSocket) {
    chatSocket.close();
    chatSocket = null;
    chatSocketCallbacks = [];
  }

  currentTradeId = tradeId;
  currentIdentityPubkey = identityPubkey;

  let wsHost: string;
  if (API_BASE) {
    try {
      wsHost = new URL(API_BASE).host;
    } catch (e) {
      wsHost = location.host;
    }
  } else {
    wsHost = location.host;
  }

  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const wsUrl = `${protocol}://${wsHost}/ws/chat/${tradeId}`;

  chatSocket = new WebSocket(wsUrl);
  chatSocketCallbacks.push(onMessage);

  return new Promise((resolve, reject) => {
    let resolved = false;

    if (!chatSocket) return;

    chatSocket.onopen = async () => {
      console.log("[chat] WebSocket 连接已建立");

      const authMessage = {
        type: "auth",
        identity_pubkey: identityPubkey,
        chat_pubkey: chatPubkey || null
      };

      chatSocket?.send(JSON.stringify(authMessage));
      console.log("[chat] 发送认证信息");
    };

    chatSocket.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "auth_response") {
          console.log("[chat] 收到认证响应:", data.success ? "成功" : "失败");
          if (data.success && !resolved) {
            resolved = true;
            resolve(chatSocket!);
          }
          return;
        }

        chatSocketCallbacks.forEach(callback => callback(data));
      } catch (error) {
        console.error("[chat] 解析消息失败:", error);
        chatSocketCallbacks.forEach(callback => callback(event.data));
      }
    };

    chatSocket.onerror = (err) => {
      console.error("[chat] WebSocket 错误", err);
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    };

    chatSocket.onclose = () => {
      console.log("[chat] WebSocket 连接已关闭");
      chatSocket = null;
      chatSocketCallbacks = [];
    };

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("WebSocket连接超时"));
      }
    }, 5000);
  });
}

/**
 * 发送聊天消息
 * @param message 消息对象
 */
export function sendChatMessage(message: any): void {
  if (!chatSocket) {
    throw new Error("sendChatMessage: socket not initialized");
  }

  if (chatSocket.readyState !== WebSocket.OPEN) {
    throw new Error(`sendChatMessage: socket not connected (state: ${chatSocket.readyState})`);
  }

  chatSocket.send(JSON.stringify(message));
}

/**
 * 发送聊天文本消息
 * @param ciphertext 加密后的文本内容
 * @param senderChatPubkey 发送者聊天公钥
 * @param buyerChatPubkey 买家聊天公钥（选填）
 */
export function sendChatTextMessage(ciphertext: any, senderChatPubkey: string, buyerChatPubkey: string | null): void {
  const message = {
    type: "CHAT",
    trade_id: currentTradeId,
    sender_chat_pubkey: senderChatPubkey,
    buyer_chat_pubkey: buyerChatPubkey || senderChatPubkey,
    ciphertext: ciphertext
  };

  sendChatMessage(message);
}

/**
 * 发送 JOIN 消息
 * @param chatPubkey 聊天公钥
 */
export function sendJoinMessage(chatPubkey: string): void {
  const message = {
    type: "JOIN",
    trade_id: currentTradeId,
    identity_pubkey: currentIdentityPubkey,
    chat_pubkey: chatPubkey
  };

  sendChatMessage(message);
}

/**
 * 关闭聊天连接
 */
export function closeChatSocket(): void {
  if (chatSocket) {
    chatSocket.close();
    chatSocket = null;
    chatSocketCallbacks = [];
    currentTradeId = null;
    currentIdentityPubkey = null;
  }
}
