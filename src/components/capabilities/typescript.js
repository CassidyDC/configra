/**
 * @file TypeScript capability metadata for source extensions and ESLint integration.
 */

/**
 * @typedef {import("../../contracts.js").CapabilityDefinition} CapabilityDefinition
 */

/**
 * TypeScript file support and lint tooling without automatically choosing a bundler.
 *
 * @type {CapabilityDefinition}
 */
export default { id: "typescript", language: "javascript", extensions: ["ts", "mts", "cts"], tools: ["eslint"] };
