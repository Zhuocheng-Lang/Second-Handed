import { base64ToBuf, bufToBase64, hexToBuf } from "./encoding.js";

export async function sign(hashHex: string, privateKeyB64: string): Promise<string> {
  console.log("[crypto] 开始签名，哈希值:", hashHex);

  const key = await window.crypto.subtle.importKey(
    "pkcs8",
    base64ToBuf(privateKeyB64),
    { name: "Ed25519" } as any,
    false,
    ["sign"]
  );

  const sig = await window.crypto.subtle.sign(
    "Ed25519" as any,
    key,
    hexToBuf(hashHex)
  );

  const signatureB64 = bufToBase64(sig);
  console.log("[crypto] 签名完成:", signatureB64);

  return signatureB64;
}

export async function verify(hashHex: string, signatureB64: string, publicKeyB64: string): Promise<boolean> {
  console.log("[crypto] 开始验证签名");

  const key = await window.crypto.subtle.importKey(
    "raw",
    base64ToBuf(publicKeyB64),
    { name: "Ed25519" } as any,
    false,
    ["verify"]
  );

  const isValid = await window.crypto.subtle.verify(
    "Ed25519" as any,
    key,
    base64ToBuf(signatureB64),
    hexToBuf(hashHex)
  );

  console.log("[crypto] 签名验证结果:", isValid ? "有效" : "无效");

  return isValid;
}
