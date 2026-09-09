import {
	SCIENCE_FINAL_READINGS,
	SCIENCE_READINGS,
	SCIENCE_STARTER_SOURCE,
	scienceAverage,
	scienceValidReadings
} from './science-workshop.js';

const STARTER_MESSAGE = 'Experiment loaded';
const VALID_AVERAGE = scienceAverage(scienceValidReadings());
const FINAL_AVERAGE = scienceAverage(scienceValidReadings(SCIENCE_FINAL_READINGS));

/**
 * @typedef {{
 *   stdout?: string,
 *   stderr?: string,
 *   error?: string | null,
 *   globals?: Record<string, unknown>,
 *   files?: Record<string, string>,
 *   inputCount?: number
 * }} PythonRunResult
 *
 * @typedef {{ passed: boolean, message: string }} CheckResult
 */

/** @param {unknown} value */
export function asFiniteNumber(value) {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}

/** @param {unknown} actual @param {number} expected @param {number} [epsilon] */
export function closeTo(actual, expected, epsilon = 0.05) {
	const value = asFiniteNumber(actual);
	return value !== null && Math.abs(value - expected) <= epsilon;
}

/** @param {PythonRunResult | undefined} trial */
function crashed(trial) {
	return Boolean(trial?.error);
}

/** @param {PythonRunResult | undefined} trial */
function stdoutOf(trial) {
	return trial && typeof trial.stdout === 'string' ? trial.stdout : '';
}

/** @param {PythonRunResult | undefined} trial */
function text(trial) {
	const stderr = trial && typeof trial.stderr === 'string' ? trial.stderr : '';
	return `${stdoutOf(trial)}\n${stderr}`;
}

/** @param {PythonRunResult | undefined} trial */
function globalsOf(trial) {
	return trial && trial.globals && typeof trial.globals === 'object' ? trial.globals : {};
}

/** @param {PythonRunResult | undefined} trial */
function inputCountOf(trial) {
	return trial && typeof trial.inputCount === 'number' ? trial.inputCount : 0;
}

/** @param {string} haystack @param {string} needle */
function mentions(haystack, needle) {
	return haystack.toLowerCase().includes(String(needle).toLowerCase());
}

/** @param {unknown} value */
function isFunctionMarker(value) {
	return Boolean(
		value &&
			typeof value === 'object' &&
			!Array.isArray(value) &&
			/** @type {{ kind?: unknown }} */ (value).kind === 'function'
	);
}

/** @param {Record<string, unknown> | undefined} globals */
function firstNumber(...values) {
	for (const value of values) {
		const number = asFiniteNumber(value);
		if (number !== null) return number;
	}
	return null;
}

function averageValue(globals = {}) {
	return firstNumber(globals.average, globals.avg, globals.mean);
}

/** @param {CheckResult} result */
function fail(message) {
	return { passed: false, message };
}

/** @param {CheckResult['message']} message */
function pass(message) {
	return { passed: true, message };
}

