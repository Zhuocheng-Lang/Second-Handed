import { canonicalize } from "./canonical.js";
import { bufToHex } from "./encoding.js";

export async function hash(data: any): Promise<string> {
  console.log("[crypto] 开始计算哈希");

  const canonical = canonicalize(data);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);

  const hexHash = bufToHex(digest);
  console.log("[crypto] 哈希计算完成:", hexHash);

  return hexHash;
}
