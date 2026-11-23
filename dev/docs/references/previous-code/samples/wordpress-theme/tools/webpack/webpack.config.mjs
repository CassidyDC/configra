/**
 * Webpack Configuration Template
 * @file Editable Webpack configuration template with entry and Babel-preset placeholders.
 */

import { fileURLToPath } from 'node:url';

/**
 * @typedef {import("webpack").Configuration} WebpackConfiguration
 */

/**
 * Editable Webpack build configuration with module-relative source and output paths.
 *
 * @type {WebpackConfiguration}
 */
export default {
	entry: fileURLToPath(new URL('./src/index.tsx', import.meta.url)),
	output: { path: fileURLToPath(new URL('./dist', import.meta.url)), filename: 'index.js' },
	resolve: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
	module: {
		rules: [
			{
				test: /\.[cm]?[jt]sx?$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: [
							'@babel/preset-env',
							['@babel/preset-react', { runtime: 'automatic' }],
							'@babel/preset-typescript',
						],
					},
				},
			},
		],
	},
};
