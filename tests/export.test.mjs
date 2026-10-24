import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  writeFile,
  mkdir,
  rm,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import ts from "typescript";
import {
  build,
  readPortrait,
  loadRuntime,
} from "../skills/avatar-motion/scripts/build.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const image = resolve(root, "tests/fixtures/geometry.svg");
const rig = resolve(root, "tests/fixtures/geometry.rig.json");
async function work(run) {
  const dir = await mkdtemp(resolve(tmpdir(), "avatar-motion-test-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test("builds portable exports with safe labels and valid inline JavaScript", async () =>
  work(async (dir) => {
    const out = resolve(dir, "output");
    await build({
      image,
      rig,
      out,
      name: "</script><img src=x onerror=alert(1)>",
    });
    for (const name of ["avatar.html", "preview.html"]) {
      const text = await readFile(resolve(out, name), "utf8");
      assert.ok(text.includes("data:image/svg+xml;base64,"));
      assert.ok(!text.includes("</script><img src=x"));
      assert.ok(!text.includes(root));
      const scripts = [...text.matchAll(/<script>([\s\S]*?)<\/script>/g)];
      assert.equal(scripts.length, 1);
      assert.doesNotThrow(() => new Script(scripts[0][1]));
    }
    const component = await readFile(resolve(out, "AvatarMotion.tsx"), "utf8");
    assert.ok(!component.includes("/* RUNTIME */"));
    assert.ok(!component.includes("/* DATA */"));
  }));
test("refuses unrelated output directories and protects unrelated files", async () =>
  work(async (dir) => {
    const out = resolve(dir, "unrelated");
    await mkdir(out);
    await writeFile(resolve(out, "important.txt"), "keep");
    await assert.rejects(
      build({ image, rig, out, force: true }),
      /not created by Avatar Motion/,
    );
    assert.equal(await readFile(resolve(out, "important.txt"), "utf8"), "keep");
  }));
test("force updates only its generated output and retains a neighbour file", async () =>
  work(async (dir) => {
    const out = resolve(dir, "output");
    await build({ image, rig, out });
    await writeFile(resolve(out, "keep.txt"), "keep");
    await assert.rejects(build({ image, rig, out }), /already exists/);
    await build({ image, rig, out, force: true });
    assert.equal(await readFile(resolve(out, "keep.txt"), "utf8"), "keep");
  }));
test("bad rig input creates no output", async () =>
  work(async (dir) => {
    const bad = resolve(dir, "bad.json"),
      out = resolve(dir, "output");
    await writeFile(bad, '{"version":2}');
    await assert.rejects(build({ image, rig: bad, out }));
    await assert.rejects(access(out));
  }));
for (const [name, payload] of [
  [
    "script",
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
  ],
  [
    "external image",
    '<svg><image href="https://example.invalid/private"/></svg>',
  ],
  ["event handler", '<svg onload="alert(1)"></svg>'],
  ["entity", '<!DOCTYPE svg [<!ENTITY a SYSTEM "file:///private">]><svg/>'],
  ["CSS fetch", '<svg><path style="fill:url(https://example.invalid)"/></svg>'],
])
  test(`rejects active SVG ${name}`, async () =>
    work(async (dir) => {
      const p = resolve(dir, "bad.svg");
      await writeFile(p, payload);
      await assert.rejects(readPortrait(p), /static and self-contained/);
    }));
test("generated Framer component type-checks with React and declared Framer API surface", async () =>
  work(async (dir) => {
    const out = resolve(dir, "output");
    await build({ image, rig, out });
    const declaration = resolve(dir, "framer.d.ts");
    await writeFile(
      declaration,
      "declare module 'framer' { export const ControlType: Record<string,string>; export const RenderTarget: {current():string;canvas:string}; export function addPropertyControls(component:unknown,controls:Record<string,unknown>):void; }",
    );
    const { mod } = await loadRuntime();
    for (const file of ["AvatarMotion.tsx", "avatar.html"]) {
      const path = resolve(out, file),
        source = await readFile(path, "utf8");
      const updated = mod.withSettings(source, {
        eyes: 1.4,
        tracking: "Nearby",
        radius: 650,
      });
      assert.ok(updated.includes('"eyes":1.4'));
      assert.ok(updated.includes('"tracking":"Nearby"'));
      if (file.endsWith(".tsx"))
        assert.ok(updated.includes("const EXPORTED_CONFIG: AvatarSettings = "));
      else
        for (const script of updated.matchAll(/<script>([\s\S]*?)<\/script>/g))
          assert.doesNotThrow(() => new Script(script[1]));
      await writeFile(path, updated);
    }
    const program = ts.createProgram(
      [resolve(out, "AvatarMotion.tsx"), declaration],
      {
        noEmit: true,
        strict: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        jsx: ts.JsxEmit.ReactJSX,
        lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
        skipLibCheck: true,
        baseUrl: root,
        paths: {
          react: ["node_modules/@types/react/index.d.ts"],
          "react/jsx-runtime": ["node_modules/@types/react/jsx-runtime.d.ts"],
        },
        typeRoots: [resolve(root, "node_modules/@types")],
      },
    );
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.deepEqual(
      diagnostics.map((d) =>
        ts.flattenDiagnosticMessageText(d.messageText, " "),
      ),
      [],
    );
  }));
