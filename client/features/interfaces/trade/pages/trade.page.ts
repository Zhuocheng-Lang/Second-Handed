import { loadIdentityKeyPair } from "../../../domain/crypto/index.js";
import { getTrade, joinTrade } from "../../api/index.js";
import * as chat from "../../../application/chat/index.js";
import { tradeState } from "../../../application/trade/state.js";
import { signComplete, signCompleteWithBody, submitComplete, cancelTrade } from "../../../domain/trade/domain.js";
import type { SignatureInfo } from "../../../domain/trade/domain.js";

const pageCss = `
:root {
  color-scheme: light;
}

* {
  box-sizing: border-box;
}

body {
  margin: 24px;
  font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif;
  background: #f7f7f9;
  color: #202124;
}

h1 {
  margin: 0 0 12px;
  font-size: 26px;
}

section {
  margin: 16px 0;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

button {
  margin: 6px 10px 0 0;
  padding: 6px 12px;
  border: 1px solid #888;
  background: #ffffff;
  border-radius: 6px;
  cursor: pointer;
}

button:hover {
  background: #f0f0f0;
}

.chat-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 12px;
}

.chat-sessions {
  border: 1px solid #d6d6d6;
  padding: 8px;
  background: #ffffff;
  border-radius: 6px;
  max-height: 280px;
  overflow: auto;
}

.session-item {
  padding: 6px 8px;
  margin-bottom: 6px;
  border: 1px solid #d1d1d1;
  border-radius: 6px;
  cursor: pointer;
  background: #f7f7f7;
}

.session-item.active {
  background: #e7f0ff;
  border-color: #7aa4ff;
}

.chat-window {
  border: 1px solid #d6d6d6;
  padding: 8px;
  background: #ffffff;
  border-radius: 6px;
}

#chat-messages {
  border: 1px solid #ccc;
  height: 200px;
  overflow: auto;
  padding: 5px;
  background: #fafafa;
}

.chat-input-bar {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.chat-input-bar input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #c8c8c8;
  border-radius: 6px;
}

.chat-message {
  margin: 6px 0;
  padding: 6px 8px;
  border-radius: 6px;
  max-width: 70%;
}

.own-message {
  background: #dff7e6;
  margin-left: auto;
}

.other-message {
  background: #f0f0f0;
}
`;

const pageHtml = `
  <h1>📘 交易详情</h1>

  <section>
    <div id="trade-info">加载中…</div>
  </section>

  <section>
    <h3>💬 聊天</h3>
    <div class="chat-layout">
      <div id="chat-sessions" class="chat-sessions"></div>
      <div class="chat-window">
        <div id="chat-messages"></div>
        <div class="chat-input-bar">
          <input id="chat-input" placeholder="输入消息" />
          <button id="send-btn">发送</button>
        </div>
      </div>
    </div>
  </section>

  <section>
    <button id="btn-complete">✅ 确认完成</button>
    <button id="btn-cancel">❌ 取消交易</button>
  </section>

  <button id="btn-back">⬅ 返回首页</button>
`;

function applyTemplate() {
  document.title = "交易详情";
  const style = document.createElement("style");
  style.textContent = pageCss;
  document.head.appendChild(style);
  document.body.innerHTML = pageHtml;
}

async function initTradePage(): Promise<void> {
  const tradeId = new URLSearchParams(location.search).get("trade_id");
  if (!tradeId) return;

  let trade = await getTrade(tradeId);
  const identity = await loadIdentityKeyPair();
  if (!identity) {
    alert("请先生成身份");
    return;
  }

  tradeState.currentTradeId = tradeId;
  tradeState.currentTrade = trade;
  tradeState.currentIdentity = identity;

  const info = document.getElementById("trade-info");
  if (info) info.textContent = `交易ID: ${trade.trade_id}\n状态: ${trade.status}`;

  await chat.initChat(tradeId, {
    onNewSession: handleNewSession,
    onNewMessage: handleNewMessage,
    onSwitchSession: handleSwitchSession
  });

  const sendBtn = document.getElementById("send-btn");
  const chatInput = document.getElementById("chat-input") as HTMLInputElement;
  if (sendBtn && chatInput) {
    sendBtn.onclick = async () => {
      const msg = chatInput.value.trim();
      if (msg && await chat.sendMessage(msg)) chatInput.value = "";
    };
  }

  if (trade.seller_pubkey === identity.publicKey) {
    if (!trade.buyer_pubkey && info) info.textContent += "\n等待买家加入…";
  } else if (!trade.buyer_pubkey) {
    await joinTrade(tradeId, { buyer_pubkey: identity.publicKey });
    trade = await getTrade(tradeId);
  }
}

