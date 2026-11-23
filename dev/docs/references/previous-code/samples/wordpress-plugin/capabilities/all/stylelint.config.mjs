export default {
	extends: ['@wordpress/stylelint-config'],
	ignoreFiles: [
		'**/node_modules/**',
		'**/vendor/**',
		'**/.git/**',
		'**/dist/**',
		'**/build/**',
		'**/.phpstan-cache/**',
	],
};
