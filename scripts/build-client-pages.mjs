import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const distRoot = path.join(repoRoot, "client/dist");
const pages = [
    {
        title: "二手书交易",
        entry: path.join(repoRoot, "client/features/trade/pages/index.page.ts"),
        outHtml: path.join(distRoot, "index.html"),
        lang: "zh-CN"
    },
    {
        title: "发布交易",
        entry: path.join(repoRoot, "client/features/trade/pages/publish.page.ts"),
        outHtml: path.join(distRoot, "publish/index.html"),
        lang: "zh-CN"
    },
    {
        title: "交易详情",
        entry: path.join(repoRoot, "client/features/trade/pages/trade.page.ts"),
        outHtml: path.join(distRoot, "trade/index.html"),
        lang: "zh-CN"
    }
];

function makeHtml({ title, lang }, js) {
    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body>
  <script>
${js}
  </script>
</body>
</html>
`;
}

for (const page of pages) {
    const result = await build({
        entryPoints: [page.entry],
        bundle: true,
        write: false,
        platform: "browser",
        target: "es2020",
        format: "iife",
        sourcemap: false,
        minify: false,
        logLevel: "silent"
    });

    const jsFile = result.outputFiles[0];
    if (!jsFile) {
        throw new Error(`No JS output generated for ${page.entry}`);
    }

    await mkdir(path.dirname(page.outHtml), { recursive: true });
    const html = makeHtml(page, jsFile.text.trim());
    await writeFile(page.outHtml, html, "utf8");
}
