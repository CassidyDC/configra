import { scripts as localScripts, context } from "./single.js";
import { quote } from "../../platform/process.js";
export { context };
export const dependencyOwner = (project) => project.path;

export function scripts(project, contribution) {
  const result = localScripts(project, contribution);
  // Select exact workspace names: a path selector also includes nested workspaces in npm.
  if (project.path === ".") {
    const calls = project.descendants.map(
      (child) => `npm run lint:local --workspace=${quote(project.workspaceNames[child])} --if-present`,
    );
    if (calls.length) result.lint = [...(result["lint:local"] ? ["npm run lint:local"] : []), ...calls].join(" && ");
  }
  return result;
}
