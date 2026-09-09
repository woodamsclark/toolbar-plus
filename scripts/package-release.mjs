import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";

// Run through npm run release so validation completes before packaging.
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(manifest.version))
  throw Error("Invalid release version");
const output = path.resolve("releases", manifest.version);
const plugin = path.join(output, "toolbar-plus");
await mkdir(plugin, { recursive: true });
const files = ["manifest.json", "main.js", "styles.css"];
const hashes = [];
for (const file of files) {
  const data = await readFile(file);
  await writeFile(path.join(plugin, file), data);
  hashes.push(
    `${createHash("sha256").update(data).digest("hex")}  toolbar-plus/${file}`,
  );
}
// macOS/Linux build utility only; never included in the mobile plugin.
const zip = execFileSync(
  "zip",
  ["-X", "-q", "-", ...files.map((file) => `toolbar-plus/${file}`)],
  {
    cwd: output,
  },
);
const archive = `toolbar-plus-${manifest.version}.zip`;
await writeFile(path.join(output, archive), zip);
hashes.push(`${createHash("sha256").update(zip).digest("hex")}  ${archive}`);
await writeFile(path.join(output, "SHA256SUMS"), hashes.join("\n") + "\n");
for (const file of ["AUDIT.md", "CHANGELOG.md", "README.md"])
  await copyFile(file, path.join(output, file));
console.log(
  `Packaged ${path.join(output, archive)} (three runtime files; no settings or vault content).`,
);
