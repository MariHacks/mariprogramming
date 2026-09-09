import { describe, expect, it } from 'vitest';
import { runScienceCheck } from './run-checks.js';

describe('runScienceCheck', () => {
	it('runs each trial then grades the collected results', async () => {
		const calls = [];
		const result = await runScienceCheck(
			{
				async run(code, trial) {
					calls.push({ code, trial });
					return {
						stdout: 'Lab ready\n',
						stderr: '',
						error: null,
						globals: {},
						files: {},
						inputCount: 0
					};
				}
			},
			0,
			'print("Lab ready")'
		);
		expect(calls).toEqual([{ code: 'print("Lab ready")', trial: {} }]);
		expect(result.passed).toBe(true);
	});
});
