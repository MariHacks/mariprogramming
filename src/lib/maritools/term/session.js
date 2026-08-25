import { derived, writable } from 'svelte/store';
import { ACADEMIC_TERMS, calendarDate, resolveCurrentTerm } from './calendar.js';

/** @type {import('svelte/store').Writable<string | null>} */
export const explicitTermId = writable(null);

export const termResolution = derived(explicitTermId, (id) =>
	resolveCurrentTerm(calendarDate(), ACADEMIC_TERMS, id)
);
