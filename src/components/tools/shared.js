export const json = (value) => JSON.stringify(value, null, 2) + "\n";
export const xml = (value) =>
  String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export const patterns = (project) => [
  `**/*.{js,mjs,cjs${project.capabilities.includes("react") ? ",jsx" : ""}${project.capabilities.includes("typescript") ? ",ts,mts,cts" : ""}${project.capabilities.includes("react") && project.capabilities.includes("typescript") ? ",tsx" : ""}}`,
];
export const hook = (id, glob, run) => ({ id, glob, run });
