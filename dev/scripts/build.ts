/**
 * Build Script
 * @file Compiles the published source and copies runtime assets into dist/.
 */

import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, globSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const dist = new URL("../../dist/", import.meta.url);

rmSync(dist, { recursive: true, force: true });

const compile = spawnSync("npx", ["tsc", "-p", "tsconfig.build.json"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (compile.status !== 0) {
  process.exit(compile.status ?? 1);
}

// Copy runtime assets, such as generated helper scripts, beside their compiled integrations.
for (const asset of globSync("src/**/assets/**/*.*", { cwd: root }).filter((path) => !path.endsWith(".d.mts"))) {
  const target = join(fileURLToPath(dist), asset.slice("src/".length));

  rmSync(target, { force: true });
  cpSync(join(root, asset), target, { recursive: false });
  chmodSync(dirname(target), 0o755);
}

// Emit the published JSON Schemas from the compiled runtime schemas.
const { publishedSchemas } = (await import(
  new URL("generator/state/emit-schemas.js", dist).href
)) as typeof import("../../src/generator/state/emit-schemas.ts");
const { version } = JSON.parse(readFileSync(new URL("package.json", new URL("../../", import.meta.url)), "utf8")) as {
  version: string;
};

mkdirSync(new URL("schemas/", dist), { recursive: true });

for (const schema of publishedSchemas(version)) {
  writeFileSync(new URL(`schemas/${schema.file}`, dist), schema.text);
}

chmodSync(new URL("cli/index.js", dist), 0o755);
