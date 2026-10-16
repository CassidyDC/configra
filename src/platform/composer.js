import path from "node:path";
import { execute } from "./process.js";

export function installation(root, packagePath) {
  return {
    ecosystem: "composer",
    package: packagePath,
    command: "composer",
    args: ["update", "--no-interaction"],
    cwd: path.resolve(root, packagePath),
  };
}
export const install = execute;
