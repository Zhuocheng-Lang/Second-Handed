/**
 * chat.ts - 聊天系统核心模块
 */

import {
  loadIdentityKeyPair,
  loadX25519KeyPair,
  deriveChatKey,
  encrypt,
  decrypt,
  generateFingerprint,
} from "./crypto.js";

import type { IdentityKeyPair, X25519KeyPair } from "./crypto.js";

import {
  openChatSocket,
  sendChatTextMessage,
  sendJoinMessage,
  getChatHistory,
  getTradeChatInfo,
  updateChatPubkey,
  closeChatSocket
} from "./api.js";

export interface ChatMessage {
  trade_id: string;
  sender_pubkey: string;
  content: string;
  timestamp: number | Date;
  type: string;
  isOwn: boolean;
}

export interface ChatSession {
  peerChatPubKey: string;
  chatKey: CryptoKey;
  messages: ChatMessage[];
  unread: number;
}

export interface ChatUICallbacks {
  onNewSession?: (sessionInfo: { chatPubKey: string; fingerprint: string }) => void;
  onNewMessage?: (payload: { sessionId: string; message: ChatMessage; unread: number }) => void;
  onSwitchSession?: (peerChatPubKey: string) => void;
}

let currentTradeId: string | null = null;
let socket: WebSocket | null = null;
let identity: IdentityKeyPair | null = null;
let chatKeyPair: X25519KeyPair | null = null;
let myChatPubKeyStr: string | null = null;
let isSeller = false;
let sellerChatPubKey: string | null = null;

const sessions = new Map<string, ChatSession>();
let currentSessionPeer: string | null = null;

let onNewSession: ChatUICallbacks["onNewSession"] = undefined;
let onNewMessage: ChatUICallbacks["onNewMessage"] = undefined;
let onSwitchSession: ChatUICallbacks["onSwitchSession"] = undefined;

export function isChatConnected(): boolean {
  return socket !== null && socket.readyState === 1; // 1 = OPEN
}

function normalizeChatPubKey(value: any): string | null {
  if (!value) return null;
  let key: any = value;
  if (typeof key === "string") {
    try {
      const parsed = JSON.parse(key);
      if (parsed && parsed.pubkey) key = parsed.pubkey;
    } catch (e) {}
  } else if (key.pubkey) {
    key = key.pubkey;
  }
  if (typeof key !== "string") return null;
  return /^[A-Za-z0-9+/=]+$/.test(key) ? key : null;
}

export async function initChat(tradeId: string, uiCallbacks: ChatUICallbacks = {}) {
  try {
    currentTradeId = tradeId;
    onNewSession = uiCallbacks.onNewSession;
    onNewMessage = uiCallbacks.onNewMessage;
    onSwitchSession = uiCallbacks.onSwitchSession;

    identity = await loadIdentityKeyPair();
    if (!identity) throw new Error("请先创建身份");

    chatKeyPair = await loadX25519KeyPair();
    myChatPubKeyStr = chatKeyPair.publicKey;

    try {
      await updateChatPubkey(tradeId, identity.publicKey, myChatPubKeyStr);
    } catch (e) {}

    const tradeChatInfo = await getTradeChatInfo(tradeId);
    await establishInitialSession(tradeChatInfo);

    socket = await openChatSocket(tradeId, identity.publicKey, myChatPubKeyStr, handleSocketMessage);
    if (myChatPubKeyStr) sendJoinMessage(myChatPubKeyStr);
    await loadChatHistory();

    return { success: true, sessions: Array.from(sessions.keys()) };
  } catch (error) {
    console.error("[chat] init failed", error);
    throw error;
  }
}

async function establishInitialSession(tradeChatInfo: any) {
  if (!identity) return;
  isSeller = tradeChatInfo.seller_pubkey === identity.publicKey;
  if (isSeller) {
    let pk = normalizeChatPubKey(tradeChatInfo.buyer_chat_pubkey);
    if (pk) await createSession(pk, false);
  } else {
    let pk = normalizeChatPubKey(tradeChatInfo.seller_chat_pubkey);
    if (pk) {
      sellerChatPubKey = pk;
      await createSession(pk, false);
    }
  }
}

async function createSession(peerChatPubKey: string, isInitiator = true): Promise<ChatSession> {
  if (sessions.has(peerChatPubKey)) return sessions.get(peerChatPubKey)!;

  if (!chatKeyPair || !currentTradeId) throw new Error("Chat not initialized");
  const chatKey = await deriveChatKey(chatKeyPair.privateKey, peerChatPubKey, currentTradeId);

  const session: ChatSession = {
    peerChatPubKey,
    chatKey,
    messages: [],
    unread: 0
  };

  sessions.set(peerChatPubKey, session);

  if (onNewSession) {
    const fingerprint = await generateFingerprint(peerChatPubKey);
    onNewSession({ chatPubKey: peerChatPubKey, fingerprint });
  }

  return session;
}

