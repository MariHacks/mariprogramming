import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pythonAvailable, runPython } from '../../test/python-worker-sim.js';

const WORKER_SOURCE = readFileSync(resolve(process.cwd(), 'static/pbl/python-worker.js'), 'utf8');

/**
 * Loads the real worker file against a stub Pyodide so its message handling can be tested.
 * @param {(globals: Map<string, any>, hooks: { stdin: () => string | null, out: (text: string) => void }) => any} runPythonAsync
 */
async function loadWorker(runPythonAsync) {
	const posted = [];
	const globals = new Map();
	const io = { stdout: null, stdin: null };
	const pyodide = {
		globals: {
			set: (key, value) => globals.set(key, value),
			get: (key) => globals.get(key)
		},
		setStdout: (handler) => (io.stdout = handler),
		setStderr: () => {},
		setStdin: (handler) => (io.stdin = handler),
		runPythonAsync: async () =>
			runPythonAsync(globals, {
				stdin: () => io.stdin.stdin(),
				out: (text) => io.stdout.write(new TextEncoder().encode(text))
			})
	};
	const self = { postMessage: (message) => posted.push(message) };
	new Function('self', 'importScripts', 'loadPyodide', WORKER_SOURCE)(
		self,
		() => {},
		async () => pyodide
	);
	return { self, posted, globals };
}

const RESULT = (extra = {}) => ({
	toJs: () => ({ error: null, globals: {}, files: {}, exited: false, rollCount: 0, ...extra }),
	destroy() {}
});

describe('python worker messages', () => {
	it('hands scripted rolls to the runner and reports exit and roll counts back', async () => {
		const { self, posted, globals } = await loadWorker((store) => {
			store.set('RESULT', RESULT({ exited: true, rollCount: 2 }));
		});
		await self.onmessage({
			data: { id: 7, code: 'print(1)', stdin: [], rolls: [4, 7], indexURL: 'x' }
		});
		expect(globals.get('ROLLS_JSON')).toBe('[4,7]');
		expect(posted[0]).toMatchObject({
			id: 7,
			type: 'result',
			result: { exited: true, rollCount: 2, error: null, inputCount: 0 }
		});
	});

	it('runs with no scripted rolls and reports exited false by default', async () => {
		const { self, posted, globals } = await loadWorker((store) => {
			store.set('RESULT', {
				toJs: () => ({ error: null, globals: {}, files: {} }),
				destroy() {}
			});
		});
		await self.onmessage({ data: { id: 1, code: 'x = 1', indexURL: 'x' } });
		expect(globals.get('ROLLS_JSON')).toBe('[]');
		expect(posted[0].result).toMatchObject({ exited: false, rollCount: 0 });
	});

	it('echoes each typed answer into the output only when a trial asks for it', async () => {
		const run = (echo) =>
			loadWorker((store, hooks) => {
				hooks.out('Name: ');
				hooks.stdin();
				hooks.out('done\n');
				store.set('RESULT', RESULT());
			}).then(async ({ self, posted }) => {
				await self.onmessage({ data: { id: 1, code: '', stdin: ['Ada'], echo, indexURL: 'x' } });
				return posted[0].result;
			});
		expect((await run(true)).stdout).toBe('Name: Ada\ndone\n');
		expect((await run(true)).inputCount).toBe(1);
		expect((await run(false)).stdout).toBe('Name: done\n');
		expect((await run(undefined)).stdout).toBe('Name: done\n');
	});

	it('does not echo when the input queue is empty', async () => {
		const { self, posted } = await loadWorker((store, hooks) => {
			hooks.out('Name: ');
			expect(hooks.stdin()).toBeNull();
			store.set('RESULT', RESULT());
		});
		await self.onmessage({ data: { id: 1, code: '', stdin: [], echo: true, indexURL: 'x' } });
		expect(posted[0].result.stdout).toBe('Name: ');
		expect(posted[0].result.inputCount).toBe(0);
	});
});

describe.skipIf(!pythonAvailable)('python runner semantics', () => {
	it('hands out scripted dice in call order, then falls back to real random', () => {
		const run = runPython(
			'import random\nprint(random.randint(1, 6), random.randint(1, 10), random.randint(1, 6))\n',
			{ rolls: [4, 99] }
		);
		const [first, second, third] = run.stdout.trim().split(' ').map(Number);
		expect(first).toBe(4);
		expect(second).toBe(10);
		expect(third).toBeGreaterThanOrEqual(1);
		expect(third).toBeLessThanOrEqual(6);
		// Counts every randint call made while dice were scripted, scripted or not.
		expect(run.rollCount).toBe(3);
		expect(run.error).toBeNull();
	});

	it('clamps a scripted roll into the range the program asked for', () => {
		const run = runPython('import random\nprint(random.randint(2, 3))\n', { rolls: [0] });
		expect(run.stdout.trim()).toBe('2');
	});

	it('works with from random import randint too', () => {
		const run = runPython('from random import randint\nprint(randint(1, 6))\n', { rolls: [5] });
		expect(run.stdout.trim()).toBe('5');
	});

	it('stops at exit() without an error and keeps what was printed', () => {
		const run = runPython('attempts = 3\nprint("YOU DIED.")\nexit()\nprint("never")\n');
		expect(run.exited).toBe(true);
		expect(run.error).toBeNull();
		expect(run.stdout).toBe('YOU DIED.\n');
		expect(run.globals.attempts).toBe(3);
	});

	it('supports quit() and sys.exit() the same way', () => {
		expect(runPython('quit()\n').exited).toBe(true);
		expect(runPython('import sys\nsys.exit(0)\n').exited).toBe(true);
	});

	it('leaves stdin usable after exit() so the next trial still reads input', () => {
		runPython('exit()\n');
		const next = runPython('print(input("x"))\n', { stdin: ['ok'] });
		expect(next.stdout).toBe('xok\n');
		expect(next.error).toBeNull();
	});

	it('echoes typed input like a console when asked', () => {
		const run = runPython('name = input("Name: ")\nprint("hi", name)\n', {
			stdin: ['Ada'],
			echo: true
		});
		expect(run.stdout).toBe('Name: Ada\nhi Ada\n');
		expect(runPython('name = input("Name: ")\n', { stdin: ['Ada'] }).stdout).toBe('Name: ');
	});

	it('reports running out of input as an error, not a hang', () => {
		const run = runPython('input("a")\ninput("b")\n', { stdin: ['x'] });
		expect(run.error).toMatch(/EOF/);
		expect(run.inputCount).toBe(1);
	});

	it('keeps the science overrides and function probe working', () => {
		const overridden = runPython(
			'reading = 12.1\nuncertainty = 0.2\nlow = reading - uncertainty\n',
			{
				overrides: { reading: 20, uncertainty: 1 }
			}
		);
		expect(overridden.globals.low).toBe(19);
		const probed = runPython(
			'def is_valid(r, m):\n    return 10 <= r <= m\ndef average(v):\n    return sum(v) / len(v)\nvalid_readings = [12.1, 11.8]\n',
			{ probe: 'functions' }
		);
		expect(probed.globals.is_valid_ok).toBe(true);
		expect(probed.globals.is_valid_outlier).toBe(false);
	});

	it('does not leak the runner helpers, modules or scripted dice into results', () => {
		const run = runPython('import random\nx = random.randint(1, 6)\n', { rolls: [3] });
		expect(Object.keys(run.globals)).toEqual(['x']);
		const after = runPython('import random\nprint(random.randint(1, 1))\n');
		expect(after.stdout.trim()).toBe('1');
		expect(after.rollCount).toBe(0);
	});
});
