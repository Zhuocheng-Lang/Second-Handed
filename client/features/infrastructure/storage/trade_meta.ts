const STORAGE_KEY = "trade_meta";

export interface TradeMeta {
  description?: string;
  price?: string | number;
  [key: string]: any;
}

export function loadTradeMeta(): Record<string, TradeMeta> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveTradeMeta(contentHash: string, meta: TradeMeta): void {
  const all = loadTradeMeta();
  all[contentHash] = meta;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