/** @param {PythonRunResult[]} trials */
function gradeStep0(trials) {
	const trial = trials[0];
	if (!trial || crashed(trial)) return fail('Run the program. A crash does not count.');
	const output = stdoutOf(trial).trim();
	if (!output) return fail('Print a message.');
	if (output === STARTER_MESSAGE) return fail('Change the message, then run again.');
	return pass('The program printed your message.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep1(trials) {
	const original = trials[0];
	const overridden = trials[1];
	if (!original || crashed(original)) return fail('Create lower_bound and upper_bound, then run.');
	const lower = asFiniteNumber(original.globals?.lower_bound);
	const upper = asFiniteNumber(original.globals?.upper_bound);
	if (lower === null || upper === null) {
		return fail('Assign lower_bound and upper_bound, then print them.');
	}
	if (!closeTo(lower, 11.9) || !closeTo(upper, 12.3)) {
		return fail('The bounds should come from reading 12.1 and uncertainty 0.2.');
	}
	if (!overridden || crashed(overridden)) {
		return fail('Use reading and uncertainty in the bound formulas, not the finished numbers.');
	}
	if (
		!closeTo(overridden.globals?.lower_bound, 19) ||
		!closeTo(overridden.globals?.upper_bound, 21)
	) {
		return fail('Use reading and uncertainty in the bound formulas, not the finished numbers.');
	}
	return pass('The bounds follow reading and uncertainty.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep2(trials) {
	const trial = trials[0];
	if (!trial || crashed(trial)) return fail('Print the first reading, the last reading, and the count.');
	const readings = trial.globals?.readings;
	if (!Array.isArray(readings) || readings.length !== SCIENCE_READINGS.length) {
		return fail('Store the six readings in a list named readings.');
	}
	const first = asFiniteNumber(readings[0]);
	const last = asFiniteNumber(readings[readings.length - 1]);
	const output = text(trial);
	if (!closeTo(first, 12.1) || !closeTo(last, 11.9)) {
		return fail('The first reading is 12.1 and the last reading is 11.9.');
	}
	if (!mentions(output, '12.1') || !mentions(output, '11.9') || !mentions(output, '6')) {
		return fail('Print the first value, the last value, and len(readings).');
	}
	return pass('First, last, and length are correct.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep3(trials) {
	const trial = trials[0];
	if (!trial || crashed(trial)) return fail('Print every reading with a loop.');
	const output = stdoutOf(trial);
	for (const reading of SCIENCE_READINGS) {
		const matches = output.match(new RegExp(String(reading).replace('.', '\\.'), 'gu')) || [];
		if (matches.length < 1) return fail(`Print every reading. ${reading} never appeared.`);
	}
	return pass('Every reading printed at least once.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep4(trials) {
	const trial = trials[0];
	if (!trial || crashed(trial)) return fail('Label each reading valid or discard.');
	const output = stdoutOf(trial).toLowerCase();
	if (!output.includes('discard') || !output.includes('valid')) {
		return fail('Print valid or discard beside each reading.');
	}
	const outlierLine = output
		.split('\n')
		.find((line) => line.includes('48.7'));
	if (!outlierLine || !outlierLine.includes('discard')) {
		return fail('48.7 should be discarded.');
	}
	if (!output.includes('12.1')) {
		return fail('The normal readings should stay valid.');
	}
	return pass('48.7 is discarded and the normal readings stay.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep5(trials) {
	const trial = trials[0];
	if (!trial || crashed(trial)) return fail('Build valid_readings and print the average.');
	const kept = trial.globals?.valid_readings;
	if (!Array.isArray(kept) || kept.some((value) => closeTo(value, 48.7))) {
		return fail('Append only accepted readings. 48.7 should not be in valid_readings.');
	}
	if (kept.length !== 5) return fail('valid_readings should keep the five normal points.');
	const average = firstNumber(averageValue(globalsOf(trial)), extractPrintedAverage(stdoutOf(trial)));
	if (!closeTo(average, VALID_AVERAGE, 0.08)) {
		return fail('The average should ignore 48.7.');
	}
	return pass('The average ignores the outlier.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep6(trials) {
	const trial = trials[0];
	if (!trial || crashed(trial)) return fail('Define the functions and call them from the main program.');
	const globals = globalsOf(trial);
	if (!isFunctionMarker(globals.is_valid)) {
		return fail('Define is_valid(reading, max_value) and call it.');
	}
	const averageFn = ['average', 'mean', 'compute_average', 'avg'].some((name) =>
		isFunctionMarker(globals[name])
	);
	if (!averageFn) return fail('Define an average function that takes a list and returns a number.');
	if (globals.is_valid_ok !== true || globals.is_valid_outlier !== false) {
		return fail('is_valid should accept 12.1 and reject 48.7 when max_value is 20.');
	}
	if (!closeTo(globals.probed_average, VALID_AVERAGE, 0.08)) {
		return fail('The average function should still ignore 48.7.');
	}
	return pass('The main program calls the functions and still filters.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep7(trials) {
	const wide = trials[0];
	const tight = trials[1];
	const retry = trials[2];
	if (!wide || crashed(wide) || !tight || crashed(tight)) {
		return fail('Ask for a maximum accepted value and use it to filter.');
	}
	if (inputCountOf(wide) < 1) return fail('Call input() to read the threshold.');
	const wideAverage = firstNumber(averageValue(globalsOf(wide)), extractPrintedAverage(stdoutOf(wide)));
	const tightAverage = firstNumber(
		averageValue(globalsOf(tight)),
		extractPrintedAverage(stdoutOf(tight))
	);
	if (!closeTo(wideAverage, VALID_AVERAGE, 0.08)) {
		return fail('With a threshold of 20, keep the normal readings and drop 48.7.');
	}
	if (tightAverage === null || closeTo(tightAverage, wideAverage, 0.01)) {
		return fail('A smaller threshold should change which readings are accepted.');
	}
	if (!retry || crashed(retry) || inputCountOf(retry) < 2) {
		return fail('A non-positive threshold should ask again.');
	}
	return pass('The threshold changes the filter, and non-positive input asks again.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep8(trials) {
	const trial = trials[0];
	if (!trial || crashed(trial)) return fail('Import math and print a standard deviation.');
	const g = globalsOf(trial);
	const stdev = firstNumber(g.standard_deviation, g.stdev, g.std, extractPrintedAverage(stdoutOf(trial)));
	if (stdev === null || stdev < 0) return fail('Print a non-negative standard deviation.');
	if (stdev === 0 || stdev >= 2) {
		return fail('Use the valid readings only. 48.7 would make the spread much larger.');
	}
	return pass('The standard deviation is non-negative and ignores the outlier.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep9(trials) {
	const trial = trials[0];
	if (!trial || crashed(trial)) return fail('Build a summary dictionary and read it by key.');
	const summary = trial.globals?.summary;
	if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
		return fail('Create a summary dict with valid_count, average, and standard_deviation.');
	}
	const record = /** @type {Record<string, unknown>} */ (summary);
	if (!closeTo(record.valid_count, 5, 0.1)) {
		return fail('summary["valid_count"] should be the number of accepted readings.');
	}
	if (!closeTo(record.average, VALID_AVERAGE, 0.08)) {
		return fail('summary["average"] should hold the filtered average.');
	}
	const stdev = asFiniteNumber(record.standard_deviation);
	if (stdev === null || stdev < 0) {
		return fail('summary["standard_deviation"] should hold the calculated spread.');
	}
	const printed = trial.stdout || '';
	if (!printed.includes('summary[') && !mentions(printed, String(record.average))) {
		return fail('Read one value from the dictionary by key and print it.');
	}
	if (Object.keys(record).length < 4) {
		return fail('Add one new key to summary.');
	}
	return pass('summary holds calculated values and can be read by key.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep10(trials) {
	const trial = trials[0];
	if (!trial || crashed(trial)) return fail('Print a report and write it to a text file.');
	const report = Object.entries(trial.files || {})
		.filter(([name]) => name.endsWith('.txt'))
		.map(([, contents]) => contents)
		.join('\n');
	const combined = `${trial.stdout || ''}\n${report}`;
	if (!report) return fail('Write the report to a text file.');
	if (
		!closeTo(extractPrintedAverage(combined), VALID_AVERAGE, 0.15) &&
		!mentions(combined, '12.0') &&
		!mentions(combined, 'average')
	) {
		return fail('The report should contain calculated results, not hard-coded filler.');
	}
	return pass('The report contains calculated results.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep11(trials) {
	const trial = trials[0];
	if (!trial || crashed(trial)) {
		return fail('Ask for a maximum, filter the new readings, average them, and print a report.');
	}
	if (inputCountOf(trial) < 1) return fail('Ask for a maximum valid reading.');
	const kept =
		trial.globals?.valid_readings || trial.globals?.accepted || trial.globals?.filtered;
	if (Array.isArray(kept) && kept.some((value) => closeTo(value, 26.1))) {
		return fail('26.1 should be discarded for a maximum of 20.');
	}
	const average = firstNumber(averageValue(globalsOf(trial)), extractPrintedAverage(stdoutOf(trial)));
	if (!closeTo(average, FINAL_AVERAGE, 0.08)) {
		return fail('Average only the accepted values from the new readings.');
	}
	const summary = trial.globals?.summary;
	if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
		return fail('Store the results in a dictionary.');
	}
	if (!stdoutOf(trial).trim()) return fail('Print a short report.');
	return pass('The analyzer works on the new data.');
}

/** @param {string} stdout */
function extractPrintedAverage(stdout) {
	const matches = stdout.match(/-?\d+\.\d+/gu);
	if (!matches) return null;
	const values = matches.map((value) => Number(value)).filter((value) => Number.isFinite(value));
	const near = values.find((value) => closeTo(value, VALID_AVERAGE, 0.08) || closeTo(value, FINAL_AVERAGE, 0.08));
	return near || values[values.length - 1];
}

const GRADERS = [
	gradeStep0,
	gradeStep1,
	gradeStep2,
	gradeStep3,
	gradeStep4,
	gradeStep5,
	gradeStep6,
	gradeStep7,
	gradeStep8,
	gradeStep9,
	gradeStep10,
	gradeStep11
];

/**
 * Trials the Python host should run for a step. The first trial is the student
 * program as written. Later trials may override names or feed stdin.
 *
 * @param {number} stepId
 * @returns {Array<{ stdin?: string[], overrides?: Record<string, number>, probe?: string }>}
 */
export function scienceCheckTrials(stepId) {
	switch (stepId) {
		case 1:
			return [{}, { overrides: { reading: 20, uncertainty: 1 } }];
		case 6:
			return [{ probe: 'functions' }];
		case 7:
			return [
				{ stdin: ['20'] },
				{ stdin: ['5'] },
				{ stdin: ['-1', '20'] }
			];
		case 11:
			return [{ stdin: ['20'] }];
		default:
			return [{}];
	}
}

/**
 * @param {number} stepId
 * @param {PythonRunResult[]} trials
 * @param {{ source?: string }} [context]
 * @returns {CheckResult}
 */
export function gradeScienceStep(stepId, trials, context = {}) {
	if (stepId === 0 && String(context.source || '').trim() === SCIENCE_STARTER_SOURCE.trim()) {
		return fail('Change the message, then run again.');
	}
	const grader = GRADERS[stepId];
	if (!grader) return fail('Unknown step.');
	return grader(trials);
}

export const SCIENCE_VALID_AVERAGE = VALID_AVERAGE;
export const SCIENCE_FINAL_AVERAGE = FINAL_AVERAGE;
