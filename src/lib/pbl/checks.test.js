import { describe, expect, it } from 'vitest';
import {
	SCIENCE_FINAL_AVERAGE,
	SCIENCE_VALID_AVERAGE,
	asFiniteNumber,
	closeTo,
	gradeScienceStep,
	scienceCheckTrials
} from './checks.js';

describe('science step checks', () => {
	it('grades printed behavior instead of exact source text', () => {
		expect(scienceCheckTrials(0)).toEqual([{}]);
		expect(scienceCheckTrials(1)).toEqual([{}, { overrides: { reading: 20, uncertainty: 1 } }]);
		expect(scienceCheckTrials(7)).toEqual([
			{ stdin: ['20'] },
			{ stdin: ['5'] },
			{ stdin: ['-1', '20'] }
		]);
		expect(asFiniteNumber('12.1')).toBe(12.1);
		expect(closeTo(12.02, SCIENCE_VALID_AVERAGE ?? 0)).toBe(true);
		expect(
			gradeScienceStep(0, [{ stdout: 'Experiment loaded\n' }], {
				source: 'print("Experiment loaded")\n'
			}).passed
		).toBe(false);
		expect(gradeScienceStep(0, [{ stdout: 'Lab table 3 is live\n' }])).toEqual({
			passed: true,
			message: 'The program printed your message.'
		});
	});

	it('rejects hardcoded bounds by re-running with different reading values', () => {
		expect(
			gradeScienceStep(1, [
				{ globals: { lower_bound: 11.9, upper_bound: 12.3 } },
				{ globals: { lower_bound: 11.9, upper_bound: 12.3 } }
			]).passed
		).toBe(false);
		expect(
			gradeScienceStep(1, [
				{ globals: { lower_bound: 11.9, upper_bound: 12.3 } },
				{ globals: { lower_bound: 19, upper_bound: 21 } }
			]).passed
		).toBe(true);
	});

	it('unlocks later steps from measured behavior', () => {
		expect(
			gradeScienceStep(2, [
				{
					stdout: '12.1\n11.9\n6\n',
					globals: { readings: [12.1, 11.8, 12.3, 48.7, 12.0, 11.9] }
				}
			]).passed
		).toBe(true);
		expect(gradeScienceStep(3, [{ stdout: '12.1\n11.8\n12.3\n48.7\n12.0\n11.9\n' }]).passed).toBe(
			true
		);
		expect(
			gradeScienceStep(4, [
				{ stdout: '12.1 valid\n11.8 valid\n12.3 valid\n48.7 discard\n12.0 valid\n11.9 valid\n' }
			]).passed
		).toBe(true);
		expect(
			gradeScienceStep(5, [
				{
					stdout: '12.02\n',
					globals: { valid_readings: [12.1, 11.8, 12.3, 12.0, 11.9], average: 12.02 }
				}
			]).passed
		).toBe(true);
		expect(
			gradeScienceStep(5, [
				{
					stdout: '18.13\n',
					globals: { valid_readings: [12.1, 11.8, 12.3, 48.7, 12.0, 11.9], average: 18.13 }
				}
			]).passed
		).toBe(false);
		expect(
			gradeScienceStep(6, [
				{
					globals: {
						is_valid: { kind: 'function' },
						average: { kind: 'function' },
						is_valid_ok: true,
						is_valid_outlier: false,
						probed_average: SCIENCE_VALID_AVERAGE
					}
				}
			]).passed
		).toBe(true);
		expect(
			gradeScienceStep(7, [
				{ stdout: '12.02', globals: { average: 12.02 }, inputCount: 1 },
				{ stdout: 'none', globals: { average: 0 }, inputCount: 1 },
				{ stdout: '12.02', globals: { average: 12.02 }, inputCount: 2 }
			]).passed
		).toBe(true);
		expect(
			gradeScienceStep(7, [
				{ stdout: '12.02', inputCount: 1 },
				{ stdout: '0.01', inputCount: 1 },
				{ stdout: '12.02', inputCount: 2 }
			]).passed
		).toBe(true);
		expect(
			gradeScienceStep(8, [{ stdout: '0.192', globals: { standard_deviation: 0.192 } }]).passed
		).toBe(true);
		expect(
			gradeScienceStep(8, [{ stdout: '14.9', globals: { standard_deviation: 14.9 } }]).passed
		).toBe(false);
		expect(
			gradeScienceStep(9, [
				{
					stdout: '12.02\n',
					globals: {
						summary: { valid_count: 5, average: 12.02, standard_deviation: 0.19, unit: 'mm' }
					}
				}
			]).passed
		).toBe(true);
		expect(
			gradeScienceStep(10, [
				{
					stdout: 'average=12.02',
					files: { 'report.txt': 'average=12.02 valid_count=5' }
				}
			]).passed
		).toBe(true);
		expect(
			gradeScienceStep(11, [
				{
					stdout: `average=${SCIENCE_FINAL_AVERAGE}`,
					inputCount: 1,
					globals: {
						valid_readings: [12.4, 12.6, 12.5, 12.8, 12.3],
						average: SCIENCE_FINAL_AVERAGE,
						summary: { average: SCIENCE_FINAL_AVERAGE }
					}
				}
			]).passed
		).toBe(true);
		expect(gradeScienceStep(99, []).passed).toBe(false);
		expect(gradeScienceStep(0, [{ error: 'boom' }]).passed).toBe(false);
		expect(gradeScienceStep(0, [{ stdout: '' }]).passed).toBe(false);
		expect(gradeScienceStep(0, [{ stdout: 'Experiment loaded\n' }]).passed).toBe(false);
		expect(gradeScienceStep(1, [{ globals: {} }]).passed).toBe(false);
		expect(gradeScienceStep(2, [{ stdout: '', globals: { readings: [1] } }]).passed).toBe(false);
		expect(gradeScienceStep(3, [{ stdout: '12.1\n' }]).passed).toBe(false);
		expect(gradeScienceStep(4, [{ stdout: '12.1\n48.7\n' }]).passed).toBe(false);
		expect(asFiniteNumber('nope')).toBeNull();
		expect(closeTo('x', 1)).toBe(false);
		expect(scienceCheckTrials(6)).toEqual([{ probe: 'functions' }]);
		expect(scienceCheckTrials(11)).toEqual([{ stdin: ['20'] }]);
		expect(gradeScienceStep(1, [])).toMatchObject({ passed: false });
		expect(gradeScienceStep(1, [{ globals: { lower_bound: 0, upper_bound: 1 } }]).passed).toBe(
			false
		);
		expect(
			gradeScienceStep(1, [{ globals: { lower_bound: 11.9, upper_bound: 12.3 } }]).passed
		).toBe(false);
		expect(gradeScienceStep(2, [{ error: 'boom' }]).passed).toBe(false);
		expect(
			gradeScienceStep(2, [
				{
					stdout: '',
					stderr: 'note',
					globals: { readings: [12.1, 11.8, 12.3, 48.7, 12.0, 11.9] }
				}
			]).passed
		).toBe(false);
		expect(
			gradeScienceStep(2, [
				{
					stdout: '1\n2\n6',
					globals: { readings: [1, 11.8, 12.3, 48.7, 12.0, 2] }
				}
			]).passed
		).toBe(false);
		expect(gradeScienceStep(3, [{ error: 'boom' }]).passed).toBe(false);
		expect(gradeScienceStep(4, [{ error: 'boom' }]).passed).toBe(false);
		expect(gradeScienceStep(4, [{ stdout: 'valid\ndiscard\n12.1 valid\n' }]).passed).toBe(false);
		expect(gradeScienceStep(4, [{ stdout: '48.7 discard\n11.8 valid\n' }]).passed).toBe(false);
		expect(gradeScienceStep(5, [{ error: 'boom' }]).passed).toBe(false);
		expect(
			gradeScienceStep(5, [{ globals: { valid_readings: [12.1] }, stdout: '12.1' }]).passed
		).toBe(false);
		expect(
			gradeScienceStep(5, [
				{
					stdout: '18',
					globals: { valid_readings: [12.1, 11.8, 12.3, 12.0, 11.9], average: 18 }
				}
			]).passed
		).toBe(false);
		expect(gradeScienceStep(6, [{ error: 'boom' }]).passed).toBe(false);
		expect(gradeScienceStep(6, [{ globals: {} }]).passed).toBe(false);
		expect(gradeScienceStep(6, [{ globals: { is_valid: { kind: 'function' } } }]).passed).toBe(
			false
		);
		expect(
			gradeScienceStep(6, [
				{
					globals: {
						is_valid: { kind: 'function' },
						average: { kind: 'function' },
						is_valid_ok: false,
						is_valid_outlier: false
					}
				}
			]).passed
		).toBe(false);
		expect(
			gradeScienceStep(6, [
				{
					globals: {
						is_valid: { kind: 'function' },
						mean: { kind: 'function' },
						is_valid_ok: true,
						is_valid_outlier: false,
						probed_average: 18
					}
				}
			]).passed
		).toBe(false);
		expect(gradeScienceStep(7, [{ error: 'boom' }, { stdout: 'x' }]).passed).toBe(false);
		expect(
			gradeScienceStep(7, [
				{ stdout: '12.02', globals: { average: 12.02 }, inputCount: 0 },
				{ stdout: '0', globals: { average: 0 }, inputCount: 1 }
			]).passed
		).toBe(false);
		expect(
			gradeScienceStep(7, [
				{ stdout: '18', globals: { average: 18 }, inputCount: 1 },
				{ stdout: '0', globals: { average: 0 }, inputCount: 1 }
			]).passed
		).toBe(false);
		expect(
			gradeScienceStep(7, [
				{ stdout: '12.02', globals: { average: 12.02 }, inputCount: 1 },
				{ stdout: '12.02', globals: { average: 12.02 }, inputCount: 1 }
			]).passed
		).toBe(false);
		expect(
			gradeScienceStep(7, [
				{ stdout: '12.02', globals: { average: 12.02 }, inputCount: 1 },
				{ stdout: '0', globals: { average: 0 }, inputCount: 1 },
				{ error: 'boom' }
			]).passed
		).toBe(false);
		expect(gradeScienceStep(8, [{ error: 'boom' }]).passed).toBe(false);
		expect(gradeScienceStep(8, [{ stdout: 'none' }]).passed).toBe(false);
		expect(gradeScienceStep(8, [{ stdout: '3.14' }]).passed).toBe(false);
		expect(gradeScienceStep(9, [{ error: 'boom' }]).passed).toBe(false);
		expect(gradeScienceStep(9, [{ globals: { summary: [] } }]).passed).toBe(false);
		expect(
			gradeScienceStep(9, [{ globals: { summary: { valid_count: 1, average: 12.02 } } }]).passed
		).toBe(false);
		expect(
			gradeScienceStep(9, [
				{ globals: { summary: { valid_count: 5, average: 1, standard_deviation: 0.2 } } }
			]).passed
		).toBe(false);
		expect(
			gradeScienceStep(9, [
				{ globals: { summary: { valid_count: 5, average: 12.02, standard_deviation: -1 } } }
			]).passed
		).toBe(false);
		expect(
			gradeScienceStep(9, [
				{
					stdout: 'ok',
					globals: { summary: { valid_count: 5, average: 12.02, standard_deviation: 0.2 } }
				}
			]).passed
		).toBe(false);
		expect(
			gradeScienceStep(9, [
				{
					stdout: '12.02',
					globals: { summary: { valid_count: 5, average: 12.02, standard_deviation: 0.2 } }
				}
			]).passed
		).toBe(false);
		expect(
			gradeScienceStep(9, [
				{
					globals: {
						summary: { valid_count: 5, average: 12.02, standard_deviation: 0.2, unit: 'mm' }
					}
				}
			]).passed
		).toBe(false);
		expect(gradeScienceStep(10, [{ error: 'boom' }]).passed).toBe(false);
		expect(gradeScienceStep(10, [{ stdout: 'average=12.02' }]).passed).toBe(false);
		expect(gradeScienceStep(10, [{ files: { 'notes.md': 'hi' } }]).passed).toBe(false);
		expect(gradeScienceStep(10, [{ files: { 'report.txt': 'hello world' } }]).passed).toBe(false);
		expect(gradeScienceStep(11, [{ error: 'boom' }]).passed).toBe(false);
		expect(gradeScienceStep(11, [{ stdout: 'x', inputCount: 0 }]).passed).toBe(false);
		expect(gradeScienceStep(11, [{ stdout: 'x' }]).passed).toBe(false);
		expect(
			gradeScienceStep(11, [
				{
					stdout: '26.1',
					inputCount: 1,
					globals: { accepted: [26.1], average: 26.1, summary: { average: 26.1 } }
				}
			]).passed
		).toBe(false);
		expect(
			gradeScienceStep(11, [
				{
					stdout: '26.1',
					inputCount: 1,
					globals: { filtered: [26.1], average: 26.1, summary: { average: 26.1 } }
				}
			]).passed
		).toBe(false);
		expect(
			gradeScienceStep(11, [
				{ stdout: '1', inputCount: 1, globals: { average: 1, summary: { average: 1 } } }
			]).passed
		).toBe(false);
		expect(
			gradeScienceStep(11, [
				{ stdout: '12.52', inputCount: 1, globals: { average: SCIENCE_FINAL_AVERAGE, summary: [] } }
			]).passed
		).toBe(false);
		expect(
			gradeScienceStep(11, [
				{
					inputCount: 1,
					globals: { average: SCIENCE_FINAL_AVERAGE, summary: { average: SCIENCE_FINAL_AVERAGE } }
				}
			]).passed
		).toBe(false);
		expect(asFiniteNumber(12.1)).toBe(12.1);
		expect(asFiniteNumber('')).toBeNull();
		expect(
			gradeScienceStep(5, [
				{
					stdout: '12.02',
					globals: { valid_readings: [12.1, 11.8, 12.3, 12.0, 11.9], avg: 12.02 }
				}
			]).passed
		).toBe(true);
		expect(
			gradeScienceStep(5, [
				{
					stdout: 'x',
					globals: { valid_readings: [12.1, 11.8, 12.3, 12.0, 11.9], mean: 12.02 }
				}
			]).passed
		).toBe(true);
		expect(gradeScienceStep(8, [{ stdout: '0.2', globals: { stdev: 0.2 } }]).passed).toBe(true);
		expect(gradeScienceStep(8, [{ stdout: '0.2', globals: { std: 0.2 } }]).passed).toBe(true);
		expect(
			gradeScienceStep(9, [
				{
					stdout: 'summary["average"]',
					globals: {
						summary: { valid_count: 5, average: 12.02, standard_deviation: 0.19, unit: 'mm' }
					}
				}
			]).passed
		).toBe(true);
	});
});
