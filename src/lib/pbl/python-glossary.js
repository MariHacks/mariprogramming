/**
 * Beginner glossary for Science PBL lesson prose.
 * Keep examples generic (no checker spoilers).
 *
 * Chips are author-marked only: wrap a glossary alias in backticks in the
 * source string, e.g. `print`, `for`, `input()`, `math.sqrt`. Bare prose is
 * never auto-linked (English "for" stays plain forever).
 *
 * @typedef {{
 *   name: string,
 *   summary: string,
 *   usefulFor: string,
 *   example: string,
 *   params?: string,
 *   returns?: string
 * }} GlossaryEntry
 */

/** @type {Readonly<Record<string, GlossaryEntry>>} */
export const PYTHON_GLOSSARY = Object.freeze({
	print: Object.freeze({
		name: 'print',
		summary: 'Shows a value in the output panel so you can see what your program did.',
		usefulFor: 'Checking results, labels, and short messages while you learn.',
		example: 'print("hello")\nprint(3 + 4)',
		params: 'One or more values, separated by commas. Optional sep and end change spacing.',
		returns: 'None. It displays text; it does not give a value back to use later.'
	}),
	variable: Object.freeze({
		name: 'variable / =',
		summary: 'A name that holds a value. The = sign stores the right-hand side into that name.',
		usefulFor: 'Reusing numbers and text without typing them again, and building formulas step by step.',
		example: 'reading = 12.1\nlabel = "trial"\nprint(reading)',
		params: 'Left side: a name. Right side: any expression Python can evaluate.',
		returns: 'Assignment itself is not a value you print; the name then holds the stored value.'
	}),
	'==': Object.freeze({
		name: '==',
		summary: 'Compares two values and asks "are these equal?"',
		usefulFor: 'Checks in if/while conditions when you care about equality, not storing a value.',
		example: 'print(3 == 3)\nprint("lab" == "Lab")',
		params: 'Left and right expressions to compare.',
		returns: 'True or False.'
	}),
	int: Object.freeze({
		name: 'int',
		summary: 'A whole number with no decimal part, like 3 or -2.',
		usefulFor: 'Counts, indexes, and anything that should stay as a whole number.',
		example: 'n = 3\nprint(type(n))',
		params: 'int(x) can convert a value toward a whole number when conversion makes sense.',
		returns: 'An int value, or an int from int(...).'
	}),
	float: Object.freeze({
		name: 'float',
		summary: 'A number that can have a decimal part, like 12.1 or 0.2.',
		usefulFor: 'Measurements, averages, and science readings that are not whole.',
		example: 'reading = 12.1\nmax_value = float("20")',
		params: 'float(x) converts text or numbers into a float when possible.',
		returns: 'A float value.'
	}),
	str: Object.freeze({
		name: 'str',
		summary: 'Text data, written in quotes, like "lab" or \'ok\'.',
		usefulFor: 'Labels, messages, file names, and anything you read as words.',
		example: 'unit = "mm"\nprint(str(12.1))',
		params: 'str(x) turns many values into text.',
		returns: 'A string.'
	}),
	bool: Object.freeze({
		name: 'bool',
		summary: 'A yes/no value. In Python those two values are True and False.',
		usefulFor: 'Flags and conditions that steer if/while decisions.',
		example: 'ok = True\nprint(bool(0))\nprint(bool(1))',
		params: 'bool(x) asks whether x counts as true in a condition.',
		returns: 'True or False.'
	}),
	True: Object.freeze({
		name: 'True',
		summary: 'The boolean value for yes / on / condition passed.',
		usefulFor: 'Return values from checks, and clear flags in your own code.',
		example: 'ready = True\nif ready:\n    print("go")',
		returns: 'True is itself a bool value.'
	}),
	False: Object.freeze({
		name: 'False',
		summary: 'The boolean value for no / off / condition failed.',
		usefulFor: 'Marking failed checks and turning features off.',
		example: 'done = False\nprint(done)',
		returns: 'False is itself a bool value.'
	}),
	list: Object.freeze({
		name: 'list',
		summary: 'An ordered collection of values in square brackets, like [12.1, 11.8].',
		usefulFor: 'Keeping related measurements together so you can loop, index, and count them.',
		example: 'readings = [12.1, 11.8, 12.3]\nprint(readings[0])',
		params: 'Items inside the brackets, separated by commas.',
		returns: 'A list object you can store in a variable.'
	}),
	indexing: Object.freeze({
		name: 'indexing',
		summary: 'Picking one item from a list (or string) with [position]. The first item is index 0.',
		usefulFor: 'Reading the first, last, or nth measurement without looping.',
		example: 'readings = [12.1, 11.8, 12.3]\nprint(readings[0])\nprint(readings[-1])',
		params: 'An integer index. Negative indexes count from the end.',
		returns: 'The item at that position.'
	}),
	slice: Object.freeze({
		name: 'slice',
		summary: 'A piece of a list written as a[start:end]. The end index is exclusive.',
		usefulFor: 'Grabbing a small window of readings to inspect.',
		example: 'readings = [12.1, 11.8, 12.3, 12.0]\nprint(readings[0:2])',
		params: 'start and end indexes. Either can be omitted.',
		returns: 'A new list with the selected items.'
	}),
	len: Object.freeze({
		name: 'len',
		summary: 'Counts how many items are in a list (or characters in a string).',
		usefulFor: 'Averages, loops with range, and checking that a list is not empty.',
		example: 'readings = [12.1, 11.8]\nprint(len(readings))',
		params: 'A sequence such as a list or string.',
		returns: 'An int count.'
	}),
	for: Object.freeze({
		name: 'for',
		summary: 'A loop that walks through each item in a list (or other sequence) one by one.',
		usefulFor: 'Printing, filtering, or totaling every reading without copy-paste.',
		example: 'for reading in readings:\n    print(reading)',
		params: 'for name in sequence: then an indented body.',
		returns: 'A for loop does not return a value; it repeats the body.'
	}),
	range: Object.freeze({
		name: 'range',
		summary: 'Makes a sequence of integers, often used to walk indexes.',
		usefulFor: 'Pairing a trial number with readings[i].',
		example: 'for i in range(3):\n    print(i)\nfor i in range(len(readings)):\n    print(i, readings[i])',
		params: 'range(stop) or range(start, stop). stop is exclusive.',
		returns: 'A range object you usually loop over.'
	}),
	if: Object.freeze({
		name: 'if',
		summary: 'Runs a block of code only when a condition is True.',
		usefulFor: 'Accepting good readings and skipping impossible ones.',
		example: 'if reading >= 10:\n    print("ok")',
		params: 'A condition after if, then an indented body.',
		returns: 'Does not return a value; it chooses whether to run code.'
	}),
	elif: Object.freeze({
		name: 'elif',
		summary: 'Means "else if": another condition to try when the earlier if was False.',
		usefulFor: 'Several labeled paths without nesting many ifs.',
		example: 'if x < 0:\n    print("neg")\nelif x == 0:\n    print("zero")\nelse:\n    print("pos")',
		params: 'A condition, same style as if.',
		returns: 'Does not return a value.'
	}),
	else: Object.freeze({
		name: 'else',
		summary: 'The fallback block when the matching if/elif conditions were False.',
		usefulFor: 'The discard path when a reading is out of range.',
		example: 'if ok:\n    print("valid")\nelse:\n    print("discard")',
		returns: 'Does not return a value.'
	}),
	append: Object.freeze({
		name: 'append',
		summary: 'Adds one item to the end of a list, changing that list in place.',
		usefulFor: 'Building a filtered list of accepted readings as you loop.',
		example: 'valid = []\nvalid.append(12.1)\nprint(valid)',
		params: 'list.append(item) takes the value to add.',
		returns: 'None. The list itself grows.'
	}),
	sum: Object.freeze({
		name: 'sum',
		summary: 'Adds up all numbers in a list.',
		usefulFor: 'Totals before you compute an average.',
		example: 'print(sum([12.1, 11.9]))',
		params: 'A list (or similar) of numbers. Optional start value.',
		returns: 'The numeric total.'
	}),
	min: Object.freeze({
		name: 'min',
		summary: 'Finds the smallest value among its arguments or inside a list.',
		usefulFor: 'Quick checks on the lowest reading.',
		example: 'print(min(12.1, 11.8, 12.3))\nprint(min(readings))',
		params: 'Several values, or one sequence.',
		returns: 'The smallest value.'
	}),
	max: Object.freeze({
		name: 'max',
		summary: 'Finds the largest value among its arguments or inside a list.',
		usefulFor: 'Spotting spikes and setting thresholds.',
		example: 'print(max(12.1, 11.8, 12.3))\nprint(max(readings))',
		params: 'Several values, or one sequence.',
		returns: 'The largest value.'
	}),
	def: Object.freeze({
		name: 'def / function',
		summary: 'Defines a reusable block of code with a name, parameters, and an optional return.',
		usefulFor: 'Packaging checks and averages so the main program stays short.',
		example: 'def double(n):\n    return n * 2\n\nprint(double(5))',
		params: 'Names in the parentheses. Call the function with matching arguments.',
		returns: 'Whatever return sends back, or None if there is no return.'
	}),
	input: Object.freeze({
		name: 'input',
		summary: 'Reads a line of text from Program input (or the keyboard in a normal terminal).',
		usefulFor: 'Asking for a threshold or other value before you filter data.',
		example: 'name = input("Name: ")\nprint(name)',
		params: 'Optional prompt string shown to the user.',
		returns: 'Always a str, even if the person typed digits.'
	}),
	while: Object.freeze({
		name: 'while',
		summary: 'Repeats a block as long as a condition stays True.',
		usefulFor: 'Re-asking for input until the value looks usable.',
		example: 'n = -1\nwhile n <= 0:\n    n = float(input("n: "))',
		params: 'A condition after while, then an indented body.',
		returns: 'Does not return a value; it loops.'
	}),
	import: Object.freeze({
		name: 'import',
		summary: 'Loads a module so you can use its tools, like math.sqrt.',
		usefulFor: 'Bringing in standard library helpers instead of reinventing them.',
		example: 'import math\nprint(math.sqrt(9))\nfrom math import sqrt\nprint(sqrt(9))',
		params: 'A module name, or from module import name.',
		returns: 'Makes names available; import itself is not a printed value.'
	}),
	'math.sqrt': Object.freeze({
		name: 'math.sqrt',
		summary: 'Square root function from the math module.',
		usefulFor: 'Statistics formulas such as sample standard deviation.',
		example: 'import math\nprint(math.sqrt(9))',
		params: 'A non-negative number.',
		returns: 'A float square root.'
	}),
	dict: Object.freeze({
		name: 'dictionary',
		summary: 'A mapping of keys to values, written with braces, like {"average": 12.1}.',
		usefulFor: 'Storing named results so you look them up by meaning.',
		example: 'summary = {"average": 12.1, "count": 5}\nprint(summary["average"])\nsummary["unit"] = "mm"',
		params: 'Keys and values. Look up with summary[key].',
		returns: 'A dict object. summary[key] returns the stored value.'
	}),
	'f-string': Object.freeze({
		name: 'f-string',
		summary: 'A string with an f before the quotes so {expressions} insert live values.',
		usefulFor: 'Building reports from calculated numbers without messy concatenation.',
		example: 'average = 12.1\nreport = f"average={average}"\nprint(report)',
		params: 'Expressions inside { } inside the f-string.',
		returns: 'A regular str after the values are filled in.'
	}),
	open: Object.freeze({
		name: 'open / files',
		summary: 'Opens a file so you can read or write text. In this workshop the disk is virtual.',
		usefulFor: 'Saving a report to a .txt file you can download under Generated files.',
		example: 'with open("report.txt", "w") as file:\n    file.write("ok")',
		params: 'Path string, and a mode like "w" (write) or "r" (read).',
		returns: 'A file object. Often used in a with block.'
	})
});

