/** API 基础路径 */
const API_BASE = "http://127.0.0.1:8000";

export { API_BASE };

/**
 * 发送 GET 请求
 * @param path 请求路径
 * @param options 请求选项
 * @returns 响应内容
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

/**
 * 发送 POST 请求
 * @param path 请求路径
 * @param body 请求内容
 * @returns 响应内容
 */
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
