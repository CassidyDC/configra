/**
 * @file React capability metadata for JSX support and ESLint integration.
 */

/**
 * @typedef {import("../../contracts.js").CapabilityDefinition} CapabilityDefinition
 */

/**
 * JSX support and lint tooling without automatically choosing a bundler.
 *
 * @type {CapabilityDefinition}
 */
export default { id: "react", language: "javascript", extensions: ["jsx"], tools: ["eslint"] };
