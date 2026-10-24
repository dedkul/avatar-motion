#!/usr/bin/env node
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { stripTypeScriptTypes } from "node:module";
const skill = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const scriptJSON = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
export async function loadRuntime() {
  const ts = await readFile(resolve(skill, "assets/runtime.ts"), "utf8");
  const js = stripTypeScriptTypes(ts);
  const mod = await import(
    "data:text/javascript;base64," + Buffer.from(js).toString("base64")
  );
  return { ts, js, mod };
}
export async function readPortrait(path) {
  const bytes = await readFile(path);
  if (bytes.length > 12 * 1024 * 1024)
    throw Error("Portrait exceeds 12 MB; resize it before building");
  const ext = extname(path).toLowerCase();
  const mime = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  }[ext];
  if (!mime) throw Error("Use PNG, JPEG, WebP or a static self-contained SVG");
  if (ext === ".svg") {
    const text = bytes.toString("utf8");
    if (
      !/<svg\b/i.test(text) ||
      /<(?:script|foreignObject|image|iframe|style|animate\w*|set|use|feImage)\b|<!DOCTYPE|<!ENTITY|\b(?:href|src|on\w+)\s*=|url\s*\(|@import/i.test(
        text,
      )
    )
      throw Error(
        "SVG must be static and self-contained: no scripts, CSS, links, images, entities or animation",
      );
  }
  return `data:${mime};base64,${bytes.toString("base64")}`;
}
export async function build({
  image,
  rig: rigPath,
  out,
  settings,
  name = "Avatar",
  force = false,
}) {
  if (!image || !rigPath || !out)
    throw Error(
      "Required: --image portrait.png --rig rig.json --out new-output-directory",
    );
  const { ts, js, mod } = await loadRuntime();
  const rig = JSON.parse(await readFile(rigPath, "utf8"));
  mod.validateRig(rig);
  const config = mod.validateSettings({
    ...rig.defaults,
    ...(settings ? JSON.parse(await readFile(settings, "utf8")) : {}),
  });
  if (config.straightBottom && !rig.cropY)
    throw Error("straightBottom requires a fitted cropY");
  const imageURL = await readPortrait(image);
  const dir = resolve(out);
  let exists = false;
  try {
    await access(dir);
    exists = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (exists) {
    if (!force)
      throw Error(
        "Output directory already exists; choose a new directory or use --force for an existing Avatar Motion output",
      );
    try {
      await access(resolve(dir, ".avatar-motion-output"));
    } catch {
      throw Error(
        "Refusing to overwrite a directory not created by Avatar Motion",
      );
    }
  }
  const plainJS = js.replace(/^export /gm, "");
  const plainTS = ts.replace(/^export /gm, "");
  const controls = await readFile(
    resolve(skill, "assets/controls.html"),
    "utf8",
  );
  const component = await readFile(
    resolve(skill, "assets/component.tsx"),
    "utf8",
  );
  const common = `const PORTRAIT = ${scriptJSON(imageURL)};\nconst RIG = ${scriptJSON(rig)};\nconst EXPORTED_CONFIG = ${scriptJSON(config)};\n`;
  const css =
    "html,body{margin:0;width:100%;height:100%;background:transparent}button.avatar{position:relative;display:block;width:100%;height:100%;margin:0;padding:0;border:0;background:transparent;cursor:pointer;touch-action:manipulation;overflow:hidden}button.avatar:focus-visible{outline:2px solid #377899;outline-offset:-2px}";
  const standalone = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Avatar Motion</title><style>${css}</style><button class="avatar" id="avatar" aria-label="Animated avatar. Click to change expression."></button><script>${plainJS}\n${common}\nconst host=document.getElementById('avatar');mountAvatar(host,PORTRAIT,RIG,EXPORTED_CONFIG).catch(error=>{const img=new Image();img.src=PORTRAIT;img.alt='Avatar';img.style.cssText='width:100%;height:100%;object-fit:contain';host.replaceChildren(img);host.title=error.message;});</script></html>`;
  const tsx = component
    .replace("/* RUNTIME */", plainTS)
    .replace(
      "/* DATA */",
      `const PORTRAIT = ${scriptJSON(imageURL)};\nconst RIG: AvatarRig = ${scriptJSON(rig)};\nconst EXPORTED_CONFIG: AvatarSettings = ${scriptJSON(config)};\n`,
    );
  const preview = controls
    .replace("/* RUNTIME */", plainJS)
    .replace("/* DATA */", common)
    .replace(
      "/* LABEL */",
      `document.getElementById('name').textContent=${scriptJSON(name)};`,
    );
  await mkdir(dir, { recursive: true });
  for (const [file, text] of Object.entries({
    "avatar.html": standalone,
    "AvatarMotion.tsx": tsx,
    "preview.html": preview,
    "rig.json": JSON.stringify(rig, null, 2),
    "settings.json": JSON.stringify(config, null, 2),
    ".avatar-motion-output": "Avatar Motion generated output v1\n",
  }))
    await writeFile(resolve(dir, file), text);
  return {
    output: dir,
    files: [
      "preview.html",
      "avatar.html",
      "AvatarMotion.tsx",
      "rig.json",
      "settings.json",
    ],
  };
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.length === 0) {
    console.log(
      "Avatar Motion\nnode build.mjs --image portrait.png --rig rig.json --out avatar-output [--settings settings.json] [--name Avatar] [--force]\nnode build.mjs --validate rig.json\nOutputs: preview.html, avatar.html, AvatarMotion.tsx, rig.json, settings.json. Requires Node 22.18+.",
    );
    return;
  }
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === "--force") {
      opts.force = true;
      continue;
    }
    if (
      ![
        "--image",
        "--rig",
        "--out",
        "--settings",
        "--name",
        "--validate",
      ].includes(key) ||
      !args[i + 1] ||
      args[i + 1].startsWith("--")
    )
      throw Error(`Invalid argument: ${key}`);
    opts[key.slice(2)] = args[++i];
  }
  if (opts.validate) {
    const { mod } = await loadRuntime();
    mod.validateRig(JSON.parse(await readFile(opts.validate, "utf8")));
    console.log("Rig is valid");
    return;
  }
  console.log(JSON.stringify(await build(opts), null, 2));
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(`Avatar Motion: ${error.message}`);
    process.exitCode = 1;
  });
