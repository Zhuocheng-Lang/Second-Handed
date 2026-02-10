import {
  loadIdentityKeyPair,
  hash,
  sign,
  verify,
} from "./crypto.js";

import type { IdentityKeyPair } from "./crypto.js";

import {
  fetchTradeList,
  getTrade,
  createTrade,
  joinTrade,
  completeTrade,
  cancelTrade as apiCancelTrade,
  exportBlocks as apiExportBlocks,
} from "./api.js";

import * as chat from "./chat.js";

import { saveTradeMeta, loadTradeMeta } from "./trade_meta.js";

export interface TradeContent {
  description: string;
  price: string | number;
}

export interface TradeBody {
  trade_id: string | null;
  seller_pubkey: string;
  content_hash: string;
  description: string;
  price: string | number;
  timestamp: number;
}

export interface SignatureInfo {
  hash: string;
  signature: string;
  pubkey: string;
  body: any;
}

let currentTradeId: string | null = null;
let currentTrade: any = null;
let currentIdentity: IdentityKeyPair | null = null;

/*=======================
 * 一、纯交易逻辑
   =====================*/

export async function publishTrade(tradeContent: TradeContent): Promise<string> {
  const identity = await loadIdentityKeyPair();
  if (!identity) throw new Error("请先生成身份");
  const { publicKey, privateKey } = identity;
  const timestamp = Math.floor(Date.now() / 1000);

  const contentHash = await hash(tradeContent);
  saveTradeMeta(contentHash, {
    description: tradeContent.description,
    price: tradeContent.price,
  });

  const body: TradeBody = {
    trade_id: null,
    seller_pubkey: publicKey,
    content_hash: contentHash,
    description: tradeContent.description,
    price: tradeContent.price,
    timestamp,
  };

  const tradeId = await hash(body);
  body.trade_id = tradeId;
  const signature = await sign(tradeId, privateKey);

  await createTrade({ trade_id: tradeId, body, signature });
  return tradeId;
}

export async function signComplete(tradeId: string): Promise<SignatureInfo> {
  const identity = await loadIdentityKeyPair();
  if (!identity) throw new Error("请先生成身份");
  const { publicKey, privateKey } = identity;

  const body = {
    trade_id: tradeId,
    result: "COMPLETED",
    timestamp: Math.floor(Date.now() / 1000),
  };

  const completeHash = await hash(body);
  const signature = await sign(completeHash, privateKey);

  return { hash: completeHash, signature, pubkey: publicKey, body };
}

export async function submitComplete(tradeId: string, sigA: SignatureInfo, sigB: SignatureInfo): Promise<void> {
  const localHash = await hash(sigA.body);
  if (localHash !== sigA.hash || sigA.hash !== sigB.hash) throw new Error("签名校验错误: 哈希不匹配");

  if (!(await verify(sigA.hash, sigA.signature, sigA.pubkey)) || !(await verify(sigB.hash, sigB.signature, sigB.pubkey))) {
    throw new Error("签名校验错误: 签名无效");
  }

  await completeTrade({ trade_id: tradeId, hash: sigA.hash, sig_seller: sigA.signature, sig_buyer: sigB.signature });
}

export async function cancelTrade(tradeId: string): Promise<void> {
  const identity = await loadIdentityKeyPair();
  if (!identity) throw new Error("请先生成身份");
  const { privateKey } = identity;

  const body = { trade_id: tradeId, result: "CANCELLED", timestamp: Math.floor(Date.now() / 1000) };
  const cancelHash = await hash(body);
  const signature = await sign(cancelHash, privateKey);

  await apiCancelTrade({ trade_id: tradeId, hash: cancelHash, signature });
}

/* 
 * 二、index.html
  */

export async function initIndexPage(): Promise<void> {
  const tradesResp = await fetchTradeList();
  const list = document.getElementById("trade-list");
  const empty = document.getElementById("trade-empty");
  if (!list || !empty) return;

  list.innerHTML = "";
  const trades = Array.isArray(tradesResp) ? tradesResp : (tradesResp as any).data || [];

  if (trades.length === 0) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";
  const metaMap = loadTradeMeta();

  for (const t of trades) {
    const li = document.createElement("li");
    li.className = "trade-item";
    const meta = metaMap[t.content_hash];
    const title = t.description || meta?.description || t.content_hash.slice(0, 12);
    const price = t.price || meta?.price || "";
    li.textContent = `${title} ${price} ｜ ${t.status}`;
    li.onclick = () => { location.href = `trade.html?trade_id=${t.trade_id}`; };
    list.appendChild(li);
  }
}

/* 
 * 三、publish.html
   */

export async function publishTradeFromForm(): Promise<void> {
  const desc = (document.getElementById("desc") as HTMLInputElement)?.value;
  const price = (document.getElementById("price") as HTMLInputElement)?.value;
  if (!desc || !price) return;

  const tradeId = await publishTrade({ description: desc, price });
  location.href = `trade.html?trade_id=${tradeId}`;
}

/* 
 * 四、trade.html
   */

export async function initTradePage(): Promise<void> {
  const tradeId = new URLSearchParams(location.search).get("trade_id");
  if (!tradeId) return;

  let trade = await getTrade(tradeId);
  const identity = await loadIdentityKeyPair();
  if (!identity) {
    alert("请先生成身份");
    return;
  }

  currentTradeId = tradeId;
  currentTrade = trade;
  currentIdentity = identity;

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
  else {
     // Handle unread logic if needed
  }

  if (!payload.message.isOwn) {
    try {
      const p = JSON.parse(payload.message.content);
      if (p.type === "TRADE_COMPLETE_REQUEST") {
        (window as any).__pendingPeerSig = p.signature;
        alert("对方已请求完成交易，请点击“确认完成”。");
      }
    } catch(e) {}
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

export async function confirmCompleteTrade() {
  if (!currentTradeId || !currentTrade || !currentIdentity) return;
  if (!chat.isChatConnected()) { alert("等待聊天连接..."); return; }

  const pending = (window as any).__pendingPeerSig;
  if (!pending) {
    const sig = await signComplete(currentTradeId);
    await chat.sendMessage(JSON.stringify({ type: "TRADE_COMPLETE_REQUEST", trade_id: currentTradeId, signature: sig }));
    alert("完成请求已发送");
    return;
  }

  const mySig = await signCompleteWithBody(pending.body);
  const trade = currentTrade;
  let s: SignatureInfo, b: SignatureInfo;
  if (pending.pubkey === trade.seller_pubkey) { s = pending; b = mySig; }
  else { s = mySig; b = pending; }

  await submitComplete(currentTradeId, s, b);
  alert("交易已完成");
  location.reload();
}

async function signCompleteWithBody(body: any): Promise<SignatureInfo> {
  const id = await loadIdentityKeyPair();
  if (!id) throw new Error("No identity");
  const h = await hash(body);
  const s = await sign(h, id.privateKey);
  return { hash: h, signature: s, pubkey: id.publicKey, body };
}

export async function cancelCurrentTrade() {
  const tid = new URLSearchParams(location.search).get("trade_id");
  if (tid && confirm("确定取消？")) {
    await cancelTrade(tid);
    location.reload();
  }
}

export async function exportBlocksToFile(): Promise<void> {
  const data = await apiExportBlocks();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "blocks.json";
  a.click();
}
