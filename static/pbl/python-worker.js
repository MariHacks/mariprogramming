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
    # When workshop input names are overridden, also rewrite Assigns of the
    # canonical starter constants so student-chosen names still recompute.
    value_map = {}
    if "reading" in mapping:
        value_map[12.1] = mapping["reading"]
    if "uncertainty" in mapping:
        value_map[0.2] = mapping["uncertainty"]
    class Override(ast.NodeTransformer):
        def visit_Assign(self, node):
            self.generic_visit(node)
            if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
                name = node.targets[0].id
                if name in mapping:
                    node.value = ast.Constant(mapping[name])
                elif isinstance(node.value, ast.Constant) and node.value.value in value_map:
                    node.value = ast.Constant(value_map[node.value.value])
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
        validator = ns.get("is_valid") if callable(ns.get("is_valid")) else None
        if validator is None:
            for name, candidate in list(ns.items()):
                if name.startswith("_") or not callable(candidate):
                    continue
                try:
                    ok = bool(candidate(12.1, 20))
                    bad = bool(candidate(48.7, 20))
                except Exception:
                    continue
                if ok is True and bad is False:
                    validator = candidate
                    break
        if callable(validator):
            ns["is_valid_ok"] = bool(validator(12.1, 20))
            ns["is_valid_outlier"] = bool(validator(48.7, 20))
        average_fn = None
        for name in ("average", "mean", "compute_average", "avg"):
            candidate = ns.get(name)
            if callable(candidate):
                average_fn = candidate
                break
        if average_fn is None:
            for name, candidate in list(ns.items()):
                if name.startswith("_") or not callable(candidate):
                    continue
                if candidate is validator:
                    continue
                lowered = name.lower()
                if "avg" in lowered or "mean" in lowered or "average" in lowered:
                    average_fn = candidate
                    break
        values = ns.get("valid_readings")
        if not isinstance(values, list) or len(values) == 0:
            for candidate in ns.values():
                if isinstance(candidate, list) and len(candidate) == 5 and 48.7 not in candidate:
                    values = candidate
                    break
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
