import { MAX_HINT_LEVEL } from './room-state.js';
import { SCIENCE_STEP_COUNT } from './science-workshop.js';

/** @param {number} stepId @param {number} unlockedStep */
export function canOpenStep(stepId, unlockedStep) {
	return (
		Number.isInteger(stepId) && stepId >= 0 && stepId <= unlockedStep && stepId < SCIENCE_STEP_COUNT
	);
}

/** @param {Record<string, number>} openedHints @param {number} stepId @param {number} level */
export function withOpenedHint(openedHints, stepId, level) {
	if (!Number.isInteger(level) || level < 1 || level > MAX_HINT_LEVEL) return openedHints;
	if (!Number.isInteger(stepId) || stepId < 0) return openedHints;
	const key = String(stepId);
	const current = openedHints[key] ?? 0;
	if (level !== current + 1) return openedHints;
	return { ...openedHints, [key]: level };
}

/** @param {number} unlockedStep @param {boolean} passed */
export function nextUnlockedStep(unlockedStep, passed) {
	if (!passed) return unlockedStep;
	return Math.min(SCIENCE_STEP_COUNT - 1, Math.max(unlockedStep, unlockedStep + 1));
}

/** @param {string} iso @param {number} nowMs */
export function timeOnStepLabel(iso, nowMs) {
	const started = Date.parse(iso);
	if (!Number.isFinite(started) || nowMs < started) return '0 min';
	const minutes = Math.floor((nowMs - started) / 60000);
	if (minutes < 1) return 'under 1 min';
	if (minutes === 1) return '1 min';
	return `${minutes} min`;
}

/**
 * @param {{ id?: number, minutes?: number } | null} step
 * @param {{ step?: number, passed?: boolean, message?: string } | null} lastCheck
 * @param {string} stepEnteredAt
 * @param {number} nowMs
 */
export function teamPace(step, lastCheck, stepEnteredAt, nowMs) {
	if (
		lastCheck &&
		lastCheck.passed === false &&
		(lastCheck.step === undefined || lastCheck.step === step?.id)
	) {
		return { label: 'Stuck', detail: lastCheck.message || 'Check failed.' };
	}
	const started = Date.parse(stepEnteredAt);
	const minutes = Number.isFinite(started) ? Math.floor((nowMs - started) / 60000) : 0;
	const budget = step?.minutes ?? 0;
	if (budget > 0 && minutes >= budget) {
		return { label: 'Over time', detail: `${minutes} min on a ${budget} min step` };
	}
	return { label: 'On track', detail: timeOnStepLabel(stepEnteredAt, nowMs) };
}

/**
 * @param {{
 *   blocked?: string,
 *   lastCheck?: { passed?: boolean, message?: string } | null,
 *   currentStep?: number
 * }} state
 */
export function studioNextAction(state) {
	if (state.blocked === 'full') return 'This team is full.';
	if (state.lastCheck && state.lastCheck.passed === false) {
		return `Not yet. ${state.lastCheck.message ?? ''}`.trim();
	}
	if (state.lastCheck?.passed && (state.currentStep ?? 0) < SCIENCE_STEP_COUNT - 1) {
		return 'Open the next step.';
	}
	return 'Press Run.';
}
