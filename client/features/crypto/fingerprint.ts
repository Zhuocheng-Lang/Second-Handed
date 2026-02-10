export async function fingerprintPublicKey(publicKeyB64: string): Promise<string> {
  const data = new TextEncoder().encode(publicKeyB64);
  const hash = await window.crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hash))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(":");
}

export const generateFingerprint = fingerprintPublicKey;
