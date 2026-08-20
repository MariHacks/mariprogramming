import { resolve } from 'node:path';
import {
	createLiveE2EEnvironment,
	reserveLoopbackPort,
	runChild,
	startDisposablePostgres
} from '../tests/e2e/live/support/live-harness.mjs';

const PASSTHROUGH_ENVIRONMENT_NAMES = Object.freeze([
	'CI',
	'HOME',
	'LANG',
	'LC_ALL',
	'LOGNAME',
	'NODE_OPTIONS',
	'PATH',
	'PLAYWRIGHT_BROWSERS_PATH',
	'SHELL',
	'TMPDIR',
	'USER'
]);

function cleanProcessEnvironment() {
	return Object.fromEntries(
		PASSTHROUGH_ENVIRONMENT_NAMES.flatMap((name) =>
			typeof process.env[name] === 'string' ? [[name, process.env[name]]] : []
		)
	);
}

async function main() {
	const database = await startDisposablePostgres();
	let child;
	let signal = null;

	for (const name of ['SIGINT', 'SIGTERM']) {
		process.once(name, () => {
			signal = name;
			child?.kill(name);
		});
	}

	try {
		const applicationPort = await reserveLoopbackPort();
		const baseURL = `http://127.0.0.1:${applicationPort}`;
		const environment = {
			...cleanProcessEnvironment(),
			LIVE_E2E_BASE_URL: baseURL,
			...createLiveE2EEnvironment({
				baseURL,
				databaseUrl: database.databaseUrl
			})
		};
		child = runChild(
			process.execPath,
			[
				resolve('node_modules/@playwright/test/cli.js'),
				'test',
				'--config',
				resolve('playwright.live.config.js')
			],
			environment
		);
		const exitCode = await new Promise((resolveCode, reject) => {
			child.once('error', reject);
			child.once('exit', (code) => resolveCode(code ?? 1));
		});
		process.exitCode = signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : exitCode;
	} finally {
		await database.stop();
	}
}

void main().catch((error) => {
	process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
	process.exitCode = 1;
});
