import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPythonHost } from './python-host.js';

/** @param {(worker: FakeWorker, data: any) => void} onPost */
function fakeWorkerClass(onPost) {
	return class FakeWorker {
		/**
		 * @param {string} url
		 * @param {{ type?: string }} [options]
		 */
		constructor(url, options) {
			this.url = url;
			this.options = options;
			this.terminated = false;
			/** @type {((event: MessageEvent) => void) | null} */
			this.messageHandler = null;
			/** @type {((event: Event) => void) | null} */
			this.errorHandler = null;
		}

		/** @param {string} type @param {(event: any) => void} handler */
		addEventListener(type, handler) {
			if (type === 'message') this.messageHandler = handler;
			if (type === 'error') this.errorHandler = handler;
		}

		/** @param {any} data */
		postMessage(data) {
			onPost(this, data);
		}

		terminate() {
			this.terminated = true;
		}
	};
}

describe('python host', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('runs student code in a worker and never throws out to the page', async () => {
		const WorkerImpl = fakeWorkerClass((worker, data) => {
			worker.messageHandler?.({
				data: {
					id: data.id,
					type: 'result',
					result: {
						stdout: 'ok\n',
						stderr: '',
						error: null,
						globals: { reading: 12.1 },
						files: {},
						inputCount: 0
					}
				}
			});
		});
		const host = createPythonHost({ Worker: /** @type {any} */ (WorkerImpl), timeoutMs: 1000 });
		const result = await host.run('print("ok")');
		expect(result.stdout).toBe('ok\n');
		expect(result.globals).toEqual({ reading: 12.1 });
		host.destroy();
	});

	it('turns a worker crash or timeout into a result object', async () => {
		vi.useFakeTimers();
		const WorkerImpl = fakeWorkerClass((worker, data) => {
			if (data.code === 'boom') {
				worker.errorHandler?.(new Event('error'));
				return;
			}
			if (data.code === 'bad-shape') {
				worker.messageHandler?.({ data: null });
				worker.messageHandler?.({ data: { id: 'nope' } });
				worker.messageHandler?.({ data: { id: 999, type: 'result', result: {} } });
				worker.messageHandler?.({ data: { id: data.id, type: 'result', result: 3 } });
				return;
			}
			if (data.code === 'err-msg') {
				worker.messageHandler?.({ data: { id: data.id, type: 'error', message: 'syntax' } });
			}
		});
		const host = createPythonHost({ Worker: /** @type {any} */ (WorkerImpl), timeoutMs: 20 });
		const crashed = await host.run('boom');
		expect(crashed.error).toMatch(/crashed/i);
		const syntax = await host.run('bad-shape');
		expect(syntax.error).toBe('Python failed to run.');
		const labeled = await host.run('err-msg');
		expect(labeled.error).toBe('syntax');
		const hung = host.run('while True: pass');
		await vi.advanceTimersByTimeAsync(25);
		expect((await hung).error).toBe('timeout');
		host.destroy();
	});

	it('uses a longer first-run wait, then the default after Python is ready', async () => {
		const WorkerImpl = fakeWorkerClass((worker, data) => {
			worker.messageHandler?.({
				data: {
					id: data.id,
					type: 'result',
					result: {
						stdout: 'ok\n',
						stderr: '',
						error: null,
						globals: {},
						files: {},
						inputCount: 0
					}
				}
			});
		});
		const host = createPythonHost({ Worker: /** @type {any} */ (WorkerImpl) });
		expect((await host.run('print(1)')).stdout).toBe('ok\n');
		expect((await host.run('print(2)')).stdout).toBe('ok\n');
		host.destroy();
	});

	it('returns a result when Worker is missing', async () => {
		const host = createPythonHost({ Worker: /** @type {any} */ (undefined) });
		const result = await host.run('print(1)');
		expect(result.error).toMatch(/unavailable/i);
		const ThrowingWorker = class {
			constructor() {
				throw 'nope';
			}
		};
		const host2 = createPythonHost({ Worker: /** @type {any} */ (ThrowingWorker) });
		expect((await host2.run('print(1)')).error).toBe('Python failed to run.');
		host2.destroy();
	});
});
