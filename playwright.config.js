import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173';
const prePersistenceBookDeliverySpecs = [
	'**/book-cart-status.spec.js',
	'**/book-checkout-confirmation.spec.js',
	'**/book-delivery.spec.js',
	'**/live/**'
];

export default defineConfig({
	testDir: './tests/e2e',
	// These old specs depend on the removed browser fixture catalogue. The release suite below
	// covers the closed public boundary; server behaviour and races run against disposable Postgres.
	testIgnore: prePersistenceBookDeliverySpecs,
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'list',
	outputDir: '/tmp/mariprogramming-playwright-results',
	use: {
		baseURL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
		url: baseURL,
		reuseExistingServer: false,
		timeout: 120000,
		env: {
			...process.env,
			APP_ORIGIN: baseURL,
			BOOK_DELIVERY_LAUNCH_STATE: 'coming-soon'
		}
	}
});
