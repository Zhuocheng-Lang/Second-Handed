import type { IdentityKeyPair, X25519KeyPair } from "../crypto/index.js";
import type { ChatSession, ChatUICallbacks } from "./types.js";

export const state = {
  currentTradeId: null as string | null,
  socket: null as WebSocket | null,
  identity: null as IdentityKeyPair | null,
  chatKeyPair: null as X25519KeyPair | null,
  myChatPubKeyStr: null as string | null,
  isSeller: false,
  sellerChatPubKey: null as string | null,
  sessions: new Map<string, ChatSession>(),
  currentSessionPeer: null as string | null,
  onNewSession: undefined as ChatUICallbacks["onNewSession"] | undefined,
  onNewMessage: undefined as ChatUICallbacks["onNewMessage"] | undefined,
  onSwitchSession: undefined as ChatUICallbacks["onSwitchSession"] | undefined,
};

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
