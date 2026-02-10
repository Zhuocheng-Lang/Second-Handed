/** 加密模块导出：包含身份管理、签名校验、密钥派生及加解密功能 */

export type { IdentityKeyPair, X25519KeyPair, Ciphertext } from "./types.js";

export { canonicalize } from "./canonical.js";
export { bufToHex, hexToBuf, bufToBase64, base64ToBuf } from "./encoding.js";

// 身份与密钥对管理
export {
  generateIdentityKeyPair,
  generateX25519KeyPair,
  saveIdentityKeyPair,
  loadIdentityKeyPair,
  loadX25519KeyPair,
  importIdentityKeyPair,
  exportIdentityKeyPair,
  importPublicKey,
  exportPublicKey
} from "./identity.js";

// 基础加密算法
export { hash } from "./hash.js";
export { sign, verify } from "./sign.js";
export { deriveChatKey } from "./derive.js";
export { encrypt, decrypt } from "./aes.js";
export { fingerprintPublicKey, generateFingerprint } from "./fingerprint.js";
