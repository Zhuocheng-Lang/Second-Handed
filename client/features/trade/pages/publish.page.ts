import { publishTrade } from "../domain.js";

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

label {
  display: block;
  margin: 10px 0 6px;
}

input {
  width: 100%;
  max-width: 420px;
  padding: 8px 10px;
  border: 1px solid #c8c8c8;
  border-radius: 6px;
}

button {
  margin: 10px 10px 0 0;
  padding: 6px 12px;
  border: 1px solid #888;
  background: #ffffff;
  border-radius: 6px;
  cursor: pointer;
}

button:hover {
  background: #f0f0f0;
}
`;

const pageHtml = `
  <h1>➕ 发布二手书交易</h1>

  <div>
    <label>
      书名：
      <input id="desc" placeholder="例如：计算机网络（第七版）" />
    </label>
  </div>

  <div>
    <label>
      价格：
      <input id="price" placeholder="例如：30" />
    </label>
  </div>

  <button id="btn-publish">发布</button>
  <button id="btn-cancel">取消</button>
`;

function applyTemplate() {
  document.title = "发布交易";
  const style = document.createElement("style");
  style.textContent = pageCss;
  document.head.appendChild(style);
  document.body.innerHTML = pageHtml;
}

async function publishTradeFromForm(): Promise<void> {
  const desc = (document.getElementById("desc") as HTMLInputElement)?.value;
  const price = (document.getElementById("price") as HTMLInputElement)?.value;
  if (!desc || !price) return;

  const tradeId = await publishTrade({ description: desc, price });
  location.href = `../trade/?trade_id=${tradeId}`;
}

function wireEvents() {
  document.getElementById("btn-publish")?.addEventListener("click", () => {
    void publishTradeFromForm();
  });

  document.getElementById("btn-cancel")?.addEventListener("click", () => {
    history.back();
  });
}

function bootstrap() {
  applyTemplate();
  wireEvents();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
