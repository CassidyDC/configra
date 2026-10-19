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
		files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
		extends: [wordpress.configs.recommended],
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
			parserOptions: { ecmaFeatures: { jsx: false } },
		},
	},
	{ files: ['**/*.{ts,mts,cts,tsx}'], extends: [tseslint.configs.recommended] },
	prettier
);
