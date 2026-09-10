export const SCIENCE_READINGS = Object.freeze([12.1, 11.8, 12.3, 48.7, 12.0, 11.9]);
export const SCIENCE_FINAL_READINGS = Object.freeze([12.4, 12.6, 26.1, 12.5, 12.8, 12.3]);
export const SCIENCE_VALID_MIN = 10;
export const SCIENCE_VALID_MAX = 20;
export const SCIENCE_STARTER_SOURCE = 'print("Experiment loaded")\n';

const READINGS_LITERAL = '[12.1, 11.8, 12.3, 48.7, 12.0, 11.9]';
const FINAL_READINGS_LITERAL = '[12.4, 12.6, 26.1, 12.5, 12.8, 12.3]';

/**
 * @typedef {{
 *   id: number,
 *   title: string,
 *   minutes: number,
 *   body: string,
 *   starter?: string,
 *   notes?: string[],
 *   hints: [string, string, string],
 *   stretch?: string
 * }} ScienceStep
 */

/** @type {readonly ScienceStep[]} */
export const SCIENCE_STEPS = Object.freeze([
	Object.freeze({
		id: 0,
		title: 'Get something running',
		minutes: 4,
		body: 'Press Run once so you see the starter print. Then edit the text inside the quotes to any other sentence and Run again. To pass, the program must print something other than the original "Experiment loaded" line. This step only proves the shared editor and Run button work for your team.',
		starter: SCIENCE_STARTER_SOURCE,
		hints: Object.freeze([
			'Change the quoted sentence, then Run. Leaving the starter text fails the check.',
			'Edit the string inside print("..."), then press Run.',
			'print("Lab table 3 is live")'
		])
	}),
	Object.freeze({
		id: 1,
		title: 'Values, variables, types, expressions',
		minutes: 6,
		body: 'A lab reading is 12.1 with uncertainty 0.2. Store those two numbers in variables (for example reading and uncertainty), compute a lower bound (reading minus uncertainty) and an upper bound (reading plus uncertainty), and print both bounds. Why store them first: you will reuse the values, and the checker looks for stored numbers plus printed bounds, not bare print(11.9) with no variables. To pass: keep 12.1 and 0.2 in variables, and print bounds near 11.9 and 12.3. Your own variable names are fine.',
		notes: Object.freeze([
			'Types you will meet: int 3, float 3.14, str "lab", bool True',
			'= assigns a value. == compares two values.'
		]),
		hints: Object.freeze([
			'Put 12.1 and 0.2 in variables, compute both bounds from those variables, then print the bounds. Printing 11.9 and 12.3 alone is not enough.',
			'lower = reading - uncertainty\nupper = reading + uncertainty\nprint(lower)\nprint(upper)',
			'reading = 12.1\nuncertainty = 0.2\nlower_bound = reading - uncertainty\nupper_bound = reading + uncertainty\nprint(lower_bound)\nprint(upper_bound)'
		])
	}),
	Object.freeze({
		id: 2,
		title: 'Collections, indexing, len()',
		minutes: 7,
		body: `Replace the single reading with a list of the six lab values, for example readings = ${READINGS_LITERAL}. Print the first value, the last value, and how many items are in the list. Also print one slice (for example readings[0:2]) so you can see that the end index is exclusive. To pass: a six-item list starting at 12.1 and ending at 11.9, plus output that shows 12.1, 11.9, and 6.`,
		hints: Object.freeze([
			'Index 0 is the first item, -1 is the last, and len(...) counts how many there are.',
			'print(readings[0])\nprint(readings[-1])\nprint(len(readings))',
			'readings = [12.1, 11.8, 12.3, 48.7, 12.0, 11.9]\nprint(readings[0])\nprint(readings[-1])\nprint(len(readings))\nprint(readings[0:2])'
		])
	}),
	Object.freeze({
		id: 3,
		title: 'For loops and range()',
		minutes: 8,
		body: 'Print every value in your readings list with a for loop that walks the list directly. Then print them again with a trial number using range(len(...)), so each line shows a 1-based trial index and the reading. To pass: every number from the list must appear in the output at least once. Loops matter here because the list will keep growing and you should not copy-paste print lines.',
		hints: Object.freeze([
			'One loop can walk the values. A second loop can walk indexes from range(len(readings)).',
			'for reading in readings:\n    print(reading)',
			'for reading in readings:\n    print(reading)\nfor i in range(len(readings)):\n    print(i + 1, readings[i])'
		])
	}),
	Object.freeze({
		id: 4,
		title: 'Conditionals and booleans',
		minutes: 8,
		body: 'Valid readings sit between 10 and 20 inclusive. For each value in the list, print the number and the word valid or discard beside it. 48.7 is a bad point on purpose so you can practice the reject path. To pass: both words appear in the output, 48.7 is on a line that says discard, and normal points such as 12.1 still show as valid.',
		notes: Object.freeze(['elif and not are available if you want them. You do not have to use them.']),
		hints: Object.freeze([
			'Ask whether each reading sits inside 10 to 20, then print a label next to it.',
			'if 10 <= reading <= 20:\n    print(reading, "valid")\nelse:\n    print(reading, "discard")',
			'for reading in readings:\n    if 10 <= reading <= 20:\n        print(reading, "valid")\n    else:\n        print(reading, "discard")'
		])
	}),
	Object.freeze({
		id: 5,
		title: 'Algorithms and mutable lists',
		minutes: 10,
		body: 'Make an empty list (for example valid_readings = []). Loop the readings, and append only the accepted ones (still 10 to 20). Then total and average that new list with a loop before you reach for shortcuts. After the loop version works, sum(), min(), and max() are fine. To pass: keep the five normal points (no 48.7) and an average near 12.02.',
		hints: Object.freeze([
			'Keep a fresh list of accepted readings, then divide their total by how many you kept.',
			'valid_readings.append(reading)',
			'valid_readings = []\nfor reading in readings:\n    if 10 <= reading <= 20:\n        valid_readings.append(reading)\ntotal = 0\nfor value in valid_readings:\n    total = total + value\naverage = total / len(valid_readings)\nprint(average)'
		])
	}),
	Object.freeze({
		id: 6,
		title: 'Functions',
		minutes: 10,
		body: 'Move the range test into a function (for example is_valid(reading, max_value)) and move the average loop into a function that takes a list and returns a number (average, mean, or avg is fine). The main program should call those functions and still print the filtered average. To pass: both functions exist, the range test accepts 12.1 and rejects 48.7 when max_value is 20, and the average still ignores the outlier.',
		hints: Object.freeze([
			'Put the range test and the average loop in functions, then call them from the main program.',
			'def is_valid(reading, max_value):\n    return 10 <= reading <= max_value',
			'def is_valid(reading, max_value):\n    return 10 <= reading <= max_value\n\ndef average(values):\n    total = 0\n    for value in values:\n        total = total + value\n    return total / len(values)\n\nvalid_readings = [r for r in readings if is_valid(r, 20)]\nprint(average(valid_readings))'
		])
	}),
	Object.freeze({
		id: 7,
		title: 'input(), type conversion, while',
		minutes: 8,
		body: 'Ask for a maximum accepted value with input(). input() always returns a string, so convert with float(). Keep asking in a while loop while that number is not greater than zero. Put each answer on its own line in Program input before you Run (the checker tries 20, then 5, then a bad -1 followed by 20). To pass: at least one input() call, a filter that changes when the threshold changes, and a second prompt when the first value is not positive.',
		hints: Object.freeze([
			'Read the threshold as text, convert it to a float, and ask again if it is not greater than zero.',
			'max_value = float(input("Maximum accepted value: "))\nwhile max_value <= 0:\n    max_value = float(input("Maximum accepted value: "))',
			'max_value = float(input("Maximum accepted value: "))\nwhile max_value <= 0:\n    max_value = float(input("Maximum accepted value: "))\nvalid_readings = [r for r in readings if 10 <= r <= max_value]\nprint(sum(valid_readings) / len(valid_readings))'
		])
	}),
	Object.freeze({
		id: 8,
		title: 'Imports',
		minutes: 6,
		body: 'Import math and use math.sqrt to print a sample standard deviation of the valid readings only. import math brings the whole module; from math import sqrt brings one name. The formula sits in the notes so the math is not the lesson. To pass: a non-negative spread that stays small (under 2). Including 48.7 would blow the value up.',
		notes: Object.freeze([
			'sample standard deviation: sqrt(sum((x - average) ** 2 for x in values) / (len(values) - 1))'
		]),
		hints: Object.freeze([
			'Import math, compute the variance on the accepted readings, then pass it to math.sqrt.',
			'import math\nstandard_deviation = math.sqrt(...)',
			'import math\naverage = sum(valid_readings) / len(valid_readings)\nstandard_deviation = math.sqrt(sum((x - average) ** 2 for x in valid_readings) / (len(valid_readings) - 1))\nprint(standard_deviation)'
		])
	}),
	Object.freeze({
		id: 9,
		title: 'Dictionaries and methods',
		minutes: 8,
		body: 'Build a dictionary (for example summary) with keys valid_count, average, and standard_deviation holding your calculated results. Print one value by key (for example summary["average"]). Then add one new key of your choice, such as unit. To pass: valid_count near 5, average near the filtered mean, a non-negative standard_deviation, a printed lookup by key, and at least four keys total.',
		hints: Object.freeze([
			'A dictionary stores named results. Look one up with square brackets, then assign a new key.',
			'summary = {"valid_count": len(valid_readings), "average": average, "standard_deviation": standard_deviation}',
			'print(summary["average"])\nsummary["unit"] = "mm"'
		])
	}),
	Object.freeze({
		id: 10,
		title: 'Formatting and files',
		minutes: 5,
		body: 'Build an f-string report from the numbers you already calculated (average, counts, spread). Print that report, then write the same text to a .txt file with open(..., "w"). The browser runtime uses a virtual disk; file contents show under Generated files. To pass: a .txt file whose contents include calculated results such as the filtered average, not a hard-coded filler sentence.',
		hints: Object.freeze([
			'Build the report from calculated numbers, print it, then open a file and write the same text.',
			'report = f"average={average} valid_count={len(valid_readings)}"\nprint(report)',
			'report = f"average={average} valid_count={len(valid_readings)}"\nprint(report)\nwith open("report.txt", "w") as file:\n    file.write(report)'
		])
	}),
	Object.freeze({
		id: 11,
		title: 'Final boss',
		minutes: 10,
		body: `No recipe this time. Fresh data, for example readings = ${FINAL_READINGS_LITERAL}. Ask for a maximum valid reading, keep the accepted values, average them, store the results in a dictionary (for example summary), and print a short report. Reuse functions where it helps. To pass: an input() prompt, 26.1 discarded when the max is 20, an average near 12.52, a results dictionary, and printed output.`,
		stretch:
			'Optional stretch: plot the readings and mark the discarded outlier if matplotlib loads. Nested lists, reading values from a file, or repeating the analysis on another list are also fair stretch work.',
		hints: Object.freeze([
			'Reuse the same analyzer on new data: ask for the cutoff, filter, average, store results, report.',
			'max_value = float(input("Maximum valid reading: "))',
			'readings = [12.4, 12.6, 26.1, 12.5, 12.8, 12.3]\nmax_value = float(input("Maximum valid reading: "))\naccepted = [reading for reading in readings if is_valid(reading, max_value)]\nsummary = {"average": average(accepted), "valid_count": len(accepted)}\nprint(summary)'
		])
	})
]);

export const SCIENCE_STEP_COUNT = SCIENCE_STEPS.length;

/** @param {unknown} stepId */
export function getScienceStep(stepId) {
	if (!Number.isInteger(stepId) || stepId < 0 || stepId >= SCIENCE_STEPS.length) return null;
	return SCIENCE_STEPS[stepId];
}

export function scienceValidReadings(
	readings = SCIENCE_READINGS,
	maxValue = SCIENCE_VALID_MAX,
	minValue = SCIENCE_VALID_MIN
) {
	return readings.filter((reading) => reading >= minValue && reading <= maxValue);
}

export function scienceAverage(values) {
	if (values.length === 0) return null;
	return values.reduce((total, value) => total + value, 0) / values.length;
}
