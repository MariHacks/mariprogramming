import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ARTIFACTS = join(process.cwd(), '.artifacts/pbl-interactive-stdin');

test('PBL team studio enables cross-origin isolation for interactive stdin', async ({ page }) => {
	await page.goto('/pbl/science/AAAAAA');
	const isolated = await page.evaluate(() => ({
		crossOriginIsolated: window.crossOriginIsolated === true,
		sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined'
	}));
	expect(isolated.crossOriginIsolated).toBe(true);
	expect(isolated.sharedArrayBuffer).toBe(true);
});

test('Pyodide worker serves interactive stdin handler', async ({ request }) => {
	const worker = await request.get('/pbl/python-worker.js');
	expect(worker.ok()).toBeTruthy();
	expect(await worker.text()).toContain('stdin-request');
});

// Full Pyodide cold start in headless Chrome exceeds CI time budgets; the worker
// protocol is covered by vitest (python-worker.test.js + python-host.test.js).
test.skip('Pyodide worker waits for stdin instead of returning EOF', async ({ page }) => {
	test.setTimeout(360000);
	test.slow();
	await page.goto('/pbl/science/AAAAAA');
	const result = await page.evaluate(async () => {
		if (typeof SharedArrayBuffer === 'undefined') {
			return { ok: false, reason: 'SharedArrayBuffer unavailable' };
		}
		const indexURL = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/';
		const backing = new SharedArrayBuffer(8200);
		const control = new Int32Array(backing, 0, 2);
		const bytes = new Uint8Array(backing, 8, 8192);
		const encoder = new TextEncoder();
		const deliver = (line) => {
			const encoded = encoder.encode(line);
			bytes.set(encoded);
			Atomics.store(control, 1, encoded.length);
			Atomics.store(control, 0, 1);
			Atomics.notify(control, 0, 1);
		};

		const worker = new Worker('/pbl/python-worker.js');
		/** @param {number} runId @param {string} code @param {boolean} [interactiveRun] */
		const runInWorker = (runId, code, interactiveRun = false) =>
			new Promise((resolve) => {
				const timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), 240000);
				/** @param {MessageEvent} event */
				const onMessage = (event) => {
					const data = event.data ?? {};
					if (data.id !== runId) return;
					if (data.type === 'stdin-request') {
						deliver('typed after prompt');
						return;
					}
					if (data.type === 'error') {
						clearTimeout(timer);
						worker.removeEventListener('message', onMessage);
						resolve({ ok: false, reason: data.message ?? 'worker error' });
						return;
					}
					if (data.type === 'result') {
						clearTimeout(timer);
						worker.removeEventListener('message', onMessage);
						resolve({
							ok: true,
							stdout: data.result?.stdout ?? '',
							error: data.result?.error ?? null,
							inputCount: data.result?.inputCount ?? 0
						});
					}
				};
				worker.addEventListener('message', onMessage);
				worker.postMessage({
					id: runId,
					type: 'run',
					code,
					stdin: [],
					...(interactiveRun ? { interactive: true, stdinBuffer: backing } : {}),
					indexURL
				});
			});

		const warm = await runInWorker(1, 'print("warm")\n');
		if (!warm.ok) {
			worker.terminate();
			return warm;
		}
		const outcome = await runInWorker(
			2,
			'print("Experiment loaded")\nx = input("Enter your goofy excuse: ")\nprint(x)\n',
			true
		);
		worker.terminate();
		return outcome;
	});
	expect(result.ok, result.reason ?? 'worker failed').toBe(true);
	expect(String(result.stdout)).toContain('Experiment loaded');
	expect(String(result.stdout)).toContain('Enter your goofy excuse:');
	expect(String(result.stdout)).toContain('typed after prompt');
	expect(String(result.error ?? '')).not.toMatch(/EOF/i);
	expect(result.inputCount).toBe(1);
	mkdirSync(ARTIFACTS, { recursive: true });
	await page.screenshot({ path: join(ARTIFACTS, 'interactive-stdin-proof.png'), fullPage: true });
});