async function loadChatHistory() {
  if (!currentTradeId) return;
  try {
    const history = await getChatHistory(currentTradeId);
    for (const msg of history) {
      const senderPubKey = msg.sender_pubkey;
      const buyerChatPubKey = msg.buyer_chat_pubkey;

      if (!isSeller && sellerChatPubKey && senderPubKey !== sellerChatPubKey) continue;

      let session: ChatSession | null = null;
      if (senderPubKey && senderPubKey !== myChatPubKeyStr) {
        session = sessions.get(senderPubKey) || await createSession(senderPubKey, false);
      } else if (isSeller && buyerChatPubKey) {
        session = sessions.get(buyerChatPubKey) || await createSession(buyerChatPubKey, false);
      }

      if (session) {
        try {
          const decrypted = await decrypt(session.chatKey, JSON.parse(msg.ciphertext));
          session.messages.push({
            trade_id: currentTradeId,
            sender_pubkey: senderPubKey,
            content: decrypted.content || decrypted.message || "",
            timestamp: new Date(msg.timestamp * 1000),
            type: "chat",
            isOwn: senderPubKey === myChatPubKeyStr
          });
        } catch (e) {}
      }
    }
  } catch (e) {}
}

async function handleSocketMessage(msg: any) {
  try {
    const data = typeof msg === "string" ? JSON.parse(msg) : msg;
    if (data.type === "JOIN") await handleJoinMessage(data);
    else if (data.type === "CHAT") await handleChatMessage(data);
  } catch (e) {}
}

async function handleJoinMessage(msg: any) {
  const pk = normalizeChatPubKey(msg.chat_pubkey);
  if (!pk) return;
  if (!isSeller && sellerChatPubKey && pk !== sellerChatPubKey) return;
  await createSession(pk, false);
}

async function handleChatMessage(msg: any) {
  const sender = msg.sender_chat_pubkey;
  if (!sender || sender === myChatPubKeyStr || !currentTradeId) return;
  if (!isSeller && sellerChatPubKey && sender !== sellerChatPubKey) return;

  let session = sessions.get(sender) || await createSession(sender, false);
  try {
    const plaintext = await decrypt(session.chatKey, JSON.parse(msg.ciphertext));
    const messageObj: ChatMessage = {
      trade_id: currentTradeId,
      sender_pubkey: sender,
      content: plaintext.content || plaintext.message || "",
      timestamp: new Date(plaintext.timestamp || Date.now()),
      type: "chat",
      isOwn: false
    };
    session.messages.push(messageObj);
    if (currentSessionPeer !== sender) session.unread++;
    if (onNewMessage) onNewMessage({ sessionId: sender, message: messageObj, unread: session.unread });
  } catch (e) {}
}

export function switchSession(peerChatPubKey: string): boolean {
  if (!sessions.has(peerChatPubKey)) return false;
  currentSessionPeer = peerChatPubKey;
  if (onSwitchSession) onSwitchSession(peerChatPubKey);
  return true;
}

export function getCurrentSession(): ChatSession | null {
  return currentSessionPeer ? sessions.get(currentSessionPeer) || null : null;
}

export function getSessions(): string[] {
  return Array.from(sessions.keys());
}

export function getSession(pk: string): ChatSession | undefined {
  return sessions.get(pk);
}

export async function sendMessage(text: string): Promise<boolean> {
  if (!currentSessionPeer || !socket || !currentTradeId || !myChatPubKeyStr) return false;
  const session = sessions.get(currentSessionPeer);
  if (!session) return false;

  const plaintext = { trade_id: currentTradeId, sender_pubkey: myChatPubKeyStr, content: text, timestamp: Date.now(), type: "CHAT" };
  try {
    const ciphertext = await encrypt(session.chatKey, plaintext);
    socket.send(JSON.stringify({ type: "CHAT", trade_id: currentTradeId, sender_chat_pubkey: myChatPubKeyStr, ciphertext: JSON.stringify(ciphertext) }));
    const msg: ChatMessage = { trade_id: currentTradeId, sender_pubkey: myChatPubKeyStr, content: text, timestamp: new Date(), type: "chat", isOwn: true };
    session.messages.push(msg);
    if (onNewMessage) onNewMessage({ sessionId: currentSessionPeer, message: msg, unread: session.unread });
    return true;
  } catch (e) { return false; }
}

export async function listSessions() {
  const list = await Promise.all(Array.from(sessions.entries()).map(async ([pk, s]) => ({
    chatPubKey: pk,
    fingerprint: await generateFingerprint(pk),
    unread: s.unread,
    lastMessage: s.messages[s.messages.length - 1]
  })));
  return list;
}

export function getSessionMessages(pk: string) {
  return sessions.get(pk)?.messages || [];
}

export function closeChat() {
  closeChatSocket();
  currentTradeId = null;
  identity = null;
  chatKeyPair = null;
  myChatPubKeyStr = null;
  sessions.clear();
  currentSessionPeer = null;
}
