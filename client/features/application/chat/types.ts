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