/**
 * Alias text authors may put inside backticks, mapped to a glossary key.
 * Longer aliases must win when resolving marked content (math.sqrt before pieces).
 *
 * @typedef {{
 *   match: string,
 *   key: string,
 *   caseSensitive: boolean
 * }} GlossaryAlias
 */

/** @type {readonly GlossaryAlias[]} */
export const GLOSSARY_ALIASES = Object.freeze([
	Object.freeze({ match: 'math.sqrt', key: 'math.sqrt', caseSensitive: true }),
	Object.freeze({ match: 'dictionaries', key: 'dict', caseSensitive: false }),
	Object.freeze({ match: 'dictionary', key: 'dict', caseSensitive: false }),
	Object.freeze({ match: 'f-strings', key: 'f-string', caseSensitive: false }),
	Object.freeze({ match: 'f-string', key: 'f-string', caseSensitive: false }),
	Object.freeze({ match: 'variables', key: 'variable', caseSensitive: false }),
	Object.freeze({ match: 'variable', key: 'variable', caseSensitive: false }),
	Object.freeze({ match: 'functions', key: 'def', caseSensitive: false }),
	Object.freeze({ match: 'function', key: 'def', caseSensitive: false }),
	Object.freeze({ match: 'indexing', key: 'indexing', caseSensitive: false }),
	Object.freeze({ match: 'indexes', key: 'indexing', caseSensitive: false }),
	Object.freeze({ match: 'index', key: 'indexing', caseSensitive: false }),
	Object.freeze({ match: 'slicing', key: 'slice', caseSensitive: false }),
	Object.freeze({ match: 'slice', key: 'slice', caseSensitive: false }),
	Object.freeze({ match: 'lists', key: 'list', caseSensitive: false }),
	Object.freeze({ match: 'list', key: 'list', caseSensitive: false }),
	Object.freeze({ match: 'files', key: 'open', caseSensitive: false }),
	Object.freeze({ match: 'file', key: 'open', caseSensitive: false }),
	Object.freeze({ match: 'float()', key: 'float', caseSensitive: true }),
	Object.freeze({ match: 'input()', key: 'input', caseSensitive: true }),
	Object.freeze({ match: 'len()', key: 'len', caseSensitive: true }),
	Object.freeze({ match: 'sum()', key: 'sum', caseSensitive: true }),
	Object.freeze({ match: 'min()', key: 'min', caseSensitive: true }),
	Object.freeze({ match: 'max()', key: 'max', caseSensitive: true }),
	Object.freeze({ match: 'append', key: 'append', caseSensitive: true }),
	Object.freeze({ match: 'import', key: 'import', caseSensitive: true }),
	Object.freeze({ match: 'print', key: 'print', caseSensitive: true }),
	Object.freeze({ match: 'input', key: 'input', caseSensitive: true }),
	Object.freeze({ match: 'float', key: 'float', caseSensitive: true }),
	Object.freeze({ match: 'while', key: 'while', caseSensitive: true }),
	Object.freeze({ match: 'False', key: 'False', caseSensitive: true }),
	Object.freeze({ match: 'True', key: 'True', caseSensitive: true }),
	Object.freeze({ match: 'elif', key: 'elif', caseSensitive: true }),
	Object.freeze({ match: 'else', key: 'else', caseSensitive: true }),
	Object.freeze({ match: 'bool', key: 'bool', caseSensitive: true }),
	Object.freeze({ match: 'dict', key: 'dict', caseSensitive: true }),
	Object.freeze({ match: 'open', key: 'open', caseSensitive: true }),
	Object.freeze({ match: 'range', key: 'range', caseSensitive: true }),
	Object.freeze({ match: 'len', key: 'len', caseSensitive: true }),
	Object.freeze({ match: 'sum', key: 'sum', caseSensitive: true }),
	Object.freeze({ match: 'min', key: 'min', caseSensitive: true }),
	Object.freeze({ match: 'max', key: 'max', caseSensitive: true }),
	Object.freeze({ match: 'def', key: 'def', caseSensitive: true }),
	Object.freeze({ match: 'for', key: 'for', caseSensitive: true }),
	Object.freeze({ match: 'str', key: 'str', caseSensitive: true }),
	Object.freeze({ match: 'int', key: 'int', caseSensitive: true }),
	Object.freeze({ match: 'if', key: 'if', caseSensitive: true }),
	Object.freeze({ match: '==', key: '==', caseSensitive: true }),
	Object.freeze({ match: '=', key: 'variable', caseSensitive: true })
]);

