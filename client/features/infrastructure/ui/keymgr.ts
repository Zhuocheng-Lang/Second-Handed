import {
  generateIdentityKeyPair,
  saveIdentityKeyPair,
  loadIdentityKeyPair,
  exportIdentityKeyPair,
  importIdentityKeyPair,
  fingerprintPublicKey,
} from "../../domain/crypto/index.js";

import { downloadText } from "./download.js";

/**
 * 引导用户生成并覆盖新的身份密钥
 */
export async function generateNewIdentity(): Promise<void> {
  const ok = confirm(
    "这将生成一套新的身份密钥，并覆盖当前身份。\n\n" +
    "⚠️ 如果你没有备份旧密钥，将永久失去之前的交易与身份。\n\n" +
    "是否继续？"
  );
  if (!ok) return;

  const kp = await generateIdentityKeyPair();
  await saveIdentityKeyPair(kp);

  alert("✅ 新身份已生成，请立即导出并备份你的密钥。");
}

/**
 * 导出当前身份密钥并触发下载
 */
export async function exportIdentity(): Promise<void> {
  const kp = await loadIdentityKeyPair();
  if (!kp) {
    alert("当前没有身份密钥");
    return;
  }

  const text = exportIdentityKeyPair(kp);
  downloadText("identity-key.json", text);

  alert(" 身份已导出，请妥善保存该文件。");
}

/**
 * 通过弹窗交互导入身份密钥
 */
export async function importIdentityFromPrompt(): Promise<void> {
  const text = prompt(
    "请粘贴之前导出的身份密钥（JSON 文本）："
  );
  if (!text) return;

  try {
    const kp = importIdentityKeyPair(text);

    const ok = confirm(
      "即将导入新的身份并覆盖当前身份。\n\n" +
      "是否确认继续？"
    );
    if (!ok) return;

    await saveIdentityKeyPair(kp);
    alert("✅ 身份导入成功");
  } catch (e: any) {
    alert("❌ 导入失败：" + e.message);
  }
}

/**
 * 弹出当前公钥指纹 (Fingerprint)
 */
export async function showCurrentFingerprint(): Promise<void> {
  const kp = await loadIdentityKeyPair();
  if (!kp) {
    alert("当前没有身份密钥");
    return;
  }

  const fp = await fingerprintPublicKey(kp.publicKey);
  alert("你的身份指纹：\n\n" + fp);
}
