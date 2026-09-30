import { describe, expect, it } from 'vitest';
import {
	GAMEJAM_STARTER_SOURCE,
	GAMEJAM_STEPS,
	GAMEJAM_STEP_COUNT,
	getGamejamStep
} from './gamejam-workshop.js';
import { GAMEJAM_REFERENCE_SOURCES } from './gamejam-reference.js';
import { tokenizeLessonText } from './python-glossary.js';

describe('PBL 2 game jam workshop', () => {
	it('is one growing game across twelve timed steps', () => {
		expect(GAMEJAM_STEPS.map((step) => step.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
		expect(GAMEJAM_STEP_COUNT).toBe(12);
		expect(GAMEJAM_STEPS[0].starter).toBe(GAMEJAM_STARTER_SOURCE);
		expect(GAMEJAM_STEPS.slice(1).every((step) => step.starter === undefined)).toBe(true);
		expect(GAMEJAM_STEPS.map((step) => step.title)).toEqual([
			'Get something running',
			'Set the scene',
			'Ask the player',
			'Write the email',
			'Make a choice',
			'Keep score',
			'Game over',
			'Roll the dice',
			'Fate branches',
			'The quiz loop',
			'How your day ends',
			'Make it yours'
		]);
		for (const step of GAMEJAM_STEPS) expect(step.minutes).toBeGreaterThan(0);
		expect(getGamejamStep(0)?.title).toBe('Get something running');
		expect(getGamejamStep(11)?.title).toBe('Make it yours');
		expect(getGamejamStep(-1)).toBeNull();
		expect(getGamejamStep(1.5)).toBeNull();
		expect(getGamejamStep(12)).toBeNull();
	});

	it('gives Idea, Syntax and Partial code hints and never a full solution in hint 1', () => {
		for (const step of GAMEJAM_STEPS) {
			expect(step.hints).toHaveLength(3);
			expect(step.hints[0].length).toBeGreaterThan(20);
			expect(step.hints[0]).not.toMatch(/\n/);
			expect(step.hints[0]).not.toMatch(/^\s*(?:def |print\(|import |for |while )/u);
			expect(step.hints[1].length).toBeGreaterThan(0);
			expect(step.hints[2]).toMatch(/print\(|input\(|import |=|if |while /u);
			expect(step.scene?.length).toBeGreaterThan(20);
			expect(step.scene).not.toMatch(/`|\bprint\(|\binput\(/u);
			expect(step.body.length).toBeLessThan(900);
		}
		expect(GAMEJAM_STEPS[11].stretch).toMatch(/bugs/i);
	});

	it('uses multi-paragraph bodies with structured Output notes and no checker-as-why copy', () => {
		for (const step of GAMEJAM_STEPS) {
			expect(step.body.split(/\n\n/).length).toBeGreaterThanOrEqual(2);
			expect(step.body).not.toMatch(/^Output\b/m);
			expect(step.outputNotes?.length).toBeGreaterThanOrEqual(1);
			expect(step.body).not.toMatch(/\bchecker\b|\bgrader\b|to pass\b/i);
			const blob = [
				step.title,
				step.scene ?? '',
				step.body,
				...(step.notes ?? []),
				...(step.outputNotes ?? []),
				...(step.requiredStrings ?? []).flatMap((group) => [group.label, ...group.strings]),
				...step.hints,
				step.stretch ?? ''
			].join('\n');
			expect(blob).not.toMatch(/[–—]/u);
		}
	});

	it('only backticks terms the glossary knows, so no stray backticks reach students', () => {
		for (const step of GAMEJAM_STEPS) {
			const prose = [
				step.scene ?? '',
				step.body,
				...(step.notes ?? []),
				...(step.outputNotes ?? []),
				...(step.requiredStrings ?? []).flatMap((group) => group.strings),
				step.stretch ?? ''
			];
			for (const text of prose) {
				const literal = tokenizeLessonText(text).filter(
					(segment) => segment.type === 'text' && segment.value.includes('`')
				);
				expect(literal).toEqual([]);
			}
			for (const hint of step.hints) {
				const literal = tokenizeLessonText(hint).filter(
					(segment) => segment.type === 'text' && segment.value.includes('`')
				);
				expect(literal).toEqual([]);
			}
		}
	});

	it('groups every exact string a step requires', () => {
		expect(GAMEJAM_STEPS[0].requiredStrings).toEqual([
			{ label: 'Header', strings: ['----- 8:00 AM | GETTING TO SCHOOL -----'] }
		]);
		for (const step of GAMEJAM_STEPS) {
			expect(step.requiredStrings?.length).toBeGreaterThan(0);
			const labels = step.requiredStrings.map((group) => group.label);
			expect(new Set(labels).size).toBe(labels.length);
			for (const group of step.requiredStrings) {
				expect(group.strings.length).toBeGreaterThan(0);
				for (const line of group.strings) {
					expect(line).toBe(line.trim());
					expect(line.length).toBeGreaterThan(0);
				}
			}
		}
		const listed = GAMEJAM_STEPS.flatMap((step) =>
			step.requiredStrings.flatMap((group) => group.strings)
		).join('\n');
		expect(listed).toContain('Enter your goofy excuse:');
		expect(listed).toContain('Press ENTER to send...');
		expect(listed).toContain('1. Lock in');
		expect(listed).toContain('BONUS: +1 chance for later.');
		expect(listed).toContain('YOU DIED.');
		expect(listed).toContain('----- SURPRISE QUIZ -----');
		expect(listed).toContain('YOU SURVIVED THE DAY. You passed the quiz. See you tomorrow.');
		expect(listed).toContain("YOU SURVIVED THE DAY. You failed the quiz. Don't check Omnivox tonight...");
	});

	it('teaches each step from the previous step code, ending at the finished game', () => {
		expect(GAMEJAM_REFERENCE_SOURCES).toHaveLength(12);
		expect(GAMEJAM_REFERENCE_SOURCES[0]).toBe('print("----- 8:00 AM | GETTING TO SCHOOL -----")\n');
		for (let step = 1; step < 12; step += 1) {
			// Every step keeps the whole previous program: its non-blank lines all survive.
			const kept = GAMEJAM_REFERENCE_SOURCES[step];
			const previous = GAMEJAM_REFERENCE_SOURCES[step - 1];
			if (step === 1) continue;
			for (const line of previous.split('\n').filter((entry) => entry.trim())) {
				expect(kept).toContain(line);
			}
		}
		expect(GAMEJAM_REFERENCE_SOURCES[10]).toContain('YOU SURVIVED THE DAY. You passed the quiz.');
		expect(GAMEJAM_REFERENCE_SOURCES[11]).toContain('CHEM LAB');
	});
});
