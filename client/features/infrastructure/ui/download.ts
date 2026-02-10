/**
 * 触发浏览器文本文件下载
 * @param filename 下载后的文件名
 * @param text 文件内容文本
 */
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}
