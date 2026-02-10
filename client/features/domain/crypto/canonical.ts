export function canonicalize(obj: any): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalize).join(",")}]`;
  }

  const keys = Object.keys(obj).sort();
  const entries = keys.map(
    (k) => `"${k}":${canonicalize(obj[k])}`
  );
  return `{${entries.join(",")}}`;
}
