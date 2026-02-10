import { base64ToBuf } from "./encoding.js";

/**
 * 派生用于加密聊天消息的对称密钥 (AES-GCM)
 * 使用 ECDH (X25519) 获取共享密钥，并结合 HKDF 进行密钥平滑
 * @param myX25519PrivateKeyB64 我的 X25519 私钥 (Base64)
 * @param peerX25519PublicKeyB64 对方的 X25519 公钥 (Base64)
 * @param tradeId 交易 ID (作为 HKDF 的 Salt)
 * @returns 派生的 CryptoKey 对象
 */
export async function deriveChatKey(
  myX25519PrivateKeyB64: string,
  peerX25519PublicKeyB64: string,
  tradeId: string
): Promise<CryptoKey> {
  try {
    console.log("[crypto] 开始派生聊天密钥");

    console.log("[crypto] 导入我的X25519私钥");
    const privateKey = await window.crypto.subtle.importKey(
      "pkcs8",
      base64ToBuf(myX25519PrivateKeyB64),
      { name: "X25519" },
      false,
      ["deriveKey", "deriveBits"]
    );

    console.log("[crypto] 导入对方X25519公钥");
    const publicKey = await window.crypto.subtle.importKey(
      "raw",
      base64ToBuf(peerX25519PublicKeyB64),
      { name: "X25519" },
      false,
      []
    );

    console.log("[crypto] 执行ECDH密钥交换");
    const sharedSecret = await window.crypto.subtle.deriveBits(
      {
        name: "X25519",
        public: publicKey
      } as any,
      privateKey,
      256
    );

    const salt = new TextEncoder().encode(tradeId);
    const info = new TextEncoder().encode("chat-key-derivation");

    console.log("[crypto] 执行HKDF密钥派生");
    const hkdfKey = await window.crypto.subtle.importKey(
      "raw",
      sharedSecret,
      { name: "HKDF" },
      false,
      ["deriveKey"]
    );

    const chatKey = await window.crypto.subtle.deriveKey(
      {
        name: "HKDF",
        salt: salt,
        info: info,
        hash: "SHA-256"
      } as any,
      hkdfKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );

    console.log("[crypto] 聊天密钥派生成功");
    return chatKey;
  } catch (error: any) {
    console.error("[crypto] 聊天密钥派生失败:", error);
    throw new Error("无法派生聊天密钥: " + error.message);
  }
}
