/* global importScripts, loadPyodide */
importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js');

/** @type {Promise<any> | null} */
let pyodidePromise = null;

/** @param {string} indexURL */
function getPyodide(indexURL) {
	if (!pyodidePromise) {
		pyodidePromise = loadPyodide({ indexURL });
	}
	return pyodidePromise;
}

const RUNNER = `
import ast
import json
from pathlib import Path

def apply_overrides(source, mapping):
    mapping = dict(mapping or {})
    class Override(ast.NodeTransformer):
        def visit_Assign(self, node):
            self.generic_visit(node)
            if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
                name = node.targets[0].id
                if name in mapping:
                    node.value = ast.Constant(mapping[name])
            return node
    tree = ast.parse(source)
    tree = Override().visit(tree)
    ast.fix_missing_locations(tree)
    return compile(tree, "<student>", "exec")

def export_namespace(ns):
    out = {}
    skip = {"apply_overrides", "export_namespace", "json", "Path", "ast"}
    for key, value in ns.items():
        if key.startswith("_") or key in skip:
            continue
        if callable(value):
            out[key] = {"kind": "function"}
        elif isinstance(value, (int, float, str, bool)) or value is None:
            out[key] = value
        elif isinstance(value, (list, tuple)):
            try:
                json.dumps(list(value))
                out[key] = list(value)
            except Exception:
                pass
        elif isinstance(value, dict):
            try:
                json.dumps(value)
                out[key] = value
            except Exception:
                pass
    return out

def list_text_files():
    files = {}
    roots = [Path("."), Path("/home/pyodide")]
    for root in roots:
        try:
            paths = root.glob("*.txt")
        except Exception:
            continue
        for path in paths:
            try:
                files[path.name] = path.read_text()
            except Exception:
                continue
    return files

ns = {}
error = None
try:
    compiled = apply_overrides(STUDENT_SOURCE, json.loads(OVERRIDES_JSON))
    exec(compiled, ns, ns)
except Exception as exc:
    error = str(exc)

if PROBE == "functions" and error is None:
    try:
        is_valid = ns.get("is_valid")
        if callable(is_valid):
            ns["is_valid_ok"] = bool(is_valid(12.1, 20))
            ns["is_valid_outlier"] = bool(is_valid(48.7, 20))
        average_fn = None
        for name in ("average", "mean", "compute_average", "avg"):
            candidate = ns.get(name)
            if callable(candidate):
                average_fn = candidate
                break
        values = ns.get("valid_readings")
        if callable(average_fn) and isinstance(values, list) and len(values) > 0:
            ns["probed_average"] = float(average_fn(values))
    except Exception as exc:
        error = str(exc)

RESULT = {
    "error": error,
    "globals": export_namespace(ns),
    "files": list_text_files(),
}
`;

self.onmessage = async (event) => {
	const data = event.data ?? {};
	const id = data.id;
	try {
		const pyodide = await getPyodide(String(data.indexURL ?? ''));
		const stdoutOut = { text: '', decoder: new TextDecoder() };
		const stderrOut = { text: '', decoder: new TextDecoder() };
		let inputCount = 0;
		const stdin = Array.isArray(data.stdin) ? data.stdin.map(String) : [];
		// Prefer write over batched: Pyodide 0.27 StringWriter drops \n in batched().
		pyodide.setStdout({
			write(buf) {
				stdoutOut.text += stdoutOut.decoder.decode(buf);
				return buf.length;
			}
		});
		pyodide.setStderr({
			write(buf) {
				stderrOut.text += stderrOut.decoder.decode(buf);
				return buf.length;
			}
		});
		pyodide.setStdin({
			stdin: () => {
				if (stdin.length === 0) return null;
				inputCount += 1;
				const line = stdin.shift();
				return line == null ? null : `${line}\n`;
			}
		});
		pyodide.globals.set('STUDENT_SOURCE', String(data.code ?? ''));
		pyodide.globals.set('OVERRIDES_JSON', JSON.stringify(data.overrides ?? {}));
		pyodide.globals.set('PROBE', data.probe ?? '');
		await pyodide.runPythonAsync(RUNNER);
		const resultProxy = pyodide.globals.get('RESULT');
		const result = resultProxy.toJs({ dict_converter: Object.fromEntries });
		resultProxy.destroy?.();
		self.postMessage({
			id,
			type: 'result',
			result: {
				stdout: stdoutOut.text,
				stderr: result.error ? `${stderrOut.text}${result.error}` : stderrOut.text,
				error: result.error ?? null,
				globals: result.globals ?? {},
				files: result.files ?? {},
				inputCount
			}
		});
	} catch (caught) {
		self.postMessage({
			id,
			type: 'error',
			message: caught instanceof Error ? caught.message : 'Python failed to run.'
		});
	}
};
