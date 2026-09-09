import { build } from "esbuild";
await build({
  entryPoints: ["tests/preview.ts"],
  bundle: true,
  format: "esm",
  outfile: "tests/preview.js",
  alias: { obsidian: "./tests/obsidian-preview.ts" },
});
