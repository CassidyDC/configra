import { defineConfig } from 'eslint/config';
import globals from 'globals';
import wordpress from '@wordpress/eslint-plugin';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig(
	{
		ignores: [
			'**/node_modules/**',
			'**/vendor/**',
			'**/.git/**',
			'**/dist/**',
			'**/build/**',
			'**/.phpstan-cache/**',
		],
	},
	{
		files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
		extends: [wordpress.configs.recommended],
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
			parserOptions: { ecmaFeatures: { jsx: true } },
		},
		settings: { react: { version: 'detect' } },
	},
	{ files: ['**/*.{ts,mts,cts,tsx}'], extends: [tseslint.configs.recommended] },
	prettier
);
