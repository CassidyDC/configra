import { generate } from "./generate.js";
/**
 * Initialize a setup using the shared generation workflow.
 *
 * @type {typeof import("./generate.js").generate}
 */
export const init = generate;
