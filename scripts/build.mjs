import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const assetsDir = path.join(distDir, "assets");
const indexPath = path.join(rootDir, "index.html");
const distIndexPath = path.join(distDir, "index.html");

const staticFiles = [
  "styles.css",
  "robots.txt",
  "sitemap.xml",
  "_headers",
  "favicon.svg",
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "favicon-48x48.png",
  "social-preview.png",
];

await rm(distDir, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });

for (const relativePath of staticFiles) {
  await cp(path.join(rootDir, relativePath), path.join(distDir, relativePath), {
    recursive: true,
    force: true,
  });
}

const sourceIndex = await readFile(indexPath, "utf8");
if (!sourceIndex.includes('./src/main.js')) {
  throw new Error("Expected index.html to reference ./src/main.js");
}
const bundledIndex = sourceIndex.replace('./src/main.js', './assets/main.js');
await writeFile(distIndexPath, bundledIndex, "utf8");

const buildResult = await Bun.build({
  entrypoints: [path.join(rootDir, "src/main.js")],
  outdir: assetsDir,
  target: "browser",
  format: "esm",
  splitting: true,
  minify: true,
  sourcemap: "none",
});

if (!buildResult.success) {
  for (const log of buildResult.logs) {
    console.error(log);
  }
  process.exit(1);
}

const outputCount = buildResult.outputs.length;
console.log(`Built ${outputCount} asset${outputCount === 1 ? "" : "s"} into dist/assets`);
