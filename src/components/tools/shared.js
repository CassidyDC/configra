/**
 * @typedef {import("../../contracts.js").PackageContext} PackageContext
 * @typedef {import("../../contracts.js").HookRequirement} HookRequirement
 */

/**
 * Serialize tool-native configuration data with a trailing newline.
 *
 * @param {unknown} value JSON-serializable configuration.
 * @returns {string} Indented JSON text.
 */
export const json = (value) => JSON.stringify(value, null, 2) + "\n";

/**
 * Escape text used in generated XML attributes and element content.
 *
 * @param {unknown} value Value converted to text before escaping.
 * @returns {string} XML-safe text.
 */
export const xml = (value) =>
  String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/**
 * Derive JavaScript-family filename globs from the selected capabilities.
 *
 * @param {PackageContext} project Resolved capability selections.
 * @returns {string[]} Package-relative JavaScript, JSX, TypeScript, and TSX patterns.
 */
export const patterns = (project) => [
  `**/*.{js,mjs,cjs${project.capabilities.includes("react") ? ",jsx" : ""}${project.capabilities.includes("typescript") ? ",ts,mts,cts" : ""}${project.capabilities.includes("react") && project.capabilities.includes("typescript") ? ",tsx" : ""}}`,
];

/**
 * Create a staged check requirement for later package and Git-root routing.
 *
 * @param {string} id Stable tool check identifier.
 * @param {string[]} glob Package-relative filename patterns.
 * @param {string} run Command using Lefthook staged-file placeholders.
 * @returns {HookRequirement} Unrouted staged check contribution.
 */
export const hook = (id, glob, run) => ({ id, glob, run });
