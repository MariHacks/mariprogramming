import { gradeScienceStep, scienceCheckTrials } from './checks.js';

/**
 * @param {{
 *   run: (code: string, trial?: { stdin?: string[], overrides?: Record<string, number>, probe?: string }) => Promise<import('./python-host.js').PythonRunResult>,
 * }} host
 * @param {number} stepId
 * @param {string} source
 */
export async function runScienceCheck(host, stepId, source) {
	const trials = [];
	for (const trial of scienceCheckTrials(stepId)) {
		trials.push(await host.run(source, trial));
	}
	return gradeScienceStep(stepId, trials, { source });
}
