import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default [
	{
		ignores: [
			'.DS_Store',
			'.vercel/**',
			'.svelte-kit/**',
			'build/**',
			'package/**',
			'node_modules/**',
			'.env',
			'.env.*',
			'!.env.example',
			'pnpm-lock.yaml',
			'package-lock.json',
			'yarn.lock'
		]
	},
	{
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: 'module',
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	js.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	{
		files: ['**/*.svelte'],
		rules: {
			// Task 8 replaces the legacy views, then restores the recommended error severity.
			'svelte/require-each-key': 'warn'
		}
	}
];
