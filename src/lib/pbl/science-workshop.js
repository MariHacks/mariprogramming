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
		body: 'Run the starter. Change the message. Run it again.',
		starter: SCIENCE_STARTER_SOURCE,
		hints: Object.freeze([
			'The program should print a different sentence than the one it started with.',
			'Edit the text inside the quotes, then use the Run button.',
			'print("something you wrote")'
		])
	}),
	Object.freeze({
		id: 1,
		title: 'Values, variables, types, expressions',
		minutes: 6,
		body: 'A reading is 12.1 with uncertainty 0.2. Create lower_bound and upper_bound using those two values, then print both.',
		notes: Object.freeze([
			'int 3, float 3.14, str "lab", bool True',
			'= assigns. == compares.'
		]),
		hints: Object.freeze([
			'The lower bound is the reading minus the uncertainty.',
			'lower_bound = reading - uncertainty',
			'reading = 12.1\nuncertainty = 0.2\nlower_bound = reading - uncertainty'
		])
	}),
	Object.freeze({
		id: 2,
		title: 'Collections, indexing, len()',
		minutes: 7,
		body: `Replace the single reading with readings = ${READINGS_LITERAL}. Print the first value, the last value, and how many readings there are. Use one slice so you can see that the end index is exclusive.`,
		hints: Object.freeze([
			'The first item is index 0. The last item is index -1. len() counts items.',
			'readings[0], readings[-1], len(readings)',
			'print(readings[0])\nprint(readings[-1])\nprint(len(readings))\nprint(readings[0:2])'
		])
	}),
	Object.freeze({
		id: 3,
		title: 'For loops and range()',
		minutes: 8,
		body: 'Print every reading with a for loop. Then print them again with a trial number using range(len(readings)).',
		hints: Object.freeze([
			'A for loop can walk the list directly, or walk indexes from range(len(readings)).',
			'for reading in readings:\n    print(reading)',
			'for i in range(len(readings)):\n    print(i + 1, readings[i])'
		])
	}),
	Object.freeze({
		id: 4,
		title: 'Conditionals and booleans',
		minutes: 8,
		body: 'Valid readings are from 10 to 20. Beside each reading, print valid or discard. 48.7 is a bad point on purpose.',
		notes: Object.freeze(['elif and not are available if you want them. You do not have to use them.']),
		hints: Object.freeze([
			'Ask whether the reading sits inside the valid range, then print a label next to it.',
			'if 10 <= reading <= 20:',
			'if 10 <= reading <= 20:\n    print(reading, "valid")\nelse:\n    print(reading, "discard")'
		])
	}),
	Object.freeze({
		id: 5,
		title: 'Algorithms and mutable lists',
		minutes: 10,
		body: 'Make valid_readings = [] and append accepted values. Total and average them with a loop. After that works, you may use sum(), min(), and max() as shortcuts.',
		hints: Object.freeze([
			'Keep a new list of only the accepted readings, then divide the total by how many you kept.',
			'valid_readings.append(reading)',
			'total = 0\nfor value in valid_readings:\n    total = total + value\naverage = total / len(valid_readings)'
		])
	}),
	Object.freeze({
		id: 6,
		title: 'Functions',
		minutes: 10,
		body: 'Write is_valid(reading, max_value) and a function that takes a list and returns the average. The main program should call them and still print the filtered average.',
		hints: Object.freeze([
			'Put the range test and the average loop in functions, then call those functions from the main program.',
			'def is_valid(reading, max_value):',
			'def is_valid(reading, max_value):\n    return 10 <= reading <= max_value\n\ndef average(values):\n    total = 0\n    for value in values:\n        total = total + value\n    return total / len(values)'
		])
	}),
	Object.freeze({
		id: 7,
		title: 'input(), type conversion, while',
		minutes: 8,
		body: 'Ask for a maximum accepted value. input() returns a string, so use float(). Keep asking with a while loop while the threshold is not positive. Put each input answer on its own line in Program input before you run.',
		hints: Object.freeze([
			'Read the threshold as text, convert it to a number, and repeat if that number is not greater than zero.',
			'value = float(input("Maximum accepted value: "))',
			'max_value = float(input("Maximum accepted value: "))\nwhile max_value <= 0:\n    max_value = float(input("Maximum accepted value: "))'
		])
	}),
	Object.freeze({
		id: 8,
		title: 'Imports',
		minutes: 6,
		body: 'import math and use math.sqrt to print a standard deviation of the valid readings. import math brings the module. from math import sqrt brings one name. The formula is in the starter comment so the math is not the lesson.',
		notes: Object.freeze([
			'sample standard deviation: sqrt(sum((x - average) ** 2 for x in values) / (len(values) - 1))'
		]),
		hints: Object.freeze([
			'Import the math module, then pass the variance into math.sqrt.',
			'import math',
			'import math\nstandard_deviation = math.sqrt(sum((x - average) ** 2 for x in valid_readings) / (len(valid_readings) - 1))'
		])
	}),
	Object.freeze({
		id: 9,
		title: 'Dictionaries and methods',
		minutes: 8,
		body: 'Build a summary dict with valid_count, average, and standard_deviation. Read one value by key. Add one new key.',
		hints: Object.freeze([
			'A dictionary stores named results. Look one up with square brackets, then assign a new key.',
			'summary = {"valid_count": len(valid_readings), "average": average}',
			'print(summary["average"])\nsummary["unit"] = "mm"'
		])
	}),
	Object.freeze({
		id: 10,
		title: 'Formatting and files',
		minutes: 5,
		body: 'Print an f-string report of the calculated results, then write that report to a text file. The browser runtime uses a virtual disk; the file contents will show under Generated files.',
		hints: Object.freeze([
			'Build the report from the numbers you already calculated, then open a file and write the same text.',
			'report = f"average={average}"',
			'with open("report.txt", "w") as file:\n    file.write(report)'
		])
	}),
	Object.freeze({
		id: 11,
		title: 'Final boss',
		minutes: 10,
		body: `No recipe this time. Fresh data: readings = ${FINAL_READINGS_LITERAL}. Ask for a maximum valid reading, keep the accepted values, average them, store the results in a dictionary, and print a short report. Reuse functions where it makes sense.`,
		stretch:
			'Optional: plot the readings and mark the discarded outlier if matplotlib loads. Nested lists, reading values from a file, or repeating the analysis are also stretch.',
		hints: Object.freeze([
			'Reuse the same analyzer on new data: ask for the cutoff, filter, average, store, report.',
			'max_value = float(input("Maximum valid reading: "))',
			'accepted = [reading for reading in readings if is_valid(reading, max_value)]\nsummary = {"average": average(accepted)}'
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
