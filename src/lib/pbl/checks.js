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

/** @param {Record<string, unknown>} globals @param {number} expected @param {number} [epsilon] */
function hasCloseValue(globals, expected, epsilon = 0.05) {
	return Object.values(globals).some((value) => closeTo(value, expected, epsilon));
}

/** @param {Record<string, unknown>} globals */
function findReadingsList(globals) {
	const preferred = globals.readings;
	if (Array.isArray(preferred) && preferred.length === SCIENCE_READINGS.length) return preferred;
	for (const value of Object.values(globals)) {
		if (!Array.isArray(value) || value.length !== SCIENCE_READINGS.length) continue;
		const first = asFiniteNumber(value[0]);
		const last = asFiniteNumber(value[value.length - 1]);
		if (closeTo(first, 12.1) && closeTo(last, 11.9)) return value;
	}
	return null;
}

/** @param {Record<string, unknown>} globals */
function findKeptList(globals) {
	for (const name of ['valid_readings', 'accepted', 'filtered', 'kept']) {
		const value = globals[name];
		if (Array.isArray(value)) return value;
	}
	for (const value of Object.values(globals)) {
		if (!Array.isArray(value) || value.length === 0) continue;
		if (value.every((item) => asFiniteNumber(item) !== null)) {
			if (!value.some((item) => closeTo(item, 48.7)) && value.length === 5) return value;
		}
	}
	return null;
}

