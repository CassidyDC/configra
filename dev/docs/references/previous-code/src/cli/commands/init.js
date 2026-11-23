/**
 * Initialize Project
 * @file CLI initialization command backed by the shared generation workflow.
 */

import { generate } from "./generate.js";

/**
 * @typedef {typeof import("./generate.js").generate} GenerateCommand
 */

/**
 * Initialize a setup using the shared generation workflow.
 *
 * @type {GenerateCommand}
 */
export const init = generate;
