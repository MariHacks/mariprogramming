import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WORKER_SOURCE = readFileSync(resolve(process.cwd(), 'static/pbl/python-worker.js'), 'utf8');
const RUNNER = /const RUNNER = `([\s\S]*?)`;\n/u.exec(WORKER_SOURCE)?.[1] ?? '';

const HARNESS = `
import io, json, sys

_payload = json.loads(sys.stdin.buffer.read().decode("utf-8"))
_lines = list(_payload["stdin"])
_state = {"count": 0}

class _Stdin:
    def readline(self):
        if not _lines:
            return ""
        _state["count"] += 1
        line = _lines.pop(0)
        if _payload.get("echo"):
            _out.write(line + "\\n")
        return line + "\\n"
    def close(self):
        raise RuntimeError("stdin was closed")

_out = io.StringIO()
sys.stdin = _Stdin()
sys.stdout = _out
STUDENT_SOURCE = _payload["code"]
OVERRIDES_JSON = json.dumps(_payload.get("overrides", {}))
PROBE = _payload.get("probe") or ""
ROLLS_JSON = json.dumps(_payload.get("rolls", []))
exec(_payload["runner"], globals())
sys.stdout = sys.__stdout__
sys.stdout.write(json.dumps({
    "stdout": _out.getvalue(),
    "result": RESULT,
    "inputCount": _state["count"],
}))
`;

export const pythonAvailable = spawnSync('python3', ['--version']).status === 0;

/**
 * Runs a program through the same Python runner the browser worker uses, with
 * plain CPython standing in for Pyodide. Mirrors PythonRunResult.
 *
 * @param {string} code
 * @param {{ stdin?: string[], overrides?: Record<string, number>, probe?: string, rolls?: number[], echo?: boolean }} [trial]
 */
export function runPython(code, trial = {}) {
	const child = spawnSync('python3', ['-c', HARNESS], {
		input: JSON.stringify({
			runner: RUNNER,
			code,
			stdin: trial.stdin ?? [],
			overrides: trial.overrides ?? {},
			probe: trial.probe ?? '',
			rolls: trial.rolls ?? [],
			echo: trial.echo === true
		}),
		encoding: 'utf8',
		timeout: 20000
	});
	if (child.status !== 0) {
		throw new Error(`python harness failed: ${child.stderr}`);
	}
	const parsed = JSON.parse(child.stdout);
	return {
		stdout: parsed.stdout,
		stderr: parsed.result.error ?? '',
		error: parsed.result.error ?? null,
		globals: parsed.result.globals ?? {},
		files: parsed.result.files ?? {},
		inputCount: parsed.inputCount,
		exited: parsed.result.exited === true,
		rollCount: parsed.result.rollCount ?? 0
	};
}

/** Host shaped like createPythonHost() for runGamejamCheck. */
export const pythonSimHost = {
	/** @param {string} code @param {any} [trial] */
	async run(code, trial) {
		return runPython(code, trial);
	}
};
