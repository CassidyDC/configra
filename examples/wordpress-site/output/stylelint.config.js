/**
 * Stylelint configuration.
 *
 * Configra manages .configra/stylelint.js. Add your own rules inside `rules` after the spread; they
 * override Configra's. Spreading the file, instead of extending it, keeps its `ignoreFiles` in effect.
 *
 * @see https://stylelint.io/user-guide/configure
 */

import configra from './.configra/stylelint.js';

/** @type {import("stylelint").Config} */
export default {
	...configra,
	rules: {
		...configra.rules,
		// "selector-class-pattern": null,
	},
};
