import { httpGet, httpPost } from "./http.js";

/**
 * 获取交易列表
 * GET /trade/list
 * @returns 交易列表数据
 */
export async function fetchTradeList(): Promise<any[]> {
  return httpGet("/trade/list");
}

/**
 * 获取单个交易详情
 * GET /trade/{id}
 * @param tradeId 交易ID
 * @returns 交易详情数据
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
 * @param payload 交易创建数据
 * @returns 创建结果
 */
export async function createTrade(payload: any): Promise<any> {
  return httpPost("/trade/create", payload);
}

/**
 * 加入交易
 * POST /trade/{id}/join
 * @param tradeId 交易ID
 * @param payload 加入交易的数据
 * @returns 加入结果
 */
export async function joinTrade(tradeId: string, payload: any): Promise<any> {
  return httpPost(`/trade/${tradeId}/join`, payload);
}

/**
 * 完成交易（双签）
 * POST /trade/complete
 * @param payload 交易完成数据
 * @returns 完成结果
 */
export async function completeTrade(payload: any): Promise<any> {
  return httpPost("/trade/complete", payload);
}

/**
 * 取消交易
 * POST /trade/cancel
 * @param payload 交易取消数据
 * @returns 取消结果
 */
export async function cancelTrade(payload: any): Promise<any> {
  return httpPost("/trade/cancel", payload);
}
