import { defineConfig } from 'eslint/config';
import globals from 'globals';
import wordpress from '@wordpress/eslint-plugin';
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
		files: ['**/*.{js,mjs,cjs}'],
		extends: [wordpress.configs.recommended],
		languageOptions: { globals: globals.node, parserOptions: { ecmaFeatures: { jsx: false } } },
	},
	prettier
);