/** @type {readonly GlossaryAlias[]} */
const SORTED_ALIASES = Object.freeze(
	[...GLOSSARY_ALIASES].sort((a, b) => b.match.length - a.match.length || a.match.localeCompare(b.match))
);

/**
 * Resolve backtick inner text to a glossary alias (longest match wins).
 * The whole inner string must equal the alias (no bare-prose scanning).
 *
 * @param {string} inner
 * @returns {GlossaryAlias | null}
 */
export function resolveGlossaryMark(inner) {
	const text = typeof inner === 'string' ? inner.trim() : '';
	if (!text) return null;
	for (const alias of SORTED_ALIASES) {
		const ok = alias.caseSensitive
			? text === alias.match
			: text.toLowerCase() === alias.match.toLowerCase();
		if (ok) return alias;
	}
	return null;
}

/**
 * @typedef {{ type: 'text', value: string } | { type: 'term', value: string, key: string, entry: GlossaryEntry }} LessonSegment
 */

/**
 * Split lesson prose into plain text and glossary term segments.
 * Only explicit `backtick` marks become chips. Bare keywords in prose never link.
 * Pass oncePerTerm: true to link only the first marked hit per key.
 *
 * @param {string} text
 * @param {{ oncePerTerm?: boolean }} [options]
 * @returns {LessonSegment[]}
 */
