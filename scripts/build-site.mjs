import { mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = resolve(root, "dist");
const serverDir = resolve(distDir, "server");

await rm(distDir, { recursive: true, force: true });
await build({ root });
await mkdir(serverDir, { recursive: true });

const worker = `const ASSET_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".txt",
  ".map",
]);

function isAsset(pathname) {
  return pathname.startsWith("/assets/") || [...ASSET_EXTENSIONS].some((extension) => pathname.endsWith(extension));
}

function assetRequest(url, pathname) {
  return new Request(new URL(pathname, url), {
    headers: { accept: "*/*" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (isAsset(url.pathname)) {
      const response = await env.ASSETS.fetch(assetRequest(url, url.pathname));
      if (response.status !== 404) return response;
    }

    const response = await env.ASSETS.fetch(assetRequest(url, "/index.html"));
    return new Response(response.body, {
      headers: response.headers,
      status: response.status,
    });
  },
};
`;

await writeFile(resolve(serverDir, "index.js"), worker);
