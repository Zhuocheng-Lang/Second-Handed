/** 交易元数据在 LocalStorage 中的键名 */
const STORAGE_KEY = "trade_meta";

export interface TradeMeta {
  description?: string;
  price?: string | number;
  [key: string]: any;
}

/**
 * 从本地存储加载所有交易的元数据
 * @returns 哈希到元数据的映射
 */
export function loadTradeMeta(): Record<string, TradeMeta> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * 保存单个交易的元数据到本地存储
 * @param contentHash 交易内容哈希
 * @param meta 元数据对象
 */
export function saveTradeMeta(contentHash: string, meta: TradeMeta): void {
  const all = loadTradeMeta();
  all[contentHash] = meta;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
