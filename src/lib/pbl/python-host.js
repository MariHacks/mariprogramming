import { PYODIDE_INDEX_URL } from './csp.js';

const DEFAULT_TIMEOUT_MS = 12000;
const LOAD_TIMEOUT_MS = 120000;
const WORKER_URL = '/pbl/python-worker.js';

/**
 * @typedef {{
 *   stdout: string,
 *   stderr: string,
 *   error: string | null,
 *   globals: Record<string, unknown>,
 *   files: Record<string, string>,
 *   inputCount: number
 * }} PythonRunResult
 */

/** @param {unknown} error */
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	return 'Python failed to run.';
}

/**
 * @param {{
 *   Worker?: typeof Worker,
 *   workerUrl?: string,
 *   indexURL?: string,
 *   timeoutMs?: number
 * }} [options]
 */
export function createPythonHost(options = {}) {
	const WorkerImpl = options.Worker ?? globalThis.Worker;
	const workerUrl = options.workerUrl ?? WORKER_URL;
	const indexURL = options.indexURL ?? PYODIDE_INDEX_URL;
	const timeoutMs = options.timeoutMs;
	let runtimeReady = false;
	/** @type {Worker | null} */
	let worker = null;
	let nextId = 1;
	/** @type {Map<number, { resolve: (value: PythonRunResult) => void, reject: (error: Error) => void, timer: ReturnType<typeof setTimeout> }>} */
	const pending = new Map();

	function clearPending(id) {
		const request = pending.get(id);
		clearTimeout(request.timer);
		pending.delete(id);
	}

	function failAll(message) {
		for (const [id, request] of pending) {
			clearTimeout(request.timer);
			pending.delete(id);
			request.resolve({
				stdout: '',
				stderr: message,
				error: message,
				globals: {},
				files: {},
				inputCount: 0
			});
		}
	}

	function attach(current) {
		current.addEventListener('message', (event) => {
			const data = event.data;
			if (!data || typeof data !== 'object') return;
			const id = /** @type {{ id?: unknown }} */ (data).id;
			if (typeof id !== 'number') return;
			const request = pending.get(id);
			if (!request) return;
			clearPending(id);
			if (data.type === 'result' && data.result && typeof data.result === 'object') {
				runtimeReady = true;
				request.resolve(/** @type {PythonRunResult} */ (data.result));
				return;
			}
			const message = typeof data.message === 'string' ? data.message : 'Python failed to run.';
			request.resolve({
				stdout: '',
				stderr: message,
				error: message,
				globals: {},
				files: {},
				inputCount: 0
			});
		});
		current.addEventListener('error', () => {
			restart('The Python runtime crashed. The page is still here; try Run again.');
		});
	}

	function restart(message) {
		failAll(message);
		worker?.terminate();
		worker = null;
		runtimeReady = false;
	}

	function ensureWorker() {
		if (worker) return worker;
		if (typeof WorkerImpl !== 'function') {
			throw new Error('Python is unavailable in this browser.');
		}
		worker = new WorkerImpl(workerUrl);
		attach(worker);
		return worker;
	}

	/**
	 * @param {string} code
	 * @param {{ stdin?: string[], overrides?: Record<string, number>, probe?: string }} [trial]
	 * @returns {Promise<PythonRunResult>}
	 */
	async function run(code, trial = {}) {
		try {
			const current = ensureWorker();
			const id = nextId;
			nextId += 1;
			const waitMs = timeoutMs ?? (runtimeReady ? DEFAULT_TIMEOUT_MS : LOAD_TIMEOUT_MS);
			return await new Promise((resolve, reject) => {
				const timer = setTimeout(() => {
					pending.delete(id);
					restart('The program ran too long and was stopped. The page is still here.');
					resolve({
						stdout: '',
						stderr: 'The program ran too long and was stopped. The page is still here.',
						error: 'timeout',
						globals: {},
						files: {},
						inputCount: 0
					});
				}, waitMs);
				pending.set(id, { resolve, reject, timer });
				current.postMessage({
					id,
					type: 'run',
					code,
					stdin: trial.stdin ?? [],
					overrides: trial.overrides ?? {},
					probe: trial.probe ?? null,
					indexURL
				});
			});
		} catch (error) {
			restart(errorMessage(error));
			return {
				stdout: '',
				stderr: errorMessage(error),
				error: errorMessage(error),
				globals: {},
				files: {},
				inputCount: 0
			};
		}
	}

	function destroy() {
		restart('Python stopped.');
	}

	return { run, destroy };
}
