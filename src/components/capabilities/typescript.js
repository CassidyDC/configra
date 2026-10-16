/**
 * TypeScript file support and lint tooling without automatically choosing a bundler.
 *
 * @type {import("../../contracts.js").CapabilityDefinition}
 */
export default { id: "typescript", language: "javascript", extensions: ["ts", "mts", "cts"], tools: ["eslint"] };
