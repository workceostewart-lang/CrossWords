import { mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = resolve(root, "dist");
const serverDir = resolve(distDir, "server");

await rm(distDir, { recursive: true, force: true });
await build({ root });
await mkdir(serverDir, { recursive: true });

const indexTemplate = await readFile(resolve(distDir, "index.html"), "utf8");
const assetsDir = resolve(distDir, "assets");
const assetFiles = await readdir(assetsDir);
const assets = {};

for (const file of assetFiles) {
  const pathname = `/assets/${file}`;
  assets[pathname] = await readFile(resolve(assetsDir, file), "utf8");
}

const html = indexTemplate
  .replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (_match, href) => {
    return `<style>${assets[href] ?? ""}</style>`;
  })
  .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_match, src) => {
    return `<script type="module">${assets[src] ?? ""}<\\/script>`;
  });

const standaloneAssets = Object.fromEntries(
  Object.entries(assets).map(([pathname, content]) => [
    pathname,
    {
      content,
      type: extname(pathname) === ".css" ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8",
    },
  ]),
);

const worker = `const INDEX_HTML = ${JSON.stringify(html)};
const ASSETS = ${JSON.stringify(standaloneAssets)};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (ASSETS[url.pathname]) {
      return new Response(ASSETS[url.pathname].content, {
        headers: {
          "content-type": ASSETS[url.pathname].type,
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new Response(INDEX_HTML, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  },
};
`;

await writeFile(resolve(serverDir, "index.js"), worker);