/** @param {Record<string, unknown>} globals */
function findSummary(globals) {
	const preferred = globals.summary;
	if (preferred && typeof preferred === 'object' && !Array.isArray(preferred)) return preferred;
	for (const value of Object.values(globals)) {
		if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
		const record = /** @type {Record<string, unknown>} */ (value);
		if ('valid_count' in record && 'average' in record) return record;
	}
	return null;
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
	if (!trial || crashed(trial)) {
		return fail('The program crashed before it printed. Fix the error, then Run again.');
	}
	const output = stdoutOf(trial).trim();
	if (!output) return fail('Nothing printed. Add a print(...) call with your own message.');
	if (output === STARTER_MESSAGE) {
		return fail('Still printing "Experiment loaded". Change the quoted text, then Run again.');
	}
	return pass('Printed a custom message. Starter text is gone.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep1(trials) {
	const original = trials[0];
	const overridden = trials[1];
	if (!original || crashed(original)) {
		return fail('The program crashed. Store the reading and uncertainty in variables, compute both bounds, then print them.');
	}
	const g = globalsOf(original);
	const output = text(original);
	if (!hasCloseValue(g, 12.1)) {
		return fail('Store the reading 12.1 in a variable (any name). Printing it alone is not enough.');
	}
	if (!hasCloseValue(g, 0.2)) {
		return fail('Store the uncertainty 0.2 in a variable (any name).');
	}
	if (!mentions(output, '11.9') || !mentions(output, '12.3')) {
		return fail('Print both bounds. With 12.1 ± 0.2 they should be about 11.9 and 12.3.');
	}
	// Optional formula check when the student used the example names reading/uncertainty.
	if (
		asFiniteNumber(g.reading) !== null &&
		asFiniteNumber(g.uncertainty) !== null &&
		overridden &&
		!crashed(overridden)
	) {
		const og = globalsOf(overridden);
		const overriddenOut = text(overridden);
		const followed =
			(hasCloseValue(og, 19) && hasCloseValue(og, 21)) ||
			(mentions(overriddenOut, '19') && mentions(overriddenOut, '21'));
		if (!followed) {
			return fail(
				'Bounds look hard-coded. Compute them from your reading and uncertainty variables (for example reading - uncertainty).'
			);
		}
	}
	return pass('Bounds printed from stored reading and uncertainty values.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep2(trials) {
	const trial = trials[0];
	if (!trial || crashed(trial)) {
		return fail('The program crashed. Store the six readings in a list, then print first, last, and the count.');
	}
	const readings = findReadingsList(globalsOf(trial));
	if (!readings) {
		return fail('Store the six lab values in a list (for example readings = [...]).');
	}
	const first = asFiniteNumber(readings[0]);
	const last = asFiniteNumber(readings[readings.length - 1]);
	const output = text(trial);
	if (!closeTo(first, 12.1) || !closeTo(last, 11.9)) {
		return fail('The list should start at 12.1 and end at 11.9.');
	}
	if (!mentions(output, '12.1')) {
		return fail('Print the first value (12.1). It never appeared in the output.');
	}
	if (!mentions(output, '11.9')) {
		return fail('Print the last value (11.9). It never appeared in the output.');
	}
	if (!mentions(output, '6')) {
		return fail('Print len(readings) so 6 appears in the output.');
	}
	return pass('First, last, and length printed from readings.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep3(trials) {
	const trial = trials[0];
	if (!trial || crashed(trial)) {
		return fail('The program crashed. Loop over readings and print every value.');
	}
	const output = stdoutOf(trial);
	for (const reading of SCIENCE_READINGS) {
		const matches = output.match(new RegExp(String(reading).replace('.', '\\.'), 'gu')) || [];
		if (matches.length < 1) {
			return fail(`Missing reading ${reading} in the output. Print every item from readings.`);
		}
	}
	return pass('Every reading printed at least once.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep4(trials) {
	const trial = trials[0];
	if (!trial || crashed(trial)) {
		return fail('The program crashed. Label each reading valid or discard.');
	}
	const output = stdoutOf(trial).toLowerCase();
	if (!output.includes('valid')) {
		return fail('Print the word valid beside accepted readings.');
	}
	if (!output.includes('discard')) {
		return fail('Print the word discard beside rejected readings.');
	}
	const outlierLine = output.split('\n').find((line) => line.includes('48.7'));
	if (!outlierLine) {
		return fail('48.7 never appeared. Print each reading with its label on the same line.');
	}
	if (!outlierLine.includes('discard')) {
		return fail('48.7 should be labeled discard, not valid.');
	}
	if (!output.includes('12.1')) {
		return fail('Normal readings such as 12.1 should still print as valid.');
	}
	return pass('48.7 discarded; normal readings stay valid.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep5(trials) {
	const trial = trials[0];
	if (!trial || crashed(trial)) {
		return fail('The program crashed. Build an accepted-readings list and print the average.');
	}
	const kept = findKeptList(globalsOf(trial));
	if (!kept) {
		return fail('Build a list of accepted readings (for example valid_readings = [] and append values from 10 to 20).');
	}
	if (kept.some((value) => closeTo(value, 48.7))) {
		return fail('48.7 is still in the accepted list. Keep only values between 10 and 20.');
	}
	if (kept.length !== 5) {
		return fail(`The accepted list should keep 5 normal points, found ${kept.length}.`);
	}
	const average = firstNumber(averageValue(globalsOf(trial)), extractPrintedAverage(stdoutOf(trial)));
	if (!closeTo(average, VALID_AVERAGE, 0.08)) {
		return fail('Average is wrong or still includes the outlier. It should be near 12.02.');
	}
	return pass('Accepted list ignores 48.7 and the average matches.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep6(trials) {
	const trial = trials[0];
	if (!trial || crashed(trial)) {
		return fail('The program crashed. Define is_valid and an average function, then call them.');
	}
	const globals = globalsOf(trial);
	if (!isFunctionMarker(globals.is_valid)) {
		return fail('Missing function is_valid(reading, max_value). Define it with def and call it.');
	}
	const averageFn = ['average', 'mean', 'compute_average', 'avg'].some((name) =>
		isFunctionMarker(globals[name])
	);
	if (!averageFn) {
		return fail('Missing an average function that takes a list and returns a number.');
	}
	if (globals.is_valid_ok !== true || globals.is_valid_outlier !== false) {
		return fail('is_valid(12.1, 20) should be True and is_valid(48.7, 20) should be False.');
	}
	if (!closeTo(globals.probed_average, VALID_AVERAGE, 0.08)) {
		return fail('The average function still looks wrong. It should ignore 48.7 and land near 12.02.');
	}
	return pass('Main program calls the functions and still filters.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep7(trials) {
	const wide = trials[0];
	const tight = trials[1];
	const retry = trials[2];
	if (!wide || crashed(wide) || !tight || crashed(tight)) {
		return fail('Ask for a maximum with input(), convert with float(), and use it to filter readings.');
	}
	if (inputCountOf(wide) < 1) {
		return fail('No input() call found. Read the threshold with input() before filtering.');
	}
	const wideAverage = firstNumber(averageValue(globalsOf(wide)), extractPrintedAverage(stdoutOf(wide)));
	const tightAverage = firstNumber(
		averageValue(globalsOf(tight)),
		extractPrintedAverage(stdoutOf(tight))
	);
	if (!closeTo(wideAverage, VALID_AVERAGE, 0.08)) {
		return fail('With threshold 20, keep the normal readings and drop 48.7 (average near 12.02).');
	}
	if (tightAverage === null || closeTo(tightAverage, wideAverage, 0.01)) {
		return fail('Threshold 5 should accept a different set than threshold 20. Use the input value in the filter.');
	}
	if (!retry || crashed(retry) || inputCountOf(retry) < 2) {
		return fail('When the threshold is not positive, ask again with another input() inside a while loop.');
	}
	return pass('Threshold filters readings, and non-positive input asks again.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep8(trials) {
	const trial = trials[0];
	if (!trial || crashed(trial)) {
		return fail('The program crashed. import math and print a standard deviation of the valid readings.');
	}
	const g = globalsOf(trial);
	const stdev = firstNumber(g.standard_deviation, g.stdev, g.std, extractPrintedAverage(stdoutOf(trial)));
	if (stdev === null) {
		return fail('No standard deviation found. Store it in standard_deviation (or print the number).');
	}
	if (stdev < 0) {
		return fail('Standard deviation cannot be negative. Check the formula and the values you passed to sqrt.');
	}
	if (stdev === 0 || stdev >= 2) {
		return fail('Spread looks wrong. Use only valid_readings; including 48.7 makes the value much larger.');
	}
	return pass('Standard deviation is non-negative and ignores the outlier.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep9(trials) {
	const trial = trials[0];
	if (!trial || crashed(trial)) {
		return fail('The program crashed. Build a results dict and read a value by key.');
	}
	const summary = findSummary(globalsOf(trial));
	if (!summary) {
		return fail('Build a results dict (for example summary) with valid_count, average, and standard_deviation.');
	}
	const record = /** @type {Record<string, unknown>} */ (summary);
	if (!closeTo(record.valid_count, 5, 0.1)) {
		return fail('valid_count should be 5 (the accepted readings).');
	}
	if (!closeTo(record.average, VALID_AVERAGE, 0.08)) {
		return fail('average in the results dict should be the filtered mean near 12.02.');
	}
	const stdev = asFiniteNumber(record.standard_deviation);
	if (stdev === null) {
		return fail('Store standard_deviation (or the calculated spread) on the results dict.');
	}
	if (stdev < 0) {
		return fail('standard_deviation on the results dict should be non-negative.');
	}
	const printed = trial.stdout || '';
	if (!printed.includes('summary[') && !mentions(printed, String(record.average))) {
		return fail('Print one value from the results dict by key, for example print(summary["average"]).');
	}
	if (Object.keys(record).length < 4) {
		return fail('Add one new key after the first three (for example summary["unit"] = "mm").');
	}
	return pass('Results dict holds calculated values and can be read by key.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep10(trials) {
	const trial = trials[0];
	if (!trial || crashed(trial)) {
		return fail('The program crashed. Print a report and write it to a .txt file.');
	}
	const report = Object.entries(trial.files || {})
		.filter(([name]) => name.endsWith('.txt'))
		.map(([, contents]) => contents)
		.join('\n');
	const combined = `${trial.stdout || ''}\n${report}`;
	if (!report) {
		return fail('No .txt file written. Use open("report.txt", "w") and write the report string.');
	}
	if (
		!closeTo(extractPrintedAverage(combined), VALID_AVERAGE, 0.15) &&
		!mentions(combined, '12.0') &&
		!mentions(combined, 'average')
	) {
		return fail('The file should include calculated results (average or similar), not a hard-coded filler sentence.');
	}
	return pass('Report file contains calculated results.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep11(trials) {
	const trial = trials[0];
	if (!trial || crashed(trial)) {
		return fail('The program crashed. Ask for a max, filter the new readings, average them, store summary, and print a report.');
	}
	if (inputCountOf(trial) < 1) {
		return fail('Ask for a maximum valid reading with input().');
	}
	const kept =
		trial.globals?.valid_readings || trial.globals?.accepted || trial.globals?.filtered;
	if (Array.isArray(kept) && kept.some((value) => closeTo(value, 26.1))) {
		return fail('26.1 should be discarded when the maximum is 20.');
	}
	const average = firstNumber(averageValue(globalsOf(trial)), extractPrintedAverage(stdoutOf(trial)));
	if (!closeTo(average, FINAL_AVERAGE, 0.08)) {
		return fail('Average only the accepted values from the new readings (near 12.52 when max is 20).');
	}
	const summary = findSummary(globalsOf(trial)) || trial.globals?.summary;
	if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
		return fail('Store the results in a dictionary (for example summary).');
	}
	if (!stdoutOf(trial).trim()) {
		return fail('Print a short report of the results.');
	}
	return pass('Analyzer works on the new readings.');
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
		return fail('Still printing "Experiment loaded". Change the quoted text, then Run again.');
	}
	const grader = GRADERS[stepId];
	if (!grader) return fail('Unknown step id.');
	return grader(trials);
}

export const SCIENCE_VALID_AVERAGE = VALID_AVERAGE;
export const SCIENCE_FINAL_AVERAGE = FINAL_AVERAGE;
