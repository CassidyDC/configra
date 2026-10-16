export function context(project, resolved) {
  return {
    ...project,
    excludes: [
      "**/node_modules/**",
      "**/vendor/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      ...project.children.map((child) => child.slice(project.path === "." ? 0 : project.path.length + 1) + "/**"),
    ],
    layout: resolved.request.layout,
  };
}

export function scripts(project, contribution) {
  const result = { ...contribution.scripts };
  const checks = Object.keys(result)
    .filter((name) => name.startsWith("lint:") || name === "format:check")
    .sort();
  if (checks.length) result["lint:local"] = checks.map((name) => `npm run ${name}`).join(" && ");
  if (checks.length) result.lint = "npm run lint:local";
  return result;
}
export const dependencyOwner = (project) => project.path;
