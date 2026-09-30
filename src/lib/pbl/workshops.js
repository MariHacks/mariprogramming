import { GAMEJAM_PBL_ID, SCIENCE_PBL_ID } from './catalog.js';
import { runGamejamCheck } from './gamejam-checks.js';
import { GAMEJAM_STARTER_SOURCE, GAMEJAM_STEPS } from './gamejam-workshop.js';
import { runScienceCheck } from './run-checks.js';
import { SCIENCE_STARTER_SOURCE, SCIENCE_STEPS } from './science-workshop.js';

/**
 * Everything the studio needs to run one workshop: its steps, the code a new
 * team starts with, how a step is checked, and whether Run echoes typed input.
 *
 * @typedef {{
 *   id: string,
 *   steps: readonly any[],
 *   stepCount: number,
 *   starter: string,
 *   runCheck: (host: any, stepId: number, source: string) => Promise<{ passed: boolean, message: string }>,
 *   echoInput: boolean,
 *   gradeWhenInputRunsOut: boolean
 * }} Workshop
 */

/** @type {Readonly<Record<string, Workshop>>} */
export const WORKSHOPS = Object.freeze({
	[SCIENCE_PBL_ID]: Object.freeze({
		id: SCIENCE_PBL_ID,
		steps: SCIENCE_STEPS,
		stepCount: SCIENCE_STEPS.length,
		starter: SCIENCE_STARTER_SOURCE,
		runCheck: runScienceCheck,
		echoInput: false,
		gradeWhenInputRunsOut: false
	}),
	[GAMEJAM_PBL_ID]: Object.freeze({
		id: GAMEJAM_PBL_ID,
		steps: GAMEJAM_STEPS,
		stepCount: GAMEJAM_STEPS.length,
		starter: GAMEJAM_STARTER_SOURCE,
		runCheck: runGamejamCheck,
		// A game reads like a console session: show each typed answer after its prompt.
		echoInput: true,
		// Checks script their own input, so a visible Run that ran out of Program input still gets graded.
		gradeWhenInputRunsOut: true
	})
});

/**
 * Rooms created before PBL 2 only ever held the science workshop, so an unknown
 * or missing id resolves to it.
 * @param {unknown} pblId
 * @returns {Workshop}
 */
export function getWorkshop(pblId) {
	return typeof pblId === 'string' && Object.hasOwn(WORKSHOPS, pblId)
		? WORKSHOPS[pblId]
		: WORKSHOPS[SCIENCE_PBL_ID];
}
