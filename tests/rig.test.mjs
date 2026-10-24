import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadRuntime } from "../skills/avatar-motion/scripts/build.mjs";
const { mod } = await loadRuntime();
const fixture = JSON.parse(
  await readFile(
    new URL("./fixtures/geometry.rig.json", import.meta.url),
    "utf8",
  ),
);
const copy = () => structuredClone(fixture);
test("the synthetic geometry fixture fits the versioned schema", () => {
  assert.doesNotThrow(() => mod.validateRig(fixture));
  assert.ok(mod.createFragment(fixture).includes("void main()"));
});
test("the approved portrait rig builds a valid fragment shader", async () => {
  const portraitRig = JSON.parse(
    await readFile(
      new URL("../skills/avatar-motion/assets/demo.rig.json", import.meta.url),
      "utf8",
    ),
  );
  assert.doesNotThrow(() => mod.validateRig(portraitRig));
  assert.ok(mod.createFragment(portraitRig).includes("void main()"));
});
for (const [label, mutate] of [
  [
    "non-finite coordinate",
    (r) => {
      r.eyes[0].center[0] = NaN;
    },
  ],
  [
    "a socket outside the image",
    (r) => {
      r.eyes[0].center[0] = 2;
    },
  ],
  [
    "zero-length hair axis",
    (r) => {
      r.hair[0].tip = [...r.hair[0].root];
    },
  ],
  [
    "unsafe brow blend",
    (r) => {
      r.brows[0].lift = 15;
      r.brows[0].lowerLimit = 227;
    },
  ],
  [
    "misordered breathing region",
    (r) => {
      r.breath.full = r.breath.start;
    },
  ],
  [
    "unsupported schema",
    (r) => {
      r.version = 2;
    },
  ],
  [
    "shader-code injection as a coordinate",
    (r) => {
      r.head.pivot[0] = "0.0);discard;";
    },
  ],
  [
    "too many hair regions",
    (r) => {
      r.hair = Array.from({ length: 9 }, () => r.hair[0]);
    },
  ],
  [
    "negative eye intensity",
    (r) => {
      r.defaults.eyes = -1;
    },
  ],
])
  test(`rejects ${label}`, () => {
    const rig = copy();
    mutate(rig);
    assert.throws(() => mod.validateRig(rig));
  });
test("optional reactions and hair can be omitted", () => {
  const r = copy();
  r.hair = [];
  delete r.mouth;
  delete r.brows;
  assert.doesNotThrow(() => mod.validateRig(r));
});
test("unknown/inherited setting names and wrong boolean types are rejected", () => {
  assert.throws(() => mod.validateSettings(JSON.parse('{"__proto__":{}}')));
  assert.throws(() => mod.validateSettings({ tracking: "Global" }));
  assert.throws(() => mod.validateSettings({ paused: "false" }));
});
test("a differently sized fitting is accepted without the demo coordinates", () => {
  const r = copy();
  r.size = [900, 600];
  r.lookOrigin[0] *= 1.5;
  r.head.pivot[0] *= 1.5;
  r.head.travel[0] *= 1.5;
  r.breath.centerX *= 1.5;
  for (const e of r.eyes) {
    for (const k of [
      "center",
      "radius",
      "pupilCenter",
      "pupilRadius",
      "whiteSample",
      "skinSample",
    ])
      e[k][0] *= 1.5;
    e.travel[0] *= 1.5;
    e.travel[1] *= 1.5;
  }
  for (const h of r.hair) {
    h.root[0] *= 1.5;
    h.tip[0] *= 1.5;
  }
  for (const b of r.brows) {
    b.bounds[0] *= 1.5;
    b.bounds[2] *= 1.5;
  }
  r.mouth.center[0] *= 1.5;
  r.mouth.radius[0] *= 1.5;
  assert.doesNotThrow(() => mod.validateRig(r));
  assert.notEqual(mod.createFragment(r), mod.createFragment(fixture));
});
