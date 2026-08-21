import { defineConfig, devices } from '@playwright/test';

const liveBaseURL = process.env.LIVE_E2E_BASE_URL;
if (!/^http:\/\/127\.0\.0\.1:\d{1,5}$/u.test(liveBaseURL ?? '')) {
	throw new Error('LIVE_E2E_BASE_URL must be an ephemeral loopback origin');
}

export default defineConfig({
	testDir: './tests/e2e/live',
	testMatch: '**/*.spec.js',
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	workers: 1,
	reporter: 'list',
	outputDir: '/tmp/mariprogramming-live-playwright-results',
	use: {
		baseURL: liveBaseURL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure'
	},
	projects: [
		{
			name: 'live-chromium',
			use: { ...devices['Desktop Chrome'], channel: 'chrome' }
		}
	],
	webServer: {
		command: `npm run dev -- --config vite.live-e2e.config.js --host 127.0.0.1 --port ${new URL(liveBaseURL).port} --strictPort`,
		url: liveBaseURL,
		reuseExistingServer: false,
		timeout: 120000,
		env: process.env
	}
});
