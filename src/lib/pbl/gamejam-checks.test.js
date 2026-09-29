import { describe, expect, it } from 'vitest';
import { pythonAvailable, pythonSimHost, runPython } from '../../test/python-worker-sim.js';
import { GAMEJAM_REFERENCE_SOURCES as REF } from './gamejam-reference.js';
import { gamejamCheckTrials, gradeGamejamStep, runGamejamCheck } from './gamejam-checks.js';
import { GAMEJAM_STARTER_SOURCE } from './gamejam-workshop.js';

/** @param {number} step @param {string} source */
async function check(step, source) {
	return runGamejamCheck(pythonSimHost, step, source);
}

/** @param {string} source @param {string} text */
function removeLast(source, text) {
	const at = source.lastIndexOf(text);
	expect(at).toBeGreaterThan(-1);
	return source.slice(0, at) + source.slice(at + text.length);
}

/**
 * @param {string} source
 * @param {string} from
 * @param {string} to
 */
function swap(source, from, to) {
	expect(source).toContain(from);
	return source.replace(from, to);
}

describe('game jam trials', () => {
	it('scripts every input() and every dice roll so results repeat', () => {
		expect(gamejamCheckTrials(0)).toEqual([{}]);
		expect(gamejamCheckTrials(1)).toEqual([{}]);
		expect(gamejamCheckTrials(2)).toEqual([
			{ stdin: ['my cat ate my alarm'] },
			{ stdin: ['aliens borrowed my bike'] }
		]);
		expect(gamejamCheckTrials(3)[0]).toEqual({ stdin: ['my cat ate my alarm', '', ''] });
		expect(gamejamCheckTrials(4).map((trial) => trial.stdin?.[3])).toEqual(['1', '2', '3']);
		expect(gamejamCheckTrials(6)).toHaveLength(3);
		expect(gamejamCheckTrials(7)).toEqual([
			{ stdin: ['my cat ate my alarm', '', '', '2', '', '1', ''], rolls: [4] },
			{ stdin: ['my cat ate my alarm', '', '', '2', '', '2', ''], rolls: [2] }
		]);
		expect(gamejamCheckTrials(8).map((trial) => trial.rolls)).toEqual([
			[1],
			[3],
			[5],
			[1],
			[3],
			[5]
		]);
		expect(gamejamCheckTrials(9).map((trial) => trial.rolls)).toEqual([
			[4, 7],
			[4, 7]
		]);
		const [win, lose] = gamejamCheckTrials(9);
		expect(win.stdin?.slice(-3)).toEqual(['5', '9', '7']);
		expect(lose.stdin?.slice(-4)).toEqual(['1', '1', '1', '1']);
		expect(gamejamCheckTrials(10).map((trial) => trial.stdin?.at(-1))).toEqual(['', '']);
		expect(gamejamCheckTrials(11)).toHaveLength(2);
		expect(gamejamCheckTrials(11)[0].stdin).toHaveLength(61);
		expect(gamejamCheckTrials(99)).toEqual([{}]);
	});

	it('reports an unknown step', () => {
		expect(gradeGamejamStep(99, [])).toEqual({ passed: false, message: 'Unknown step id.' });
		expect(gradeGamejamStep(-1, [])).toMatchObject({ passed: false });
	});

	it('runs each trial then grades the collected results', async () => {
		const calls = [];
		const result = await runGamejamCheck(
			{
				async run(code, trial) {
					calls.push({ code, trial });
					return { stdout: '----- 8:00 AM | GETTING TO SCHOOL -----\n', error: null };
				}
			},
			0,
			'print("----- 8:00 AM | GETTING TO SCHOOL -----")'
		);
		expect(calls).toEqual([
			{ code: 'print("----- 8:00 AM | GETTING TO SCHOOL -----")', trial: {} }
		]);
		expect(result.passed).toBe(true);
	});
});

