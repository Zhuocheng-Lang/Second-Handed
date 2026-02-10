import { base64ToBuf, bufToBase64 } from "./encoding.js";
import type { Ciphertext } from "./types.js";

export async function encrypt(chatKey: CryptoKey, plaintextObject: any): Promise<Ciphertext> {
  console.log("[crypto] 开始加密数据");

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(
    JSON.stringify(plaintextObject)
  );

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    chatKey,
    encoded
  );

  console.log("[crypto] 加密完成");

  return {
    iv: bufToBase64(iv),
    data: bufToBase64(ciphertext),
  };
}

export async function decrypt(chatKey: CryptoKey, ciphertext: Ciphertext): Promise<any> {
  console.log("[crypto] 开始解密数据");

  const iv = base64ToBuf(ciphertext.iv);
  const data = base64ToBuf(ciphertext.data);

  const plaintext = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    chatKey,
    data
  );

  const decoded = JSON.parse(new TextDecoder().decode(plaintext));

  console.log("[crypto] 解密完成");

  return decoded;
}
