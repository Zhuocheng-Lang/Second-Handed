import { canonicalize } from "./canonical.js";
import { bufToHex } from "./encoding.js";

/**
 * 计算数据的 SHA-256 哈希值
 * 在计算前会先对数据进行规范化（Canonicalize）处理以保证对象属性顺序一致
 * @param data 任意可 JSON 序列化的数据
 * @returns 16 进制字符串格式的哈希值
 */
export async function hash(data: any): Promise<string> {
  console.log("[crypto] 开始计算哈希");

  const canonical = canonicalize(data);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);

  const hexHash = bufToHex(digest);
  console.log("[crypto] 哈希计算完成:", hexHash);

  return hexHash;
}