export function tokenizeLessonText(text, options = {}) {
	const source = typeof text === 'string' ? text : '';
	if (source.length === 0) return [];

	const oncePerTerm = options.oncePerTerm === true;
	/** @type {Set<string>} */
	const used = new Set();
	/** @type {LessonSegment[]} */
	const segments = [];
	let cursor = 0;

	while (cursor < source.length) {
		const open = source.indexOf('`', cursor);
		if (open === -1) {
			segments.push({ type: 'text', value: source.slice(cursor) });
			break;
		}

		if (open > cursor) {
			segments.push({ type: 'text', value: source.slice(cursor, open) });
		}

		const close = source.indexOf('`', open + 1);
		if (close === -1) {
			// Unclosed backtick: treat the rest as plain text.
			segments.push({ type: 'text', value: source.slice(open) });
			break;
		}

		const inner = source.slice(open + 1, close);
		const alias = resolveGlossaryMark(inner);
		if (alias && !(oncePerTerm && used.has(alias.key))) {
			const entry = PYTHON_GLOSSARY[alias.key];
			segments.push({ type: 'term', value: inner, key: alias.key, entry });
			used.add(alias.key);
		} else if (alias && oncePerTerm && used.has(alias.key)) {
			// Already linked this key; show the marked text without a chip.
			segments.push({ type: 'text', value: inner });
		} else {
			// Unknown mark: keep backticks so authors notice a typo.
			segments.push({ type: 'text', value: source.slice(open, close + 1) });
		}

		cursor = close + 1;
	}

	return segments;
}

/** @returns {string[]} */
export function glossaryKeys() {
	return Object.keys(PYTHON_GLOSSARY);
}