function handleNewSession(sessionInfo: { chatPubKey: string; fingerprint: string }) {
  const list = document.getElementById("chat-sessions");
  if (!list) return;
  const pk = sessionInfo.chatPubKey;
  const item = document.createElement("div");
  item.className = "session-item";
  item.textContent = pk.slice(0, 12) + "...";
  item.onclick = () => {
    chat.switchSession(pk);
    document.querySelectorAll(".session-item").forEach(i => i.classList.remove("active"));
    item.classList.add("active");
  };
  if (list.children.length === 0) {
    chat.switchSession(pk);
    item.classList.add("active");
  }
  list.appendChild(item);
}

function handleSwitchSession(pk: string) {
  const container = document.getElementById("chat-messages");
  if (container) {
    container.innerHTML = "";
    renderMessages(pk);
  }
}

function handleNewMessage(payload: { sessionId: string; message: any }) {
  const current = chat.getCurrentSession();
  if (current && current.peerChatPubKey === payload.sessionId) renderMessages(payload.sessionId);

  if (!payload.message.isOwn) {
    try {
      const p = JSON.parse(payload.message.content);
      if (p.type === "TRADE_COMPLETE_REQUEST") {
        (window as any).__pendingPeerSig = p.signature;
        alert("对方已请求完成交易，请点击“确认完成”。");
      }
    } catch (e) { }
  }
}

function renderMessages(pk: string) {
  const container = document.getElementById("chat-messages");
  const session = chat.getSession(pk);
  if (!container || !session) return;
  container.innerHTML = "";
  session.messages.forEach(m => {
    const div = document.createElement("div");
    div.className = "chat-message " + (m.isOwn ? "own-message" : "other-message");
    div.textContent = m.content;
    container.appendChild(div);
  });
  container.scrollTop = container.scrollHeight;
}

async function confirmCompleteTrade() {
  if (!tradeState.currentTradeId || !tradeState.currentTrade || !tradeState.currentIdentity) return;
  if (!chat.isChatConnected()) { alert("等待聊天连接..."); return; }

  const pending = (window as any).__pendingPeerSig;
  if (!pending) {
    const sig = await signComplete(tradeState.currentTradeId);
    await chat.sendMessage(JSON.stringify({ type: "TRADE_COMPLETE_REQUEST", trade_id: tradeState.currentTradeId, signature: sig }));
    alert("完成请求已发送");
    return;
  }

  const mySig = await signCompleteWithBody(pending.body);
  const trade = tradeState.currentTrade;
  let s: SignatureInfo, b: SignatureInfo;
  if (pending.pubkey === trade.seller_pubkey) { s = pending; b = mySig; }
  else { s = mySig; b = pending; }

  await submitComplete(tradeState.currentTradeId, s, b);
  alert("交易已完成");
  location.reload();
}

async function cancelCurrentTrade() {
  const tid = new URLSearchParams(location.search).get("trade_id");
  if (tid && confirm("确定取消？")) {
    await cancelTrade(tid);
    location.reload();
  }
}

function wireEvents() {
  document.getElementById("btn-complete")?.addEventListener("click", () => {
    void confirmCompleteTrade();
  });

  document.getElementById("btn-cancel")?.addEventListener("click", () => {
    void cancelCurrentTrade();
  });

  document.getElementById("btn-back")?.addEventListener("click", () => {
    location.href = "../";
  });
}

function bootstrap() {
  applyTemplate();
  wireEvents();
  void initTradePage();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
