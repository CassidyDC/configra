import path from "node:path";
import { scripts as localScripts, context } from "./single.js";
import { quote } from "../../platform/process.js";
export { context };
export const dependencyOwner = (project) => project.path;

export function scripts(project, contribution) {
  const result = localScripts(project, contribution);
  const calls = project.children.map(
    (child) => `npm --prefix ${quote(path.posix.relative(project.path, child))} run lint --if-present`,
  );
  if (calls.length) result.lint = [...(result["lint:local"] ? ["npm run lint:local"] : []), ...calls].join(" && ");
  return result;
}
