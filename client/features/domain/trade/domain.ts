import { loadIdentityKeyPair, hash, sign, verify } from "../crypto/index.js";
import {
  createTrade,
  completeTrade,
  cancelTrade as apiCancelTrade,
} from "../../interfaces/api/index.js";
import { saveTradeMeta } from "../../infrastructure/storage/trade_meta.js";

export interface TradeContent {
  description: string;
  price: string | number;
}

export interface TradeBody {
  trade_id: string | null;
  seller_pubkey: string;
  content_hash: string;
  description: string;
  price: string | number;
  timestamp: number;
}

export interface SignatureInfo {
  hash: string;
  signature: string;
  pubkey: string;
  body: any;
}

/**
 * 发布新交易
 * @param tradeContent 交易内容（描述、价格等）
 * @returns 生成的交易 ID
 */
export async function publishTrade(tradeContent: TradeContent): Promise<string> {
  const identity = await loadIdentityKeyPair();
  if (!identity) throw new Error("请先生成身份");
  const { publicKey, privateKey } = identity;
  const timestamp = Math.floor(Date.now() / 1000);

  const contentHash = await hash(tradeContent);
  saveTradeMeta(contentHash, {
    description: tradeContent.description,
    price: tradeContent.price,
  });

  const body: TradeBody = {
    trade_id: null,
    seller_pubkey: publicKey,
    content_hash: contentHash,
    description: tradeContent.description,
    price: tradeContent.price,
    timestamp,
  };

  const tradeId = await hash(body);
  body.trade_id = tradeId;
  const signature = await sign(tradeId, privateKey);

  await createTrade({ trade_id: tradeId, body, signature });
  return tradeId;
}

/**
 * 签署交易完成消息
 * @param tradeId 交易 ID
 * @returns 签名信息
 */
export async function signComplete(tradeId: string): Promise<SignatureInfo> {
  const identity = await loadIdentityKeyPair();
  if (!identity) throw new Error("请先生成身份");
  const { publicKey, privateKey } = identity;

  const body = {
    trade_id: tradeId,
    result: "COMPLETED",
    timestamp: Math.floor(Date.now() / 1000),
  };

  const completeHash = await hash(body);
  const signature = await sign(completeHash, privateKey);

  return { hash: completeHash, signature, pubkey: publicKey, body };
}

/**
 * 根据已有消息体签署交易完成消息
 * @param body 消息体
 * @returns 签名信息
 */
export async function signCompleteWithBody(body: any): Promise<SignatureInfo> {
  const id = await loadIdentityKeyPair();
  if (!id) throw new Error("No identity");
  const h = await hash(body);
  const s = await sign(h, id.privateKey);
  return { hash: h, signature: s, pubkey: id.publicKey, body };
}

/**
 * 提交并验证双签交易完成
 * @param tradeId 交易 ID
 * @param sigA 签名 A（通常是卖方）
 * @param sigB 签名 B（通常是买方）
 */
export async function submitComplete(tradeId: string, sigA: SignatureInfo, sigB: SignatureInfo): Promise<void> {
  const localHash = await hash(sigA.body);
  if (localHash !== sigA.hash || sigA.hash !== sigB.hash) throw new Error("签名校验错误: 哈希不匹配");

  if (!(await verify(sigA.hash, sigA.signature, sigA.pubkey)) || !(await verify(sigB.hash, sigB.signature, sigB.pubkey))) {
    throw new Error("签名校验错误: 签名无效");
  }

  await completeTrade({ trade_id: tradeId, hash: sigA.hash, sig_seller: sigA.signature, sig_buyer: sigB.signature });
}

/**
 * 取消交易
 * @param tradeId 交易 ID
 */
export async function cancelTrade(tradeId: string): Promise<void> {
  const identity = await loadIdentityKeyPair();
  if (!identity) throw new Error("请先生成身份");
  const { privateKey } = identity;

  const body = { trade_id: tradeId, result: "CANCELLED", timestamp: Math.floor(Date.now() / 1000) };
  const cancelHash = await hash(body);
  const signature = await sign(cancelHash, privateKey);

  await apiCancelTrade({ trade_id: tradeId, hash: cancelHash, signature });
}
