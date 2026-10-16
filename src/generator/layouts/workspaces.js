import { scripts as localScripts, context } from "./single.js";
import { quote } from "../../platform/process.js";
export { context };
export const dependencyOwner = (project) => project.path;

export function scripts(project, contribution) {
  const result = localScripts(project, contribution);
  // npm workspace commands are issued from the registration root, once per selected child.
  if (project.path === ".") {
    const calls = project.descendants.map((child) => `npm run lint:local --workspace=${quote(child)} --if-present`);
    if (calls.length) result.lint = [...(result["lint:local"] ? ["npm run lint:local"] : []), ...calls].join(" && ");
  }
  return result;
}
