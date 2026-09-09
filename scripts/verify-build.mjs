import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const versions = JSON.parse(await readFile("versions.json", "utf8"));
assert.equal(manifest.version, pkg.version);
assert.equal(manifest.version, lock.version);
assert.equal(manifest.version, lock.packages[""].version);
assert.equal(versions[manifest.version], manifest.minAppVersion);
assert.equal(manifest.isDesktopOnly, false);
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
const result = await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  target: "es2018",
  outfile: "main.js",
  write: false,
  metafile: true,
  banner: { js: "/* toolbar+ | generated from src/main.ts */" },
});
assert.equal(
  await readFile("main.js", "utf8"),
  result.outputFiles[0].text,
  "Installed main.js must exactly match the current source build",
);
assert.deepEqual(
  result.metafile.outputs["main.js"].imports.map((i) => i.path),
  ["obsidian"],
  "Mobile runtime must not import Node, Electron, or development packages",
);
assert.ok(
  Object.keys(result.metafile.inputs).every((path) => path.startsWith("src/")),
);
console.log(
  `Verified ${manifest.version}: matching metadata, exact build, Obsidian-only runtime.`,
);
