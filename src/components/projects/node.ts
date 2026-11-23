import type { ProjectDefinition } from "./types.js";

export const nodeProject: ProjectDefinition = {
  id: "node",
  label: "Node.js",
  description: "A Node.js project with its tooling at the root.",
  languages: ["javascript"],
  ui: [],
  standard: "community",
  globals: "node",
  usesPackages: false,
};
