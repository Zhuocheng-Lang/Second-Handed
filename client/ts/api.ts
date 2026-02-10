/**
 * api.ts
 *
 * 职责：
 * - 所有 HTTP / WebSocket 通信
 * - 不做签名、不做加密、不理解业务
 */

// FastAPI 运行在 8000 端口，如果不是，自己改为实际后端地址

const API_BASE = "http://127.0.0.1:8000"; // 开发环境：指向 FastAPI 后端

/*
 * HTTP 工具函数
 * */

async function httpGet(path: string, options: { headers?: Record<string, string> } = {}) {
  console.log(`[api] 发送GET请求: ${path}`);
  const res = await fetch(API_BASE + path, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept": "application/json",
      "Origin": "http://127.0.0.1:8000",
      ...options.headers,
    },
  });

  if (!res.ok) {
    console.error(`[api] GET请求失败: ${path}, 状态码: ${res.status}`);
    throw new Error(`GET ${path} failed: ${res.status}`);
  }

  const data = await res.json();
  console.log(`[api] GET请求成功: ${path}, 响应数据:`, data);
  return data;
}

async function httpPost(path: string, body: any) {
  console.log(`[api] 发送POST请求: ${path}, 请求数据:`, body);
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[api] POST请求失败: ${path}, 状态码: ${res.status}, 错误信息: ${text}`);
    throw new Error(`POST ${path} failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  console.log(`[api] POST请求成功: ${path}, 响应数据:`, data);
  return data;
}

/*
 * Trade HTTP APIs
 * */

/**
 * 获取交易列表
 * GET /trade/list
 */
export async function fetchTradeList(): Promise<any[]> {
  return httpGet("/trade/list");
}

/**
 * 获取单个交易详情
 * GET /trade/{id}
 */
export async function getTrade(tradeId: string): Promise<any> {
  if (!tradeId) {
    throw new Error("getTrade: tradeId required");
  }
  return httpGet(`/trade/${tradeId}`);
}

/**
 * 创建交易
 * POST /trade/create
 *
 * payload 结构由 trade.js 负责
 */
export async function createTrade(payload: any): Promise<any> {
  return httpPost("/trade/create", payload);
}

/**
 * 加入交易
 * POST /trade/{id}/join
 */
export async function joinTrade(tradeId: string, payload: any): Promise<any> {
  return httpPost(`/trade/${tradeId}/join`, payload);
}

/**
 * 完成交易（双签）
 * POST /trade/complete
 */
export async function completeTrade(payload: any): Promise<any> {
  return httpPost("/trade/complete", payload);
}

/**
 * 取消交易
 * POST /trade/cancel
 */
export async function cancelTrade(payload: any): Promise<any> {
  return httpPost("/trade/cancel", payload);
}

/*
 * WebSocket Chat API - 注意：普通版已移除，仅保留增强版
 * */

// WebSocket 全局变量
let chatSocket: WebSocket | null = null;
let chatSocketCallbacks: ((data: any) => void)[] = [];

// 保留普通版的历史聊天消息获取函数，因为增强版的实现兼容已移除普通版的getChatHistory函数，使用增强版替代

/* 
 * WebSocket Chat API - 增强版
  */


let currentTradeId: string | null = null;
let currentIdentityPubkey: string | null = null;

/**
 * 打开聊天 WebSocket 连接
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

  // 构建 WebSocket URL
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

      // 发送认证信息
      const authMessage = {
        type: 'auth',
        identity_pubkey: identityPubkey,
        chat_pubkey: chatPubkey || null
      };

      chatSocket?.send(JSON.stringify(authMessage));
      console.log("[chat] 发送认证信息");
    };

    chatSocket.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        // 处理认证响应
        if (data.type === 'auth_response') {
          console.log('[chat] 收到认证响应:', data.success ? '成功' : '失败');
          if (data.success && !resolved) {
            resolved = true;
            resolve(chatSocket!);
          }
          return;
        }

        // 处理其他消息
        chatSocketCallbacks.forEach(callback => callback(data));
      } catch (error) {
        console.error("[chat] 解析消息失败:", error);
        // 如果不是JSON，直接传递原始数据
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

    // 设置超时
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
 * 发送JOIN消息
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
 * 导出区块链（原始 blocks 表）
 */
export async function exportBlocks(): Promise<any> {
  return httpGet("/blocks/export");
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