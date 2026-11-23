import type { ProjectDefinition } from "./types.js";

export const wordpressSiteProject: ProjectDefinition = {
  id: "wordpress-site",
  label: "WordPress site",
  description: "A WordPress site whose root tooling checks the plugin and theme directories you select.",
  languages: ["javascript", "css", "php"],
  ui: [],
  standard: "wordpress",
  globals: "browser",
  usesPackages: true,
};