describe.skipIf(!pythonAvailable)('game jam checks against real Python', () => {
	it('passes each reference program on its own step', async () => {
		for (let step = 0; step < 12; step += 1) {
			const result = await check(step, REF[step]);
			expect(result, `step ${step}`).toMatchObject({ passed: true });
		}
	});

	it('does not pass a step for the program of the step before it', async () => {
		for (let step = 1; step < 12; step += 1) {
			const result = await check(step, REF[step - 1]);
			expect(result.passed, `step ${step}`).toBe(false);
		}
	});

	it('lets Helen finish: the guide ends exactly at her game', async () => {
		expect(REF[10]).toContain('import random\nattempts = 3\n');
		expect((await check(10, REF[10])).passed).toBe(true);
	});

	it.each([
		[0, 'the starter text', GAMEJAM_STARTER_SOURCE, /Still printing "Game loaded"/],
		[0, 'nothing printed', '# nothing\n', /Nothing printed/],
		[0, 'a wrong header', 'print("hello")\n', /Print the header/],
		[
			0,
			'two lines',
			'print("----- 8:00 AM | GETTING TO SCHOOL -----")\nprint("more")\n',
			/exactly one line/i
		],
		[0, 'a crash', 'print(oops)\n', /crashed before it printed/],
		[0, 'the starter with a changed text', 'print("Game loaded")\n', /Still printing/]
	])('step %i fails for %s', async (step, _label, source, message) => {
		const result = await check(step, source);
		expect(result.passed).toBe(false);
		expect(result.message).toMatch(message);
	});

	it.each([
		[
			'no triple quotes',
			() =>
				'print("----- 8:00 AM | GETTING TO SCHOOL -----")\nprint("Oops, it\'s 8:07 AM and you have an 8:15 AM class.")\nprint("Time to email your prof.")\n',
			/triple quotes/
		],
		[
			'the header on the first line',
			() =>
				'print("""----- 8:00 AM | GETTING TO SCHOOL -----\n""")\nprint("""Oops, it\'s 8:07 AM. 8:15 AM.\nTime to email your prof.""")\n',
			/blank line above/
		],
		[
			'a header without the place',
			() => 'print("""\n----- 8:00 AM -----\n""")\nprint("""8:07 8:15\nemail""")\n',
			/Keep the header/
		],
		[
			'narration missing the times',
			() => 'print("""\n----- 8:00 AM | GETTING TO SCHOOL -----\n""")\nprint("""hello\nworld""")\n',
			/8:07/
		],
		[
			'narration on one line',
			() =>
				'print("""\n----- 8:00 AM | GETTING TO SCHOOL -----\n""")\nprint("""8:07 and 8:15 so email the prof""")\n',
			/second line/
		],
		[
			'a crash',
			() => 'print("""\n----- 8:00 AM | GETTING TO SCHOOL -----\n""")\nprint(oops)\n',
			/crashed/
		]
	])('step 1 fails for %s', async (_label, mutate, message) => {
		const result = await check(1, mutate(REF[1]));
		expect(result.passed).toBe(false);
		expect(result.message).toMatch(message);
	});

	it.each([
		['no input', () => REF[1], /No input\(\)/],
		['a different prompt', (s) => swap(s, 'Enter your goofy excuse: ', 'Type: '), /prompt/],
		['the answer not stored', (s) => swap(s, 'excuse = input(', 'input('), /variable/],
		[
			'another variable name',
			(s) => swap(s, 'excuse = input', 'reason = input'),
			/Name the variable excuse/
		],
		[
			'no answer for a second run',
			(s) => `${s}\nextra = input("more? ")\n`,
			/Program input|EOF|more input/
		]
	])('step 2 fails for %s', async (_label, mutate, message) => {
		const result = await check(2, mutate(REF[2]));
		if (_label === 'no answer for a second run') {
			expect(result.passed).toBe(false);
			expect(result.message).toMatch(/more input\(\) answers/);
			return;
		}
		expect(result.passed).toBe(false);
		expect(result.message).toMatch(message);
	});

	it.each([
		[
			'a hard-coded excuse',
			(s) => swap(s, '{excuse}', 'my cat ate my alarm'),
			/excuse variable inside/
		],
		[
			'an excuse typed in beside the variable',
			(s) => swap(s, '{excuse}', 'my cat ate my alarm {excuse}'),
			/change with each excuse/
		],
		[
			'an email that skips the excuse',
			(s) => swap(s, 'because {excuse}', 'because'),
			/excuse variable inside/
		],
		['no email line', (s) => swap(s, 'Hi Professor', 'Dear Sir'), /Print the email/],
		[
			'an email without because',
			(s) => swap(s, "can't make it to class today because {excuse}", '{excuse}'),
			/because and then the excuse/
		],
		[
			'no send pause',
			(s) => swap(s, 'input("\\nPress ENTER to send...")\n', ''),
			/Press ENTER to send/
		],
		['no Sent line', (s) => swap(s, 'print("Sent.")', ''), /Sent\./],
		[
			'no continue pause',
			(s) => swap(s, 'input("\\nPress ENTER to continue...")', ''),
			/Press ENTER to continue/
		],
		[
			'a missing pause count',
			(s) => swap(s, 'input("\\nPress ENTER to send...")', 'print("\\nPress ENTER to send...")'),
			/three input\(\) calls/
		]
	])('step 3 fails for %s', async (_label, mutate, message) => {
		const result = await check(3, mutate(REF[3]));
		expect(result.passed).toBe(false);
		expect(result.message).toMatch(message);
	});

	it.each([
		[
			'a wrong header',
			(s) => swap(s, '10:15 AM | NEXT CLASS', '10:15 AM | CLASS'),
			/Print the scene header/
		],
		['a missing option', (s) => swap(s, '2. Play Wordle', '2. Sleep'), /2\. Play Wordle/],
		['no Choose prompt', (s) => swap(s, 'Choose: """', '"""'), /Choose:/],
		[
			'no closing pause',
			(s) => removeLast(s, 'input("\\nPress ENTER to continue...")\n'),
			/closing pause|Press ENTER to continue/
		],
		[
			'identical outcomes',
			(s) =>
				swap(
					s,
					'You open Wordle with your brightness at minimum. You understand 5% of the lecture.',
					'You actually listen and learn something.'
				),
			/own outcome/
		],
		[
			'an empty outcome',
			(s) =>
				swap(
					s,
					'print("\\nYou open Wordle with your brightness at minimum. You understand 5% of the lecture.")',
					'pass'
				),
			/outcome line/
		]
	])('step 4 fails for %s', async (_label, mutate, message) => {
		const source = mutate(REF[4]);
		const result = await check(4, source);
		expect(result.passed).toBe(false);
		expect(result.message).toMatch(message);
	});

	it.each([
		['a crash without attempts', (s) => swap(s, 'attempts = 3\n', ''), /not defined/],
		['another name for attempts', (s) => s.replaceAll('attempts', 'score'), /named attempts/],
		['attempts not 3', (s) => swap(s, 'attempts = 3', 'attempts = 5'), /stay at 3/],
		[
			'no raise for lock in',
			(s) => swap(s, '    attempts = attempts + 1\n', ''),
			/raise attempts to 4/
		],
		['no bonus text', (s) => swap(s, '    print("BONUS: +1 chance for later.")\n', ''), /BONUS/],
		[
			'a bonus for everyone',
			(s) =>
				swap(
					s,
					'You open Wordle with your brightness at minimum. You understand 5% of the lecture.")',
					'You open Wordle.")\n    print("BONUS: +1 chance for later.")'
				),
			/Only Lock in/
		]
	])('step 5 fails for %s', async (_label, mutate, message) => {
		const result = await check(5, mutate(REF[5]));
		expect(result.passed).toBe(false);
		expect(result.message).toMatch(message);
	});

	it.each([
		['no exit', (s) => swap(s, '    exit()\n', ''), /exit\(\)/],
		['no death text', (s) => swap(s, '    print("YOU DIED.")\n', ''), /YOU DIED/],
		[
			'a pause after dying',
			(s) => swap(s, '    exit()\n', '    input("\\nPress ENTER to continue...")\n    exit()\n'),
			/not even the ENTER pause/
		],
		[
			'everyone dies',
			(s) =>
				swap(
					s,
					'if choice == "1":',
					'if True:\n    print("YOU DIED.")\n    exit()\nif choice == "1":'
				),
			/Only the nap/
		],
		[
			'no closing pause for survivors',
			(s) => removeLast(s, 'input("\\nPress ENTER to continue...")\n'),
			/still reach the Press ENTER/
		]
	])('step 6 fails for %s', async (_label, mutate, message) => {
		const result = await check(6, mutate(REF[6]));
		expect(result.passed).toBe(false);
		expect(result.message).toMatch(message);
	});

	it('step 6 wants Choices 1 and 2 to reach the pause', async () => {
		const source = swap(REF[6], 'input("\\nPress ENTER to continue...")\n', '').replace(
			/\n$/u,
			'\n'
		);
		const result = await check(6, source);
		expect(result.passed).toBe(false);
	});

	it.each([
		[
			'a wrong header',
			(s) => swap(s, '12:45 PM | AP', '12:45 PM | LUNCH'),
			/Print the scene header/
		],
		[
			'a missing menu',
			(s) =>
				swap(
					s,
					'1. Larp as a productive student at the library\n2. Get food with friends',
					'1. A\n2. B'
				),
			/library and food/
		],
		[
			'no roll pause',
			(s) =>
				swap(s, 'input("\\nYour fate is up to the dice. Press ENTER to roll...")', 'print("go")'),
			/press ENTER to roll/
		],
		[
			'another activity name',
			(s) =>
				swap(s, 'activity = input', 'place = input').replace('activity == "1"', 'place == "1"'),
			/named activity/
		],
		['a hard-coded roll', (s) => swap(s, 'roll = random.randint(1, 6)', 'roll = 4'), /randint/],
		[
			'another roll name',
			(s) =>
				swap(s, 'roll = random.randint(1, 6)', 'die = random.randint(1, 6)').replace(
					'{roll}',
					'{die}'
				),
			/named roll/
		],
		[
			'no result line',
			(s) => swap(s, 'print(f"You rolled a {roll}.")', 'print("rolled")'),
			/You rolled a/
		]
	])('step 7 fails for %s', async (_label, mutate, message) => {
		const source = mutate(REF[7]);
		const result = await check(7, source);
		expect(result.passed).toBe(false);
		expect(result.message).toMatch(message);
	});

	it.each([
		['no roll line', (s) => swap(s, 'print(f"You rolled a {roll}.")', ''), /roll line is missing/],
		[
			'no death on 1 (library)',
			(s) =>
				swap(
					s,
					'        print("YOU DIED.")\n        exit()\n\n    elif roll <= 3:',
					'        print("nothing")\n\n    elif roll <= 3:'
				),
			/Roll 1 should/
		],
		[
			'a pause after dying',
			(s) =>
				swap(
					s,
					'        exit()\n\n    elif roll <= 3:',
					'        input("\\nPress ENTER to continue...")\n        exit()\n\n    elif roll <= 3:'
				),
			/Nothing should run after YOU DIED/
		],
		[
			'dying on rolls above 1',
			(s) =>
				swap(
					s,
					'elif roll <= 3:\n        print("\\nYou start doomscrolling. You look up and AP is already over.")',
					'elif roll <= 3:\n        print("\\nYou start doomscrolling.")\n        exit()'
				),
			/Only roll 1/
		],
		[
			'a bonus on meh rolls',
			(s) =>
				swap(
					s,
					'You start doomscrolling. You look up and AP is already over.")',
					'You start doomscrolling.")\n        attempts = attempts + 1'
				),
			/no bonus/
		],
		[
			'no bonus on good rolls',
			(s) =>
				swap(
					s,
					'        print("\\nYou somehow actually study.")\n        print("BONUS: +1 chance for later.")\n        attempts = attempts + 1',
					'        print("\\nYou somehow actually study.")'
				),
			/Rolls 4 to 6/
		],
		[
			'no story on meh rolls',
			(s) =>
				swap(
					s,
					'        print("\\nYou start doomscrolling. You look up and AP is already over.")',
					'        pass'
				),
			/story line/
		],
		[
			'no closing pause',
			(s) => removeLast(s, 'input("\\nPress ENTER to continue...")\n'),
			/closing|Press ENTER to continue/
		],
		[
			'the same story for both places',
			(s) =>
				swap(
					swap(
						s,
						'You start doomscrolling. You look up and AP is already over.',
						'The same meh story.'
					),
					"Your friend says they know a shortcut. You end up nowhere near the restaurant and you're now hangry.",
					'The same meh story.'
				),
			/different story lines/
		]
	])('step 8 fails for %s', async (_label, mutate, message) => {
		const source = mutate(REF[8]);
		const result = await check(8, source);
		expect(result.passed).toBe(false);
		expect(result.message).toMatch(message);
	});

	it.each([
		[
			'a wrong header',
			(s) => swap(s, '4:15 PM | LAST PERIOD', '4:15 PM | HOME'),
			/Print the scene header/
		],
		[
			'no try your best pause',
			(s) => swap(s, 'input("\\nPress ENTER to try your best...")', 'print("go")'),
			/Python said|try your best/
		],
		[
			'no quiz header',
			(s) => swap(s, '----- SURPRISE QUIZ -----', '----- TEST -----'),
			/SURPRISE QUIZ header/
		],
		[
			'a fixed answer',
			(s) => swap(s, 'answer = random.randint(1, 10)', 'answer = 7'),
			/randint\(1, 10\)/
		],
		[
			'another answer name',
			(s) =>
				swap(s, 'answer = random.randint(1, 10)', 'secret = random.randint(1, 10)').replaceAll(
					'answer',
					'secret'
				),
			/named answer/
		],
		[
			'no chance count',
			(s) => swap(s, 'print(f"You have {attempts} chances to pass.")', 'print("Good luck.")'),
			/how many chances/
		],
		['no hints', (s) => swap(s, 'print("Too low.")', 'print("nope")'), /Too low/],
		[
			'another guess name',
			(s) =>
				swap(s, 'guess = int(', 'reply = int(')
					.replace('guess ==', 'reply ==')
					.replace('guess <', 'reply <'),
			/named guess/
		],
		[
			'no chances left',
			(s) => swap(s, 'print(f"Chances left: {attempts}")', 'pass'),
			/Chances left/
		],
		[
			'no break',
			(s) => swap(s, '        print("Correct!")\n        break\n', '        print("Correct!")\n'),
			/use break/
		],
		[
			'never counting down',
			(s) => swap(s, '    attempts = attempts - 1\n', ''),
			/lower attempts by 1/
		],
		[
			'a crash on guess',
			(s) => swap(s, 'int(input("\\nYour answer: "))', 'int("x")'),
			/Python said/
		],
		[
			'a correct guess that still costs a chance',
			(s) =>
				swap(
					s,
					'        print("Correct!")\n        break',
					'        print("Correct!")\n        attempts = attempts - 1\n        break'
				),
			/break out of the loop before attempts drops/
		],
		[
			'a loop that stops one guess early',
			(s) => swap(s, 'while attempts > 0:', 'while attempts > 1:'),
			/stop at Chances left: 0/
		]
	])('step 9 fails for %s', async (_label, mutate, message) => {
		const source = mutate(REF[9]);
		const result = await check(9, source);
		expect(result.passed).toBe(false);
		expect(result.message).toMatch(message);
	});

	it.each([
		[
			'no ending pause',
			(s) => swap(s, 'input("\\nPress ENTER to see how your day ends...")', 'print("...")'),
			/how your day ends/
		],
		[
			'no ending header',
			(s) => swap(s, '----- END OF THE DAY -----', '----- BYE -----'),
			/END OF THE DAY/
		],
		[
			'no survived text',
			(s) => swap(s, 'YOU SURVIVED THE DAY. You passed', 'You passed'),
			/YOU SURVIVED THE DAY/
		],
		[
			'a wrong win ending',
			(s) => swap(s, 'You passed the quiz. See you tomorrow.', 'Nice.'),
			/passed-the-quiz/
		],
		[
			'a win that also fails',
			(s) => swap(s, 'See you tomorrow.', 'See you tomorrow. You failed'),
			/passed-the-quiz/
		],
		[
			'no answer reveal',
			(s) => swap(s, 'print(f"The answer was {answer}.")', 'pass'),
			/The answer was/
		],
		['a wrong loss ending', (s) => swap(s, 'You failed the quiz.', 'Oh well.'), /failed-the-quiz/]
	])('step 10 fails for %s', async (_label, mutate, message) => {
		const source = mutate(REF[10]);
		const result = await check(10, source);
		expect(result.passed).toBe(false);
		expect(result.message).toMatch(message);
	});

	it.each([
		[
			'a crash in the new scene',
			(s) => swap(s, 'lab_choice = input(', 'lab_choice = undefined_name + input('),
			/crashed/
		],
		[
			'a lost ending',
			(s) => swap(s, 'input("\\nPress ENTER to see how your day ends...")', 'exit()'),
			/never reached END OF THE DAY/
		],
		[
			'a lost earlier scene',
			(s) => swap(s, '10:15 AM | NEXT CLASS', '10:15 AM | CLASS'),
			/10:15 AM scene went missing/
		],
		[
			'a lost survival line',
			(s) =>
				swap(
					swap(s, 'YOU SURVIVED THE DAY. You passed', 'You passed'),
					'YOU SURVIVED THE DAY. You failed',
					'You failed'
				),
			/YOU SURVIVED/
		],
		['no new scene', () => REF[10], /Add one new scene/]
	])('step 11 fails for %s', async (_label, mutate, message) => {
		const result = await check(11, mutate(REF[11]));
		expect(result.passed).toBe(false);
		expect(result.message).toMatch(message);
	});

	it('step 11 accepts a scene of the players own design', async () => {
		const own = `
print("""
----- 3:00 PM | GYM -----
""")
mood = input("Run or walk? ")
if mood == "1":
    attempts = attempts + 1
    print("You run. BONUS: +1 chance for later.")
else:
    print("You walk.")
input("\\nPress ENTER to continue...")
`;
		const source = swap(REF[10], '\n\n#4: LAST PERIOD', `${own}\n\n#4: LAST PERIOD`);
		expect(await check(11, source)).toMatchObject({ passed: true });
	});

	it('step 11 passes when the first path dies but another survives', async () => {
		const deadly = `
print("""
----- 3:00 PM | GYM -----
""")
mood = input("Run or walk? ")
if mood == "1":
    print("YOU DIED.")
    exit()
input("\\nPress ENTER to continue...")
`;
		const source = swap(REF[10], '\n\n#4: LAST PERIOD', `${deadly}\n\n#4: LAST PERIOD`);
		expect(await check(11, source)).toMatchObject({ passed: true });
	});

	it('reports a timeout or missing runtime as a crash', () => {
		const dead = { stdout: '', error: 'timeout', globals: {}, inputCount: 0 };
		for (let step = 0; step < 12; step += 1) {
			const trials = gamejamCheckTrials(step).map(() => dead);
			const result = gradeGamejamStep(step, trials, { source: '' });
			expect(result.passed).toBe(false);
			expect(result.message).toMatch(/timeout|crashed|Python said/i);
		}
	});

	it('a program written differently from the reference still passes when behaviour matches', async () => {
		const shorthand = swap(REF[5], 'attempts = attempts + 1', 'attempts += 1');
		expect(await check(5, shorthand)).toMatchObject({ passed: true });
	});

	it('runs real dice when no rolls are scripted', () => {
		const run = runPython('import random\nroll = random.randint(1, 6)\nprint(roll)\n');
		expect(run.rollCount).toBe(0);
		expect(Number(run.stdout)).toBeGreaterThanOrEqual(1);
	});
});

