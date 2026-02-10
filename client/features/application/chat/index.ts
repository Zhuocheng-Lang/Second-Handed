import {
  loadIdentityKeyPair,
  loadX25519KeyPair,
  encrypt,
  generateFingerprint,
} from "../../domain/crypto/index.js";

import {
  openChatSocket,
  sendJoinMessage,
  getTradeChatInfo,
  updateChatPubkey,
  closeChatSocket
} from "../../interfaces/api/index.js";

import type { ChatUICallbacks, ChatSession } from "./types.js";
import { state, resetState } from "./state.js";
import { establishInitialSession, loadChatHistory } from "./session.js";
import { handleSocketMessage } from "./handlers.js";

export function isChatConnected(): boolean {
  return state.socket !== null && state.socket.readyState === 1;
}

export async function initChat(tradeId: string, uiCallbacks: ChatUICallbacks = {}) {
  try {
    state.currentTradeId = tradeId;
    state.onNewSession = uiCallbacks.onNewSession;
    state.onNewMessage = uiCallbacks.onNewMessage;
    state.onSwitchSession = uiCallbacks.onSwitchSession;

    state.identity = await loadIdentityKeyPair();
    if (!state.identity) throw new Error("请先创建身份");

    state.chatKeyPair = await loadX25519KeyPair();
    state.myChatPubKeyStr = state.chatKeyPair.publicKey;

    try {
      await updateChatPubkey(tradeId, state.identity.publicKey, state.myChatPubKeyStr);
    } catch (e) { }

    const tradeChatInfo = await getTradeChatInfo(tradeId);
    await establishInitialSession(tradeChatInfo);

    state.socket = await openChatSocket(tradeId, state.identity.publicKey, state.myChatPubKeyStr, handleSocketMessage);
    if (state.myChatPubKeyStr) sendJoinMessage(state.myChatPubKeyStr);
    await loadChatHistory();

    return { success: true, sessions: Array.from(state.sessions.keys()) };
  } catch (error) {
    console.error("[chat] init failed", error);
    throw error;
  }
}

export function switchSession(peerChatPubKey: string): boolean {
  if (!state.sessions.has(peerChatPubKey)) return false;
  state.currentSessionPeer = peerChatPubKey;
  if (state.onSwitchSession) state.onSwitchSession(peerChatPubKey);
  return true;
}

export function getCurrentSession(): ChatSession | null {
  return state.currentSessionPeer ? state.sessions.get(state.currentSessionPeer) || null : null;
}

export function getSessions(): string[] {
  return Array.from(state.sessions.keys());
}

export function getSession(pk: string): ChatSession | undefined {
  return state.sessions.get(pk);
}

export async function sendMessage(text: string): Promise<boolean> {
  if (!state.currentSessionPeer || !state.socket || !state.currentTradeId || !state.myChatPubKeyStr) return false;
  const session = state.sessions.get(state.currentSessionPeer);
  if (!session) return false;

  const plaintext = { trade_id: state.currentTradeId, sender_pubkey: state.myChatPubKeyStr, content: text, timestamp: Date.now(), type: "CHAT" };
  try {
    const ciphertext = await encrypt(session.chatKey, plaintext);
    state.socket.send(JSON.stringify({ type: "CHAT", trade_id: state.currentTradeId, sender_chat_pubkey: state.myChatPubKeyStr, ciphertext: JSON.stringify(ciphertext) }));
    const msg = { trade_id: state.currentTradeId, sender_pubkey: state.myChatPubKeyStr, content: text, timestamp: new Date(), type: "chat", isOwn: true };
    session.messages.push(msg);
    if (state.onNewMessage) state.onNewMessage({ sessionId: state.currentSessionPeer, message: msg, unread: session.unread });
    return true;
  } catch (e) { return false; }
}

export async function listSessions() {
  const list = await Promise.all(Array.from(state.sessions.entries()).map(async ([pk, s]) => ({
    chatPubKey: pk,
    fingerprint: await generateFingerprint(pk),
    unread: s.unread,
    lastMessage: s.messages[s.messages.length - 1]
  })));
  return list;
}

export function getSessionMessages(pk: string) {
  return state.sessions.get(pk)?.messages || [];
}

export function closeChat() {
  closeChatSocket();
  resetState();
}
