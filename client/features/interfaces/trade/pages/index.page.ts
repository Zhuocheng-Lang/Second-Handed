/**
 * 交易大厅页面：提供交易列表展示、身份管理及区块链导出功能
 */

import { fetchTradeList, exportBlocks as apiExportBlocks } from "../../api/index.js";
import { loadTradeMeta } from "../../../infrastructure/storage/trade_meta.js";
import * as keymgr from "../../../infrastructure/ui/keymgr.js";

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
  font-size: 28px;
}

section {
  margin: 16px 0;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

button {
  margin: 4px 8px 4px 0;
  padding: 6px 12px;
  border: 1px solid #888;
  background: #ffffff;
  border-radius: 6px;
  cursor: pointer;
}

button:hover {
  background: #f0f0f0;
}

.trade-list {
  list-style: none;
  padding: 0;
  margin: 8px 0 0;
}

.trade-item {
  padding: 8px 10px;
  margin: 6px 0;
  background: #f4f6fb;
  border: 1px solid #d6dceb;
  border-radius: 6px;
  cursor: pointer;
}
`;

const pageHtml = `
  <h1>二！手！书！交！易！！！</h1>

  <section>
    <h3>身份管理</h3>
    <button id="btn-show-fingerprint">身份指纹</button>
    <button id="btn-export-identity">导出身份</button>
    <button id="btn-import-identity">导入身份</button>
    <button id="btn-generate-identity">生成新身份</button>
    <button id="btn-export-blocks">导出区块</button>
  </section>

  <section id="trade-section">
    <h3>📦 交易列表</h3>
    <ul id="trade-list" class="trade-list"></ul>
    <p id="trade-empty" style="display: none; color: #888;">暂无交易</p>
  </section>

  <button id="btn-publish-nav">➕ 发布交易</button>
`;

function applyTemplate() {
  document.title = "二手书交易";
  const style = document.createElement("style");
  style.textContent = pageCss;
  document.head.appendChild(style);
  document.body.innerHTML = pageHtml;
}

async function initIndexPage(): Promise<void> {
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
    li.onclick = () => {
      location.href = `trade/?trade_id=${t.trade_id}`;
    };
    list.appendChild(li);
  }
}

async function exportBlocksToFile(): Promise<void> {
  const data = await apiExportBlocks();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "blocks.json";
  a.click();
}

function wireEvents() {
  document.getElementById("btn-show-fingerprint")?.addEventListener("click", () => {
    void keymgr.showCurrentFingerprint();
  });

  document.getElementById("btn-export-identity")?.addEventListener("click", () => {
    void keymgr.exportIdentity();
  });

  document.getElementById("btn-import-identity")?.addEventListener("click", () => {
    void keymgr.importIdentityFromPrompt();
  });

  document.getElementById("btn-generate-identity")?.addEventListener("click", () => {
    void keymgr.generateNewIdentity();
  });

  document.getElementById("btn-export-blocks")?.addEventListener("click", () => {
    void exportBlocksToFile();
  });

  document.getElementById("btn-publish-nav")?.addEventListener("click", () => {
    location.href = "publish/";
  });
}

function bootstrap() {
  applyTemplate();
  wireEvents();
  void initIndexPage();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
