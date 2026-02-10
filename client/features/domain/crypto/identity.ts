import { bufToBase64, base64ToBuf } from "./encoding.js";
import type { IdentityKeyPair, X25519KeyPair } from "./types.js";

const IDENTITY_KEY = "identity_keypair";
const X25519_KEY = "x25519_keypair";

/**
 * 生成完整的身份密钥对（包含 Ed25519 签名密钥和 X25519 交换密钥）
 * @returns 包含公私钥对的 Base64 字符串对象
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

  const x25519KeyPair = await generateX25519KeyPair();

  return {
    publicKey,
    privateKey,
    x25519PublicKey: x25519KeyPair.publicKey,
    x25519PrivateKey: x25519KeyPair.privateKey
  };
}

/**
 * 生成 X25519 密钥对（用于 ECDH 密钥交换）
 * @returns 包含公私钥对的 Base64 字符串对象
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
 * 将身份密钥对保存到本地存储
 * @param keyPair 密钥对对象
 */
export async function saveIdentityKeyPair({ publicKey, privateKey, x25519PublicKey, x25519PrivateKey }: IdentityKeyPair): Promise<void> {
  localStorage.setItem(
    IDENTITY_KEY,
    JSON.stringify({ publicKey, privateKey })
  );

  if (x25519PublicKey && x25519PrivateKey) {
    localStorage.setItem(
      X25519_KEY,
      JSON.stringify({ publicKey: x25519PublicKey, privateKey: x25519PrivateKey })
    );
  }
}

/**
 * 从本地存储加载身份密钥对
 * @returns 密钥对对象，若不存在则返回 null
 */
export async function loadIdentityKeyPair(): Promise<IdentityKeyPair | null> {
  const stored = localStorage.getItem(IDENTITY_KEY);
  if (!stored) return null;

  const identity: IdentityKeyPair = JSON.parse(stored);

  const x25519Stored = localStorage.getItem(X25519_KEY);
  if (x25519Stored) {
    const x25519Keys: X25519KeyPair = JSON.parse(x25519Stored);
    identity.x25519PublicKey = x25519Keys.publicKey;
    identity.x25519PrivateKey = x25519Keys.privateKey;
  }

  return identity;
}

export async function loadX25519KeyPair(): Promise<X25519KeyPair> {
  const stored = localStorage.getItem(X25519_KEY);
  if (stored) {
    return JSON.parse(stored);
  }

  const keyPair = await generateX25519KeyPair();
  localStorage.setItem(
    X25519_KEY,
    JSON.stringify(keyPair)
  );

  return keyPair;
}

export function importIdentityKeyPair(text: string): IdentityKeyPair {
  const obj = JSON.parse(text);
  if (!obj.publicKey || !obj.privateKey) {
    throw new Error("格式错误的身份文件");
  }
  return obj;
}

export function exportIdentityKeyPair(kp: IdentityKeyPair): string {
  return JSON.stringify(kp);
}

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
