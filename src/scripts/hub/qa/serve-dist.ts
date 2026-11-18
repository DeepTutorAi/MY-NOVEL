// Serves a static Astro build directory on 127.0.0.1 for the QA tools, so a unit can
// measure its own build without starting astro preview. Directory URLs resolve to
// index.html; unknown paths get 404.html with status 404. Port 0 picks a free port.

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, resolve, sep } from "node:path";

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export interface ServedDist {
  /** http://127.0.0.1:<port>/ */
  base: string;
  close(): Promise<void>;
}

/** True when `path` is a directory that holds a built index.html. */
export function isBuildDir(path: string): boolean {
  return existsSync(join(path, "index.html")) && statSync(path).isDirectory();
}

export function serveDist(dir: string, port = 0): Promise<ServedDist> {
  const root = resolve(dir);
  const file = (pathname: string): string | null => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    const full = resolve(root, `.${decoded}`);
    if (full !== root && !full.startsWith(root + sep)) return null;
    if (existsSync(full) && statSync(full).isDirectory()) {
      const index = join(full, "index.html");
      return existsSync(index) ? index : null;
    }
    if (existsSync(full)) return full;
    const html = `${full}.html`;
    return existsSync(html) ? html : null;
  };
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    let path = file(url.pathname);
    let status = 200;
    if (!path) {
      status = 404;
      const notFound = join(root, "404.html");
      path = existsSync(notFound) ? notFound : null;
    }
    if (!path) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("not found");
      return;
    }
    res.writeHead(status, { "content-type": TYPES[extname(path).toLowerCase()] ?? "application/octet-stream" });
    createReadStream(path).pipe(res);
  });
  return new Promise((resolveServer, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const { port: bound } = server.address() as AddressInfo;
      resolveServer({
        base: `http://127.0.0.1:${bound}/`,
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      });
    });
  });
}
