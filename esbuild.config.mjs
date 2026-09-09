import { build } from "esbuild";
await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  target: "es2018",
  outfile: "main.js",
  banner: { js: "/* toolbar+ | generated from src/main.ts */" },
});
