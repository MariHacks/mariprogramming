import { derived, writable } from 'svelte/store';
import { ACADEMIC_TERMS, calendarDate, resolveCurrentTerm } from './calendar.js';

/** @type {import('svelte/store').Writable<string | null>} */
export const explicitTermId = writable(null);

/** Injectable calendar day (YYYY-MM-DD) for tests and proof. Null uses live local date. */
/** @type {import('svelte/store').Writable<string | null>} */
export const asOfDate = writable(null);

export const termResolution = derived([explicitTermId, asOfDate], ([$explicitId, $asOf]) =>
	resolveCurrentTerm($asOf ?? calendarDate(), ACADEMIC_TERMS, $explicitId)
);