describe('game jam checks without a Python runtime', () => {
	it('copes with trial results that are missing fields', () => {
		expect(gradeGamejamStep(2, [{}, {}]).message).toMatch(/No input\(\)/);
		expect(gradeGamejamStep(2, [{ inputCount: 1 }, { inputCount: 1 }]).message).toMatch(/prompt/);
		expect(gradeGamejamStep(1, [{ stdout: '' }]).message).toMatch(/triple quotes/);
		expect(gradeGamejamStep(6, [{}, {}, { exited: true }]).message).toMatch(/YOU DIED/);
		expect(gradeGamejamStep(5, [{}, {}, {}]).message).toMatch(/named attempts/);
		expect(gradeGamejamStep(11, [{}, {}]).message).toMatch(/never reached END OF THE DAY/);
	});

	it('demands scripted dice were really rolled', () => {
		const roll = (activity, roll) => ({
			stdout: `----- 12:45 PM | AP -----\n1. library 2. food Your fate is up to the dice. Press ENTER to roll... You rolled a ${roll}.`,
			globals: { activity, roll },
			rollCount: undefined
		});
		expect(gradeGamejamStep(7, [roll('1', 4), roll('2', 2)]).message).toMatch(/randint/);
		const quiz = {
			stdout:
				'----- 4:15 PM | LAST PERIOD -----\nPress ENTER to try your best...\n----- SURPRISE QUIZ -----',
			globals: { answer: 7 },
			rollCount: undefined
		};
		expect(gradeGamejamStep(9, [quiz, quiz]).message).toMatch(/randint\(1, 10\)/);
		const noPause = {
			...quiz,
			stdout: '----- 4:15 PM | LAST PERIOD -----\n----- SURPRISE QUIZ -----'
		};
		expect(gradeGamejamStep(9, [noPause, noPause]).message).toMatch(/try your best/);
	});

	it('checks the losing quiz round carries attempts down to zero', () => {
		const win = {
			stdout:
				'----- 4:15 PM | LAST PERIOD -----\nPress ENTER to try your best...\n----- SURPRISE QUIZ -----\nYou have 4 chances to pass.\nToo low. Chances left: 3 Too high. Chances left: 2 Correct!',
			globals: { answer: 7, guess: 7, attempts: 2 },
			rollCount: 2
		};
		const lose = {
			stdout:
				'Too low. Chances left: 3 Too low. Chances left: 2 Too low. Chances left: 1 Too low. Chances left: 0',
			globals: { attempts: 1 },
			rollCount: 2
		};
		expect(gradeGamejamStep(9, [win, lose]).message).toMatch(/reach 0/);
		expect(gradeGamejamStep(9, [win, { ...lose, globals: { attempts: 0 } }]).passed).toBe(true);
	});

	it('grades hand-built trial results', () => {
		expect(
			gradeGamejamStep(0, [{ stdout: '----- 8:00 AM | GETTING TO SCHOOL -----\n' }]).passed
		).toBe(true);
		expect(gradeGamejamStep(0, [undefined], {}).passed).toBe(false);
		expect(gradeGamejamStep(0, [{ stdout: 'Game loaded\n' }], {}).message).toMatch(/Game loaded/);
		expect(gradeGamejamStep(0, [{ stdout: 'x\n', error: 'boom' }]).message).toMatch(/boom/);
		expect(
			gradeGamejamStep(0, [{ stdout: 'x', error: 'EOF when reading a line' }]).message
		).toMatch(/more input\(\) answers/);
	});
});
