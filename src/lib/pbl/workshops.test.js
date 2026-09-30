import { describe, expect, it, vi } from 'vitest';
import { createPythonHost } from './python-host.js';
import { canOpenStep, nextUnlockedStep, studioNextAction } from './workshop-session.js';
import { GAMEJAM_STARTER_SOURCE, GAMEJAM_STEPS } from './gamejam-workshop.js';
import { runGamejamCheck } from './gamejam-checks.js';
import { runScienceCheck } from './run-checks.js';
import { SCIENCE_STARTER_SOURCE, SCIENCE_STEPS } from './science-workshop.js';
import { WORKSHOPS, getWorkshop } from './workshops.js';
import { PYTHON_GLOSSARY, resolveGlossaryMark, tokenizeLessonText } from './python-glossary.js';

describe('workshop registry', () => {
	it('describes each workshop by its steps, starter code, check and input echo', () => {
		expect(getWorkshop('science')).toMatchObject({
			id: 'science',
			steps: SCIENCE_STEPS,
			stepCount: 12,
			starter: SCIENCE_STARTER_SOURCE,
			runCheck: runScienceCheck,
			echoInput: false,
			gradeWhenInputRunsOut: false
		});
		expect(getWorkshop('gamejam')).toMatchObject({
			id: 'gamejam',
			steps: GAMEJAM_STEPS,
			stepCount: 12,
			starter: GAMEJAM_STARTER_SOURCE,
			runCheck: runGamejamCheck,
			echoInput: true,
			gradeWhenInputRunsOut: true
		});
		expect(Object.isFrozen(WORKSHOPS)).toBe(true);
	});

	it('treats rooms with no or an unknown workshop id as science', () => {
		expect(getWorkshop(undefined)).toBe(WORKSHOPS.science);
		expect(getWorkshop('missing')).toBe(WORKSHOPS.science);
		expect(getWorkshop('constructor')).toBe(WORKSHOPS.science);
	});
});

describe('session helpers with a step count', () => {
	it('defaults to the science step count and honours a workshop step count', () => {
		expect(canOpenStep(11, 11)).toBe(true);
		expect(canOpenStep(5, 5, 5)).toBe(false);
		expect(canOpenStep(4, 5, 5)).toBe(true);
		expect(nextUnlockedStep(4, true, 4, 5)).toBe(4);
		expect(nextUnlockedStep(3, true, 3, 5)).toBe(4);
		expect(nextUnlockedStep(11, true)).toBe(11);
		expect(
			studioNextAction({ currentStep: 4, stepCount: 5, lastCheck: { step: 4, passed: true } })
		).toBe('');
		expect(
			studioNextAction({ currentStep: 3, stepCount: 5, lastCheck: { step: 3, passed: true } })
		).toBe('Open the next step.');
	});
});

describe('python host passes game jam trial options to the worker', () => {
	it('sends scripted rolls and input echo only when a trial asks for them', async () => {
		const posted = [];
		class FakeWorker {
			addEventListener(type, handler) {
				if (type === 'message') this.handler = handler;
			}
			postMessage(data) {
				posted.push(data);
				this.handler({
					data: {
						id: data.id,
						type: 'result',
						result: { stdout: '', stderr: '', error: null, globals: {}, files: {}, inputCount: 0 }
					}
				});
			}
			terminate() {}
		}
		const host = createPythonHost({ Worker: /** @type {any} */ (FakeWorker), timeoutMs: 1000 });
		await host.run('print(1)', { stdin: ['a'] });
		await host.run('print(1)', { stdin: ['a'], rolls: [4, 7], echo: true });
		await host.run('print(1)', { echo: false, rolls: undefined });
		host.destroy();
		expect(posted[0]).not.toHaveProperty('rolls');
		expect(posted[0]).not.toHaveProperty('echo');
		expect(posted[1]).toMatchObject({ rolls: [4, 7], echo: true, stdin: ['a'] });
		expect(posted[2]).not.toHaveProperty('echo');
		vi.restoreAllMocks();
	});
});

describe('glossary terms for the game jam', () => {
	it('links dice, exit, break, triple quotes and int()', () => {
		for (const [mark, key] of [
			['random.randint', 'random.randint'],
			['exit()', 'exit'],
			['exit', 'exit'],
			['break', 'break'],
			['triple quotes', 'triple-quote'],
			['multi-line string', 'triple-quote'],
			['int()', 'int']
		]) {
			expect(resolveGlossaryMark(mark)?.key, mark).toBe(key);
			expect(PYTHON_GLOSSARY[key].summary).toBeTruthy();
		}
		for (const key of ['random.randint', 'exit', 'break', 'triple-quote']) {
			const entry = PYTHON_GLOSSARY[key];
			expect(entry.usefulFor).toBeTruthy();
			expect(entry.example).toBeTruthy();
			expect(entry.summary + entry.usefulFor).not.toMatch(/[–—]/u);
			if (entry.example.includes('print(')) expect(entry.exampleOutput).toBeTruthy();
		}
		const segments = tokenizeLessonText(
			'Roll with `random.randint`(1, 6), then `break` or `exit()`.'
		);
		expect(segments.filter((s) => s.type === 'term').map((s) => s.key)).toEqual([
			'random.randint',
			'break',
			'exit'
		]);
	});
});
