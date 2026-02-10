import type { IdentityKeyPair, X25519KeyPair } from "../../domain/crypto/index.js";
import type { ChatSession, ChatUICallbacks } from "./types.js";

/** 聊天功能全局状态管理 */
export const state = {
  /** 当前关联的交易 ID */
  currentTradeId: null as string | null,
  /** WebSocket 实例 */
  socket: null as WebSocket | null,
  /** 当前用户身份密钥对 */
  identity: null as IdentityKeyPair | null,
  /** 当前会话加密密钥对 */
  chatKeyPair: null as X25519KeyPair | null,
  /** 当前用户聊天公钥字符串 */
  myChatPubKeyStr: null as string | null,
  /** 是否为卖家 */
  isSeller: false,
  /** 卖家聊天公钥（仅在非卖家视图时有效） */
  sellerChatPubKey: null as string | null,
  /** 会话列表映射 (peerChatPubKey -> Session) */
  sessions: new Map<string, ChatSession>(),
  /** 当前激活的会话对端公钥 */
  currentSessionPeer: null as string | null,

  // UI 回调函数
  onNewSession: undefined as ChatUICallbacks["onNewSession"] | undefined,
  onNewMessage: undefined as ChatUICallbacks["onNewMessage"] | undefined,
  onSwitchSession: undefined as ChatUICallbacks["onSwitchSession"] | undefined,
};

/** 重置聊天状态（用于切换交易或退出时） */
export function resetState(): void {
  state.currentTradeId = null;
  state.socket = null;
  state.identity = null;
  state.chatKeyPair = null;
  state.myChatPubKeyStr = null;
  state.isSeller = false;
  state.sellerChatPubKey = null;
  state.sessions.clear();
  state.currentSessionPeer = null;
  state.onNewSession = undefined;
  state.onNewMessage = undefined;
  state.onSwitchSession = undefined;
}
