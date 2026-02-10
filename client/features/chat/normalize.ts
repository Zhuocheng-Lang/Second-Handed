export function normalizeChatPubKey(value: any): string | null {
  if (!value) return null;
  let key: any = value;
  if (typeof key === "string") {
    try {
      const parsed = JSON.parse(key);
      if (parsed && parsed.pubkey) key = parsed.pubkey;
    } catch (e) {}
  } else if (key.pubkey) {
    key = key.pubkey;
  }
  if (typeof key !== "string") return null;
  return /^[A-Za-z0-9+/=]+$/.test(key) ? key : null;
}
