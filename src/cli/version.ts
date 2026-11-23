import { readFileSync } from "node:fs";

/**
 * Reads the installed Configra version from the package manifest.
 *
 * Both `src/cli/` and the compiled `dist/cli/` sit two levels below the package root.
 */
export function readVersion(): string {
  const manifestUrl = new URL("../../package.json", import.meta.url);
  const manifest = JSON.parse(readFileSync(manifestUrl, "utf8")) as { version: string };

  return manifest.version;
}
