#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(process.argv[2] || "");
const port = Number(process.argv[3] || 8812);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw Error("Use a port between 1024 and 65535");
try {
  await access(resolve(root, ".avatar-motion-output"));
} catch {
  console.error("Choose a generated Avatar Motion output directory");
  process.exit(1);
}
const types = {
  "preview.html": "text/html; charset=utf-8",
  "avatar.html": "text/html; charset=utf-8",
  "AvatarMotion.tsx": "text/plain; charset=utf-8",
  "rig.json": "application/json",
  "settings.json": "application/json",
};
const server = createServer(async (req, res) => {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405).end();
    return;
  }
  let name;
  try {
    name =
      decodeURIComponent(new URL(req.url, "http://localhost").pathname).slice(
        1,
      ) || "preview.html";
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(types, name)) {
    res.writeHead(404).end("Not found");
    return;
  }
  try {
    const data = await readFile(resolve(root, name));
    res.writeHead(200, {
      "Content-Type": types[name],
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(404).end("Not found");
  }
});
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Avatar Motion preview: http://127.0.0.1:${port}/preview.html`),
);
