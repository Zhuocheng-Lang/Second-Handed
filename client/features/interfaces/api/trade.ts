import { httpGet, httpPost } from "./http.js";

/**
 * 获取交易列表
 * GET /trade/list
 */
export async function fetchTradeList(): Promise<any[]> {
  return httpGet("/trade/list");
}

/**
 * 获取单个交易详情
 * GET /trade/{id}
 */
export async function getTrade(tradeId: string): Promise<any> {
  if (!tradeId) {
    throw new Error("getTrade: tradeId required");
  }
  return httpGet(`/trade/${tradeId}`);
}

/**
 * 创建交易
 * POST /trade/create
 */
export async function createTrade(payload: any): Promise<any> {
  return httpPost("/trade/create", payload);
}

/**
 * 加入交易
 * POST /trade/{id}/join
 */
export async function joinTrade(tradeId: string, payload: any): Promise<any> {
  return httpPost(`/trade/${tradeId}/join`, payload);
}

/**
 * 完成交易（双签）
 * POST /trade/complete
 */
export async function completeTrade(payload: any): Promise<any> {
  return httpPost("/trade/complete", payload);
}

/**
 * 取消交易
 * POST /trade/cancel
 */
export async function cancelTrade(payload: any): Promise<any> {
  return httpPost("/trade/cancel", payload);
}
