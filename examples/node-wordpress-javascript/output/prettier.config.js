/**
 * Prettier configuration.
 *
 * Configra manages .configra/prettier.mjs and keeps it in sync with .editorconfig. Add your own
 * options after the spread; they override Configra's.
 *
 * @see https://prettier.io/docs/configuration
 */

import configra from './.configra/prettier.mjs';

/** @type {import("prettier").Config} */
export default {
	...configra,
	// printWidth: 100,
};
