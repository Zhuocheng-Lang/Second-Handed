/**
 * crypto.ts - 加密系统核心模块
 *
 * 主要功能：
 * - 身份密钥管理（Ed25519）
 * - 哈希计算（SHA-256，使用规范JSON）
 * - 数字签名与验证
 * - 密钥交换（ECDH X25519）
 * - 对称加密（AES-256-GCM）
 *
 */

/* =========================
 * 工具：canonical JSON
 * ========================= */

/**
 * 规范化JSON对象（Canonical JSON）
 * 
 * 确保相同的JSON对象始终生成相同的字符串表示，用于哈希计算
 * 
 * @param {any} obj - 要规范化的对象
 * @returns {string} 规范化后的JSON字符串
 */
function canonicalize(obj: any): string {
  // 基本类型直接转换
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  // 数组递归规范化
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalize).join(",")}]`;
  }

  // 对象按键排序后递归规范化
  const keys = Object.keys(obj).sort();
  const entries = keys.map(
    (k) => `"${k}":${canonicalize(obj[k])}`
  );
  return `{${entries.join(",")}}`;
}

/* =========================
 * 编码工具
 * ========================= */

function bufToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}

function bufToBase64(buf: ArrayBuffer | ArrayBufferView): string {
  const bytes = ArrayBuffer.isView(buf)
    ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBuf(b64: string): ArrayBuffer {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
}

/* =========================
 * 身份密钥类型定义
 * ========================= */

export interface IdentityKeyPair {
  publicKey: string;
  privateKey: string;
  x25519PublicKey?: string;
  x25519PrivateKey?: string;
}

export interface X25519KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface Ciphertext {
  iv: string;
  data: string;
}

const IDENTITY_KEY = "identity_keypair";
const X25519_KEY = "x25519_keypair";

/**
 * 显式生成新身份
 */
export async function generateIdentityKeyPair(): Promise<IdentityKeyPair> {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"]
  ) as CryptoKeyPair;

  const publicKey = bufToBase64(
    await window.crypto.subtle.exportKey("raw", keyPair.publicKey)
  );
  const privateKey = bufToBase64(
    await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey)
  );

  // 生成X25519密钥对用于密钥交换
  const x25519KeyPair = await generateX25519KeyPair();

  return {
    publicKey,
    privateKey,
    x25519PublicKey: x25519KeyPair.publicKey,
    x25519PrivateKey: x25519KeyPair.privateKey
  };
}

/**
 * 生成X25519密钥对用于ECDH密钥交换
 */
export async function generateX25519KeyPair(): Promise<X25519KeyPair> {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: "X25519" },
    true,
    ["deriveKey", "deriveBits"]
  ) as CryptoKeyPair;

  const publicKey = bufToBase64(
    await window.crypto.subtle.exportKey("raw", keyPair.publicKey)
  );
  const privateKey = bufToBase64(
    await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey)
  );

  return { publicKey, privateKey };
}

/**
 * 保存身份（覆盖）
 */
export async function saveIdentityKeyPair({ publicKey, privateKey, x25519PublicKey, x25519PrivateKey }: IdentityKeyPair): Promise<void> {
  localStorage.setItem(
    IDENTITY_KEY,
    JSON.stringify({ publicKey, privateKey })
  );

  // 保存X25519密钥
  if (x25519PublicKey && x25519PrivateKey) {
    localStorage.setItem(
      X25519_KEY,
      JSON.stringify({ publicKey: x25519PublicKey, privateKey: x25519PrivateKey })
    );
  }
}

/**
 * 读取身份
 */
export async function loadIdentityKeyPair(): Promise<IdentityKeyPair | null> {
  const stored = localStorage.getItem(IDENTITY_KEY);
  if (!stored) return null;

  const identity: IdentityKeyPair = JSON.parse(stored);

  // 读取X25519密钥
  const x25519Stored = localStorage.getItem(X25519_KEY);
  if (x25519Stored) {
    const x25519Keys: X25519KeyPair = JSON.parse(x25519Stored);
    identity.x25519PublicKey = x25519Keys.publicKey;
    identity.x25519PrivateKey = x25519Keys.privateKey;
  }

  return identity;
}

/**
 * 加载X25519密钥
 * 如果不存在，生成新的并保存
 */
export async function loadX25519KeyPair(): Promise<X25519KeyPair> {
  const stored = localStorage.getItem(X25519_KEY);
  if (stored) {
    return JSON.parse(stored);
  }

  // 生成新的X25519密钥对并保存
  const keyPair = await generateX25519KeyPair();
  localStorage.setItem(
    X25519_KEY,
    JSON.stringify(keyPair)
  );

  return keyPair;
}

/* =========================
 * Hash
 * ========================= */

/**
 * 计算数据的SHA-256哈希值
 * 
 * 使用规范化JSON确保相同内容始终生成相同哈希
 * 
 * @param {any} data - 要哈希的数据
 * @returns {Promise<string>} 十六进制表示的SHA-256哈希值
 */
export async function hash(data: any): Promise<string> {
  console.log("[crypto] 开始计算哈希");

  // 规范化数据为JSON字符串
  const canonical = canonicalize(data);

  // 转换为字节数组
  const bytes = new TextEncoder().encode(canonical);

  // 计算SHA-256哈希
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);

  const hexHash = bufToHex(digest);
  console.log("[crypto] 哈希计算完成:", hexHash);

  return hexHash;
}

/* =========================
 * Sign / Verify（Ed25519）
 * ========================= */

/**
 * 使用Ed25519私钥对哈希值进行签名
 * 
 * @param {string} hashHex - 十六进制表示的哈希值
 * @param {string} privateKeyB64 - Base64表示的私钥
 * @returns {Promise<string>} Base64表示的签名
 */
export async function sign(hashHex: string, privateKeyB64: string): Promise<string> {
  console.log("[crypto] 开始签名，哈希值:", hashHex);

  // 导入私钥
  const key = await window.crypto.subtle.importKey(
    "pkcs8",
    base64ToBuf(privateKeyB64),
    { name: "Ed25519" } as any,
    false,
    ["sign"]
  );

  // 对哈希值进行签名
  const sig = await window.crypto.subtle.sign(
    "Ed25519" as any,
    key,
    hexToBuf(hashHex)
  );

  const signatureB64 = bufToBase64(sig);
  console.log("[crypto] 签名完成:", signatureB64);

  return signatureB64;
}

/**
 * 验证Ed25519签名的有效性
 * 
 * @param {string} hashHex - 十六进制表示的哈希值
 * @param {string} signatureB64 - Base64表示的签名
 * @param {string} publicKeyB64 - Base64表示的公钥
 * @returns {Promise<boolean>} 签名是否有效
 */
export async function verify(hashHex: string, signatureB64: string, publicKeyB64: string): Promise<boolean> {
  console.log("[crypto] 开始验证签名");

  // 导入公钥
  const key = await window.crypto.subtle.importKey(
    "raw",
    base64ToBuf(publicKeyB64),
    { name: "Ed25519" } as any,
    false,
    ["verify"]
  );

  // 验证签名
  const isValid = await window.crypto.subtle.verify(
    "Ed25519" as any,
    key,
    base64ToBuf(signatureB64),
    hexToBuf(hashHex)
  );

  console.log("[crypto] 签名验证结果:", isValid ? "有效" : "无效");

  return isValid;
}

/* =========================
 * 聊天密钥派生（X25519 + HKDF）
 * ========================= */

/**
 * 派生聊天密钥（基于X25519 ECDH + HKDF）
 * 
 * 使用ECDH交换共享密钥，然后通过HKDF派生聊天密钥
 * 
 * @param {string} myX25519PrivateKeyB64 - 我的X25519私钥（Base64）
 * @param {string} peerX25519PublicKeyB64 - 对方X25519公钥（Base64）
 * @param {string} tradeId - 交易ID（用于salt）
 * @returns {Promise<CryptoKey>} 派生的AES-256-GCM密钥
 */
export async function deriveChatKey(
  myX25519PrivateKeyB64: string,
  peerX25519PublicKeyB64: string,
  tradeId: string
): Promise<CryptoKey> {
  try {
    console.log("[crypto] 开始派生聊天密钥");

    // 导入我的私钥
    console.log("[crypto] 导入我的X25519私钥");
    const privateKey = await window.crypto.subtle.importKey(
      "pkcs8",
      base64ToBuf(myX25519PrivateKeyB64),
      { name: "X25519" },
      false,
      ["deriveKey", "deriveBits"]
    );

    // 导入对方公钥
    console.log("[crypto] 导入对方X25519公钥");
    const publicKey = await window.crypto.subtle.importKey(
      "raw",
      base64ToBuf(peerX25519PublicKeyB64),
      { name: "X25519" },
      false,
      []
    );

    // 执行ECDH密钥交换
    console.log("[crypto] 执行ECDH密钥交换");
    const sharedSecret = await window.crypto.subtle.deriveBits(
      {
        name: "X25519",
        public: publicKey
      } as any,
      privateKey,
      256
    );

    // 使用HKDF派生聊天密钥，添加tradeId作为salt
    const salt = new TextEncoder().encode(tradeId);
    const info = new TextEncoder().encode("chat-key-derivation");

    // 先导入为HKDF密钥
    console.log("[crypto] 执行HKDF密钥派生");
    const hkdfKey = await window.crypto.subtle.importKey(
      "raw",
      sharedSecret,
      { name: "HKDF" },
      false,
      ["deriveKey"]
    );

    // 派生AES-GCM密钥
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

/* =========================
 * 公钥导入导出
 * ========================= */

export async function importPublicKey(publicKeyB64: string): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    "raw",
    base64ToBuf(publicKeyB64),
    { name: "X25519" },
    true,
    []
  );
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const raw = await window.crypto.subtle.exportKey("raw", publicKey);
  return bufToBase64(raw);
}

export function importIdentityKeyPair(text: string): IdentityKeyPair {
  const obj = JSON.parse(text);
  if (!obj.publicKey || !obj.privateKey) {
    throw new Error("格式错误的身份文件");
  }
  return obj;
}

/* =========================
 * AES-256-GCM 加解
 * ========================= */

/**
 * 使用AES-256-GCM加密数据
 * 
 * @param {CryptoKey} chatKey - AES-256-GCM密钥
 * @param {any} plaintextObject - 要加密的对象
 * @returns {Promise<Ciphertext>} 包含IV和加密数据的对象
 */
export async function encrypt(chatKey: CryptoKey, plaintextObject: any): Promise<Ciphertext> {
  console.log("[crypto] 开始加密数据");

  // 生成随机IV（初始化向量）
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 将对象转换为JSON字符串并编码为字节
  const encoded = new TextEncoder().encode(
    JSON.stringify(plaintextObject)
  );

  // 执行AES-256-GCM加密
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    chatKey,
    encoded
  );

  console.log("[crypto] 加密完成");

  return {
    iv: bufToBase64(iv),      // Base64编码的IV
    data: bufToBase64(ciphertext),  // Base64编码的加密数据
  };
}

/**
 * 使用AES-256-GCM解密数据
 * 
 * @param {CryptoKey} chatKey - AES-256-GCM密钥
 * @param {Ciphertext} ciphertext - 包含IV和加密数据的对象
 * @returns {Promise<any>} 解密后的对象
 */
export async function decrypt(chatKey: CryptoKey, ciphertext: Ciphertext): Promise<any> {
  console.log("[crypto] 开始解密数据");

  // 解码Base64格式的IV和加密数据
  const iv = base64ToBuf(ciphertext.iv);
  const data = base64ToBuf(ciphertext.data);

  // 执行AES-256-GCM解密
  const plaintext = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    chatKey,
    data
  );

  // 解码为字符串并解析为JSON对象
  const decoded = JSON.parse(new TextDecoder().decode(plaintext));

  console.log("[crypto] 解密完成");

  return decoded;
}

/* =========================
 * 公钥指纹（人类可读）
 * ========================= */

export async function fingerprintPublicKey(publicKeyB64: string): Promise<string> {
  const data = new TextEncoder().encode(publicKeyB64);
  const hash = await window.crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hash))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(":");
}

// 为了兼容 chat.js 中的导入，添加别名
export const generateFingerprint = fingerprintPublicKey;


// 把身份密钥对导出为 JSON 文本
export function exportIdentityKeyPair(kp: IdentityKeyPair): string {
  return JSON.stringify(kp);
}
