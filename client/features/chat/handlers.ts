import { decrypt } from "../crypto/index.js";
import { state } from "./state.js";
import { createSession } from "./session.js";
import type { ChatMessage, ChatSession } from "./types.js";
import { normalizeChatPubKey } from "./normalize.js";

export async function handleSocketMessage(msg: any) {
  try {
    const data = typeof msg === "string" ? JSON.parse(msg) : msg;
    if (data.type === "JOIN") await handleJoinMessage(data);
    else if (data.type === "CHAT") await handleChatMessage(data);
  } catch (e) {}
}

async function handleJoinMessage(msg: any) {
  const pk = normalizeChatPubKey(msg.chat_pubkey);
  if (!pk) return;
  if (!state.isSeller && state.sellerChatPubKey && pk !== state.sellerChatPubKey) return;
  await createSession(pk, false);
}

async function handleChatMessage(msg: any) {
  const sender = msg.sender_chat_pubkey;
  if (!sender || sender === state.myChatPubKeyStr || !state.currentTradeId) return;
  if (!state.isSeller && state.sellerChatPubKey && sender !== state.sellerChatPubKey) return;

  const session: ChatSession = state.sessions.get(sender) || await createSession(sender, false);
  try {
    const plaintext = await decrypt(session.chatKey, JSON.parse(msg.ciphertext));
    const messageObj: ChatMessage = {
      trade_id: state.currentTradeId,
      sender_pubkey: sender,
      content: plaintext.content || plaintext.message || "",
      timestamp: new Date(plaintext.timestamp || Date.now()),
      type: "chat",
      isOwn: false
    };
    session.messages.push(messageObj);
    if (state.currentSessionPeer !== sender) session.unread++;
    if (state.onNewMessage) state.onNewMessage({ sessionId: sender, message: messageObj, unread: session.unread });
  } catch (e) {}
}
