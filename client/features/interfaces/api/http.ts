// FastAPI base URL for the client
const API_BASE = "http://127.0.0.1:8000";

export { API_BASE };

/*
 * HTTP helpers
 */

export async function httpGet(path: string, options: { headers?: Record<string, string> } = {}) {
  console.log(`[api] 发送GET请求: ${path}`);
  const res = await fetch(API_BASE + path, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept": "application/json",
      "Origin": "http://127.0.0.1:8000",
      ...options.headers,
    },
  });

  if (!res.ok) {
    console.error(`[api] GET请求失败: ${path}, 状态码: ${res.status}`);
    throw new Error(`GET ${path} failed: ${res.status}`);
  }

  const data = await res.json();
  console.log(`[api] GET请求成功: ${path}, 响应数据:`, data);
  return data;
}

export async function httpPost(path: string, body: any) {
  console.log(`[api] 发送POST请求: ${path}, 请求数据:`, body);
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[api] POST请求失败: ${path}, 状态码: ${res.status}, 错误信息: ${text}`);
    throw new Error(`POST ${path} failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  console.log(`[api] POST请求成功: ${path}, 响应数据:`, data);
  return data;
}
