module.exports = {
	...require('@wordpress/prettier-config'),
	...{
		singleQuote: true,
		trailingComma: 'es5',
		bracketSameLine: false,
		bracketSpacing: true,
		semi: true,
		arrowParens: 'always',
		useTabs: true,
		tabWidth: 4,
		endOfLine: 'lf',
		printWidth: 100,
		overrides: [
			{
				files: '**/*.css',
				options: {
					useTabs: true,
					tabWidth: 4,
					endOfLine: 'lf',
					printWidth: 100,
					singleQuote: false,
				},
			},
			{
				files: '**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}',
				options: {
					useTabs: true,
					tabWidth: 4,
					endOfLine: 'lf',
					printWidth: 100,
				},
			},
		],
	},
};
