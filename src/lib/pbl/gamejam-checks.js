import { GAMEJAM_STARTER_SOURCE } from './gamejam-workshop.js';

/**
 * @typedef {{
 *   stdout?: string,
 *   stderr?: string,
 *   error?: string | null,
 *   globals?: Record<string, unknown>,
 *   files?: Record<string, string>,
 *   inputCount?: number,
 *   exited?: boolean,
 *   rollCount?: number
 * }} PythonRunResult
 *
 * @typedef {{ passed: boolean, message: string }} CheckResult
 */

const EXCUSE_A = 'my cat ate my alarm';
const EXCUSE_B = 'aliens borrowed my bike';
const ANSWER = 7;

/**
 * Stdin for the opening of the game: the excuse, then the "send" and "continue" pauses.
 * @param {string} excuse
 */
function opening(excuse) {
	return [excuse, '', ''];
}

/**
 * Stdin from the opening through scene 2 (choice, then its ENTER pause).
 * @param {string} excuse
 * @param {string} choice
 */
function throughScene2(excuse, choice) {
	return [...opening(excuse), choice, ''];
}

/**
 * Stdin through scene 3 (activity, roll pause, and the pause after the outcome).
 * @param {string} activity
 */
function throughScene3(activity) {
	return [...throughScene2(EXCUSE_A, '2'), activity, '', ''];
}

/**
 * Stdin through the quiz intro (the "try your best" pause), guesses left to the caller.
 * @param {string} activity
 */
function throughQuizIntro(activity) {
	return [...throughScene3(activity), ''];
}

/** @param {string} text */
function norm(text) {
	return String(text).toLowerCase().replace(/\s+/gu, ' ').trim();
}

/** @param {PythonRunResult | undefined} trial */
function crashed(trial) {
	return Boolean(trial?.error);
}

/** @param {PythonRunResult | undefined} trial */
function stdoutOf(trial) {
	return trial && typeof trial.stdout === 'string' ? trial.stdout : '';
}

/** @param {PythonRunResult | undefined} trial */
function globalsOf(trial) {
	return trial && trial.globals && typeof trial.globals === 'object' ? trial.globals : {};
}

/** @param {PythonRunResult | undefined} trial */
function inputCountOf(trial) {
	return trial && typeof trial.inputCount === 'number' ? trial.inputCount : 0;
}

/** @param {string} haystack @param {string} needle */
function has(haystack, needle) {
	return norm(haystack).includes(norm(needle));
}

/** @param {string} haystack @param {string} needle */
function indexOf(haystack, needle) {
	return norm(haystack).indexOf(norm(needle));
}

/** @param {string} haystack @param {string} needle */
function countOf(haystack, needle) {
	const text = norm(haystack);
	const target = norm(needle);
	let count = 0;
	let from = text.indexOf(target);
	while (from !== -1) {
		count += 1;
		from = text.indexOf(target, from + target.length);
	}
	return count;
}

/**
 * Normalized text after the last occurrence of a marker. Callers only ask once they
 * know the marker is there.
 * @param {string} haystack @param {string} needle
 */
function after(haystack, needle) {
	return String(norm(haystack).split(norm(needle)).at(-1)).trim();
}

/**
 * The story text between a marker and the next Press ENTER prompt.
 * @param {string} stdout @param {string} marker
 */
function storyAfter(stdout, marker) {
	const rest = after(stdout, marker);
	const end = rest.indexOf('press enter');
	return (end === -1 ? rest : rest.slice(0, end)).trim();
}

/** @param {string} stdout @param {string} time @param {string} place */
function hasHeader(stdout, time, place) {
	return stdout.split('\n').some((line) => {
		const text = norm(line);
		return (
			/^-{3,}/u.test(text) &&
			text.includes('|') &&
			text.includes(norm(time)) &&
			text.includes(norm(place))
		);
	});
}

/** @param {string} stdout */
function pipeHeaders(stdout) {
	return new Set(
		stdout
			.split('\n')
			.map((line) => norm(line))
			.filter((line) => /^-{3,}.+\|.+-{3,}$/u.test(line))
	);
}

/** @param {unknown} value */
function asNumber(value) {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}

/** @param {string} message */
function fail(message) {
	return { passed: false, message };
}

/** @param {string} message */
function pass(message) {
	return { passed: true, message };
}

/**
 * @param {PythonRunResult | undefined} trial
 * @param {string} fallback
 * @returns {string | null} a failure message when the trial crashed
 */
function crashMessage(trial, fallback) {
	if (!trial) return fallback;
	if (!crashed(trial)) return null;
	const error = String(trial.error);
	if (ranOutOfInput(trial)) {
		return 'The game asked for more input() answers than the console holds. Keep the ENTER pauses exactly as the step lists them. A blank line in the console is one ENTER. An extra input() with no line left looks like a crash.';
	}
	if (/name 'random' is not defined/iu.test(error)) {
		return `${fallback} import random is missing. Add import random at the top of the file, before any scene. Python said: ${error}`;
	}
	if (/name 'attempts' is not defined/iu.test(error)) {
		return `${fallback} attempts is used before it exists. Put attempts = 3 at the very top of the file, above every scene. Python said: ${error}`;
	}
	if (/NameError|is not defined/iu.test(error)) {
		return `${fallback} A name in the program is not defined yet. Check the spelling. excuse, choice, attempts, activity, roll, answer, and guess have to be those exact words. Python said: ${error}`;
	}
	if (/SyntaxError|invalid syntax|unexpected indent|expected an indented/iu.test(error)) {
		return `${fallback} The program has a syntax error. Check quotes, the colon at the end of if and while, and indentation inside the branch. Python said: ${error}`;
	}
	if (/not supported between instances of 'str' and 'int'/iu.test(error)) {
		return `${fallback} A comparison is mixing text from input() with a number. Wrap the answer in int(), as in guess = int(input("Your answer: ")). Python said: ${error}`;
	}
	return `${fallback} Python said: ${error}`;
}

/**
 * Why a required ----- time | place ----- line is absent.
 * Call only after hasHeader is false.
 * @param {string} stdout
 * @param {string} time
 * @param {string} place
 * @param {boolean} [keep]
 */
function headerIssue(stdout, time, place, keep = false) {
	const lines = String(stdout).split('\n');
	const lead = keep ? 'Keep the header' : 'Print the header';
	const example = `----- ${time} | ${place} -----`;
	const dashed = lines.filter((line) => /^\s*-{3,}/u.test(line));
	if (dashed.some((line) => has(line, time) && !has(line, place))) {
		return `${lead}: the ${time} line is missing the place ${place}. Use ${example}.`;
	}
	if (dashed.some((line) => has(line, place) && !has(line, time))) {
		return `${lead}: the place ${place} is there, but the time must be ${time}. Use ${example}.`;
	}
	if (lines.some((line) => has(line, time) && has(line, place))) {
		return `${lead}: ${time} and ${place} must be on a header line that starts and ends with dashes and has a | bar. Use ${example}.`;
	}
	if (lines.some((line) => has(line, time))) {
		return `${lead}: a line mentions ${time}, but the header also needs dashes, a | bar, and ${place}. Use ${example}.`;
	}
	const sample = lines.map((line) => line.trim()).find(Boolean);
	if (sample) {
		return `${lead}: dashes, ${time}, a | bar, then ${place}. Use ${example}. The program printed "${sample.slice(0, 80)}" instead.`;
	}
	return `${lead}: dashes, ${time}, a | bar, then ${place}. Use ${example}.`;
}

/**
 * @param {string} stdout
 * @param {string} time
 * @param {string} place
 * @returns {string | null}
 */
function missingScene(stdout, time, place) {
	if (hasHeader(stdout, time, place)) return null;
	return `The ${time} | ${place} scene is missing. Keep that header in the program. Add the new scene after it. Do not start a new file.`;
}

/**
 * @param {string} stdout
 * @param {number} needed
 * @returns {string | null}
 */
function continuePauseMessage(stdout, needed) {
	const have = countOf(stdout, 'press enter to continue');
	if (have >= needed) return null;
	const phrase = 'Press ENTER to continue...';
	if (have === 0) {
		return `Add a pause whose prompt is ${phrase} at the end of this scene. The program has none. Earlier scenes use that same pause, so a different sentence does not count.`;
	}
	return `This step needs ${needed} pauses that say ${phrase}. The program has ${have}. The email scene uses one, the 10:15 AM scene uses one, and the dice scene uses one. Add the missing pause at the end of the new scene, and keep the earlier ones.`;
}

/** @param {PythonRunResult | undefined} trial */
function ranOutOfInput(trial) {
	return crashed(trial) && /EOF/iu.test(String(trial?.error));
}

/** @param {PythonRunResult[]} trials @param {string} fallback */
function firstCrash(trials, fallback) {
	for (const trial of trials) {
		const message = crashMessage(trial, fallback);
		if (message) return message;
	}
	return null;
}

/**
 * @param {PythonRunResult[]} trials
 * @param {{ source?: string }} context
 */
function gradeStep0(trials, context) {
	const trial = trials[0];
	const crash = crashMessage(
		trial,
		'The program crashed before it printed. Fix the error, then Run again.'
	);
	if (crash) return fail(crash);
	const output = stdoutOf(trial).trim();
	if (!output) return fail('Nothing printed. Add a print(...) call with the scene header.');
	if (
		output === 'Game loaded' ||
		String(context.source ?? '').trim() === GAMEJAM_STARTER_SOURCE.trim()
	) {
		return fail('Still printing "Game loaded". Replace it with the scene header, then Run again.');
	}
	if (!hasHeader(output, '8:00 AM', 'GETTING TO SCHOOL')) {
		return fail(headerIssue(output, '8:00 AM', 'GETTING TO SCHOOL'));
	}
	if (output.split('\n').filter((line) => line.trim()).length !== 1) {
		return fail(
			'Print exactly one line: the scene header. Anything besides ----- 8:00 AM | GETTING TO SCHOOL ----- has to go. This step is only that header.'
		);
	}
	return pass('The first scene header prints and the starter text is gone.');
}

/**
 * @param {PythonRunResult[]} trials
 * @param {{ source?: string }} context
 */
function gradeStep1(trials, context) {
	const trial = trials[0];
	const crash = crashMessage(
		trial,
		'The program crashed. Check the quotes around your multi-line strings.'
	);
	if (crash) return fail(crash);
	const output = stdoutOf(trial);
	const lines = output.split('\n');
	const source = String(context.source ?? '');
	if (!source.includes('"""') && !source.includes("'''")) {
		return fail(
			'Use triple quotes (""") so the scene header and the narration span several lines.'
		);
	}
	const headerAt = lines.findIndex(
		(line) => /^\s*-{3,}/u.test(line) && has(line, '8:00 AM') && has(line, 'GETTING TO SCHOOL')
	);
	if (headerAt === -1) {
		return fail(headerIssue(output, '8:00 AM', 'GETTING TO SCHOOL', true));
	}
	const headerLines = lines.filter(
		(line) => has(line, '8:00 AM') && has(line, 'GETTING TO SCHOOL') && /-{3,}/u.test(line)
	);
	if ((headerAt === 0 || lines[headerAt - 1].trim() !== '') && headerLines.length > 1) {
		return fail(
			'The one-line print from the previous step is still first, so that header has no blank line above it. Delete the old print and keep the triple-quoted block.'
		);
	}
	if (headerAt === 0 || lines[headerAt - 1].trim() !== '') {
		return fail(
			'Put a blank line above the header. A triple-quoted string that starts on a new line does it.'
		);
	}
	const wakeAt = lines.findIndex((line) => has(line, '8:07'));
	const emailAt = lines.findIndex((line) => has(line, 'email'));
	if (wakeAt === -1 || !has(output, '8:15')) {
		return fail('The narration should mention it is 8:07 AM and that you have an 8:15 AM class.');
	}
	if (emailAt === -1 || emailAt <= wakeAt) {
		return fail('Finish the narration on a second line: Time to email your prof.');
	}
	return pass('Header block and two-line narration print as a scene.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep2(trials) {
	const crash = firstCrash(trials, 'The program crashed. Ask with input() and store the answer.');
	if (crash) return fail(crash);
	const excuses = [EXCUSE_A, EXCUSE_B];
	for (let i = 0; i < excuses.length; i += 1) {
		const trial = trials[i];
		if (inputCountOf(trial) < 1) {
			return fail('No input() call found. Ask the player for an excuse with input().');
		}
		if (!has(stdoutOf(trial), 'excuse')) {
			return fail('Show the prompt Enter your goofy excuse: when you ask.');
		}
		const stored = Object.values(globalsOf(trial)).some((value) => value === excuses[i]);
		if (!stored) {
			return fail(
				'Store what the player types in a variable named excuse, for example excuse = input(...).'
			);
		}
	}
	if (globalsOf(trials[0]).excuse !== EXCUSE_A) {
		const foundName = Object.entries(globalsOf(trials[0])).find(
			([, value]) => value === EXCUSE_A
		)[0];
		return fail(
			`Name the variable excuse so later steps can use it. It is stored in ${foundName} instead. Python names are case-sensitive, so Excuse does not count.`
		);
	}
	return pass('The typed excuse is stored in excuse.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep3(trials) {
	const crash = firstCrash(
		trials,
		'The program crashed. Build the email with an f-string and add the two pauses.'
	);
	if (crash) return fail(crash);
	const excuses = [EXCUSE_A, EXCUSE_B];
	for (let i = 0; i < excuses.length; i += 1) {
		const output = stdoutOf(trials[i]);
		const email = output.split('\n').find((line) => has(line, 'hi professor'));
		if (!email) {
			return fail("Print the email: Hi Professor, I can't make it to class today because ... .");
		}
		if (!has(email, excuses[i])) {
			return fail(
				'Put the excuse variable inside the email with an f-string, so it shows what the player typed.'
			);
		}
		if (i > 0 && has(email, excuses[0])) {
			return fail(
				'The email should change with each excuse. Use {excuse} inside an f-string instead of typing one in.'
			);
		}
		if (!has(email, 'because')) {
			return fail(
				'The email should say it cannot make it to class today because and then the excuse.'
			);
		}
		const send = indexOf(output, 'press enter to send');
		const sent = indexOf(output, 'sent.');
		const cont = indexOf(output, 'press enter to continue');
		if (send === -1) return fail('Add a pause with the prompt Press ENTER to send...');
		if (sent === -1 || sent < send) return fail('After the send pause, print the line Sent.');
		if (cont === -1 || cont < sent)
			return fail('Add a second pause with the prompt Press ENTER to continue...');
		if (inputCountOf(trials[i]) < 3) {
			return fail('The excuse and the two ENTER pauses are three input() calls. One is missing.');
		}
	}
	return pass('The email uses the typed excuse and both pauses run.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep4(trials) {
	const crash = firstCrash(
		trials,
		'The program crashed. Check the indentation of your if / elif / else.'
	);
	if (crash) return fail(crash);
	const outcomes = [];
	for (const trial of trials) {
		const output = stdoutOf(trial);
		const morning = missingScene(output, '8:00 AM', 'GETTING TO SCHOOL');
		if (morning) return fail(morning);
		if (!hasHeader(output, '10:15 AM', 'NEXT CLASS')) {
			return fail(headerIssue(output, '10:15 AM', 'NEXT CLASS'));
		}
		for (const option of ['1. Lock in', '2. Play Wordle', '3. Take a quick nap']) {
			if (!has(output, option)) return fail(`The menu is missing the option "${option}".`);
		}
		if (!has(output, 'choose:')) return fail('End the menu with the prompt Choose: .');
		const pause = continuePauseMessage(output, 2);
		if (pause) return fail(pause);
		outcomes.push(storyAfter(output, 'choose:'));
	}
	if (outcomes.some((text) => !text)) {
		return fail('Every choice should print an outcome line before the pause.');
	}
	if (new Set(outcomes).size !== outcomes.length) {
		return fail('Each choice needs its own outcome. Two of the options printed the same text.');
	}
	return pass('Three choices, three different outcomes, then the pause.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep5(trials) {
	const crash = firstCrash(
		trials,
		'The program crashed. Add attempts = 3 at the top and update it inside the Lock in branch.'
	);
	if (crash) return fail(crash);
	const [lockIn, wordle, nap] = trials;
	if (asNumber(globalsOf(wordle).attempts) === null) {
		return fail(
			'Create a variable named attempts equal to 3 at the very top of the file. Setting it only inside the Lock in branch leaves Wordle and the nap without it. Other names, such as score or lives, do not count.'
		);
	}
	if (asNumber(globalsOf(wordle).attempts) !== 3 || asNumber(globalsOf(nap).attempts) !== 3) {
		return fail('attempts should stay at 3 unless the player locks in.');
	}
	if (asNumber(globalsOf(lockIn).attempts) !== 4) {
		return fail('Choosing 1 (Lock in) should raise attempts to 4. Use attempts = attempts + 1.');
	}
	if (!has(stdoutOf(lockIn), 'bonus: +1 chance for later')) {
		return fail('Choosing Lock in should print BONUS: +1 chance for later.');
	}
	if (has(stdoutOf(wordle), 'bonus') || has(stdoutOf(nap), 'bonus')) {
		return fail('Only Lock in earns the bonus. The other choices should not print BONUS.');
	}
	return pass('Lock in adds one attempt and prints the bonus. The rest do not.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep6(trials) {
	const crash = firstCrash(
		trials,
		'The program crashed. Print YOU DIED. and call exit() inside the nap branch.'
	);
	if (crash) return fail(crash);
	const [lockIn, wordle, nap] = trials;
	if (!nap.exited) {
		return fail(
			'Choosing 3 (nap) should end the program with exit() right after YOU DIED. exit() at the bottom of the file also stops Lock in and Wordle, so it belongs inside the nap branch only.'
		);
	}
	if (!has(stdoutOf(nap), 'you died.')) {
		return fail('Print YOU DIED. in the nap branch before you call exit().');
	}
	if (has(after(stdoutOf(nap), 'you died.'), 'press enter')) {
		return fail('Nothing should run after YOU DIED., not even the ENTER pause.');
	}
	for (const survivor of [lockIn, wordle]) {
		if (survivor.exited || has(stdoutOf(survivor), 'you died')) {
			return fail('Only the nap should end the game. Choices 1 and 2 must keep going.');
		}
		const pause = continuePauseMessage(stdoutOf(survivor), 2);
		if (pause) {
			return fail(
				`Choices 1 and 2 should still reach the Press ENTER to continue... pause. ${pause}`
			);
		}
	}
	return pass('The nap ends the game. The other choices carry on.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep7(trials) {
	const crash = firstCrash(
		trials,
		'The program crashed. Import random at the top and roll with random.randint(1, 6).'
	);
	if (crash) return fail(crash);
	const scenarios = [
		{ trial: trials[0], activity: '1', roll: 4 },
		{ trial: trials[1], activity: '2', roll: 2 }
	];
	for (const { trial, activity, roll } of scenarios) {
		const output = stdoutOf(trial);
		const morning = missingScene(output, '8:00 AM', 'GETTING TO SCHOOL');
		if (morning) return fail(morning);
		const nextClass = missingScene(output, '10:15 AM', 'NEXT CLASS');
		if (nextClass) return fail(nextClass);
		if (!hasHeader(output, '12:45 PM', 'AP')) {
			return fail(headerIssue(output, '12:45 PM', 'AP'));
		}
		if (!has(output, 'library') || !has(output, 'food')) {
			return fail('The menu should offer the library and food with friends as options 1 and 2.');
		}
		if (!has(output, 'press enter to roll')) {
			return fail('Ask the player to press ENTER to roll before the die is thrown.');
		}
		if (asNumber(globalsOf(trial).activity) !== Number(activity)) {
			return fail('Store the menu answer in a variable named activity.');
		}
		if ((trial.rollCount ?? 0) < 1) {
			return fail(
				'Roll with random.randint(1, 6) instead of a fixed number. Remove any roll = 4 you typed by hand.'
			);
		}
		if (asNumber(globalsOf(trial).roll) !== roll) {
			return fail('Store the die result in a variable named roll.');
		}
		if (!has(output, `you rolled a ${roll}`)) {
			return fail('Print the result with an f-string: You rolled a followed by the number.');
		}
	}
	return pass('The die is rolled with randint and the result is announced.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep8(trials) {
	const crash = firstCrash(
		trials,
		'The program crashed. Check the indentation of your nested if blocks.'
	);
	if (crash) return fail(crash);
	const scenarios = trials.map((trial, index) => ({
		trial,
		activity: index < 3 ? 'library' : 'food',
		roll: [1, 3, 5][index % 3]
	}));
	/** @type {Record<string, string>} */
	const stories = {};
	for (const { trial, activity, roll } of scenarios) {
		const output = stdoutOf(trial);
		const marker = `you rolled a ${roll}.`;
		const where = `${activity}, roll ${roll}`;
		for (const [time, place] of [
			['8:00 AM', 'GETTING TO SCHOOL'],
			['10:15 AM', 'NEXT CLASS'],
			['12:45 PM', 'AP']
		]) {
			const gone = missingScene(output, time, place);
			if (gone) return fail(gone);
		}
		if (!has(output, marker))
			return fail(`The roll line is missing (${where}). Keep printing You rolled a ${roll}.`);
		const story = storyAfter(output, marker);
		if (roll === 1) {
			if (!trial.exited || !has(after(output, marker), 'you died.')) {
				return fail(`Roll 1 should print YOU DIED. and call exit() (${where}).`);
			}
			if (has(after(output, 'you died.'), 'press enter')) {
				return fail(`Nothing should run after YOU DIED. (${where}).`);
			}
			stories[`${activity}${roll}`] = story;
			continue;
		}
		if (trial.exited) return fail(`Only roll 1 ends the game (${where}).`);
		if (!story || story.startsWith('bonus')) {
			return fail(`Print a story line for this outcome before any bonus (${where}).`);
		}
		const attempts = asNumber(globalsOf(trial).attempts);
		if (roll === 3) {
			if (has(after(output, marker), 'bonus') || attempts !== 3) {
				return fail(`Rolls 2 to 3 are meh: no bonus and attempts stays the same (${where}).`);
			}
		} else if (!has(after(output, marker), 'bonus: +1 chance for later') || attempts !== 4) {
			return fail(
				`Rolls 4 to 6 print BONUS: +1 chance for later. and add 1 to attempts (${where}).`
			);
		}
		const pause = continuePauseMessage(output, 3);
		if (pause) return fail(`${pause} (${where}).`);
		stories[`${activity}${roll}`] = story;
	}
	for (const roll of [1, 3, 5]) {
		if (stories[`library${roll}`] === stories[`food${roll}`]) {
			return fail(`The library and food should have different story lines (roll ${roll} matched).`);
		}
	}
	return pass('Every place and roll range branches to its own outcome.');
}

/** @param {PythonRunResult[]} trials */
/** @param {PythonRunResult[]} trials @param {{ source?: string }} [context] */
function gradeStep9(trials, context = {}) {
	const [win, lose] = trials;
	const source = String(context.source ?? '');
	// Running out of scripted guesses means the loop did not stop when it should have.
	if (ranOutOfInput(win) && has(stdoutOf(win), 'correct!')) {
		return fail('After Correct! use break so the loop stops as soon as the guess is right.');
	}
	if (ranOutOfInput(lose) && /while\s+True\b/u.test(source)) {
		return fail(
			'The loop is while True, so it never stops on its own. Use while attempts > 0, and lower attempts by 1 on each miss.'
		);
	}
	if (ranOutOfInput(lose)) {
		return fail(
			'Every wrong guess must lower attempts by 1, or the loop never ends. Use while attempts > 0, then attempts = attempts - 1 inside the miss branch.'
		);
	}
	const crash = firstCrash(
		trials,
		'The program crashed. Convert the guess with int(input(...)) and check the while loop.'
	);
	if (crash) return fail(crash);
	const output = stdoutOf(win);
	for (const [time, place] of [
		['8:00 AM', 'GETTING TO SCHOOL'],
		['10:15 AM', 'NEXT CLASS'],
		['12:45 PM', 'AP']
	]) {
		const gone = missingScene(output, time, place);
		if (gone) return fail(gone);
	}
	if (!hasHeader(output, '4:15 PM', 'LAST PERIOD')) {
		return fail(headerIssue(output, '4:15 PM', 'LAST PERIOD'));
	}
	if (!has(output, 'press enter to try your best')) {
		return fail('Add the pause Press ENTER to try your best... before the quiz.');
	}
	if (!output.split('\n').some((line) => /^\s*-{3,}/u.test(line) && has(line, 'surprise quiz'))) {
		return fail('Print the SURPRISE QUIZ header: dashes, SURPRISE QUIZ, dashes.');
	}
	if ((win.rollCount ?? 0) < 2) {
		return fail('Pick the answer with random.randint(1, 10), not a fixed number.');
	}
	if (asNumber(globalsOf(win).answer) !== ANSWER) {
		return fail('Store the secret number in a variable named answer.');
	}
	if (!has(output, 'you have 4 chances')) {
		return fail(
			'Tell the player how many chances they have with an f-string, for example You have {attempts} chances to pass.'
		);
	}
	const low = indexOf(output, 'too low.');
	const high = indexOf(output, 'too high.');
	const right = indexOf(output, 'correct!');
	if (low === -1 || high === -1 || right === -1 || !(low < high && high < right)) {
		return fail(
			'Print Too low. for a small guess, Too high. for a big one, and Correct! for the answer.'
		);
	}
	if (asNumber(globalsOf(win).guess) !== ANSWER) {
		return fail('Store each guess in a variable named guess.');
	}
	if (!has(output, 'chances left: 3') || !has(output, 'chances left: 2')) {
		return fail(
			'After each wrong guess, lower attempts by 1 and print Chances left: and the number.'
		);
	}
	if (has(output, 'chances left: 1') || asNumber(globalsOf(win).attempts) !== 2) {
		return fail('A correct guess should break out of the loop before attempts drops again.');
	}
	const missOutput = stdoutOf(lose);
	if (countOf(missOutput, 'too low.') !== 4 || !has(missOutput, 'chances left: 0')) {
		return fail('With four wrong guesses the loop should stop at Chances left: 0.');
	}
	if (asNumber(globalsOf(lose).attempts) !== 0) {
		return fail('attempts should reach 0 when every guess is wrong.');
	}
	return pass('The quiz loop hints, counts chances, and stops on a correct guess.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep10(trials) {
	const crash = firstCrash(trials, 'The program crashed. Check the ending after the while loop.');
	if (crash) return fail(crash);
	const [win, lose] = trials;
	for (const trial of trials) {
		const output = stdoutOf(trial);
		if (!has(output, 'press enter to see how your day ends')) {
			return fail('Add the pause Press ENTER to see how your day ends... after the loop.');
		}
		if (!has(output, 'end of the day')) return fail('Print the END OF THE DAY header.');
		if (!has(after(output, 'end of the day'), 'you survived the day')) {
			return fail('Both endings should print YOU SURVIVED THE DAY.');
		}
	}
	const won = after(stdoutOf(win), 'end of the day');
	if (has(won, 'you failed')) {
		return fail(
			'A right guess should print the passed-the-quiz ending and See you tomorrow. This ending also says you failed. Save the failed ending for the else branch.'
		);
	}
	if (!has(won, 'you passed the quiz') || !has(won, 'see you tomorrow')) {
		return fail(
			'A right guess should print the passed-the-quiz ending and See you tomorrow. The line is YOU SURVIVED THE DAY. You passed the quiz. See you tomorrow.'
		);
	}
	const lost = after(stdoutOf(lose), 'end of the day');
	if (!has(lost, `the answer was ${ANSWER}`)) {
		return fail('A wrong last guess should print The answer was and the answer.');
	}
	if (has(lost, 'you passed')) {
		return fail(
			'A wrong last guess should print the failed-the-quiz ending. This branch also says you passed. Use YOU SURVIVED THE DAY. You failed the quiz. Don\'t check Omnivox tonight... only in the else.'
		);
	}
	if (!has(lost, 'you failed the quiz')) {
		return fail(
			'A wrong last guess should print the failed-the-quiz ending: YOU SURVIVED THE DAY. You failed the quiz. Don\'t check Omnivox tonight...'
		);
	}
	return pass('Both endings print from the state the loop left behind.');
}

/** @param {PythonRunResult[]} trials */
function gradeStep11(trials) {
	const crash = firstCrash(
		trials,
		'The program crashed. Run your new scene on its own to find the error.'
	);
	if (crash) return fail(crash);
	const finished = trials.filter((trial) => has(stdoutOf(trial), 'end of the day'));
	if (finished.length === 0) {
		return fail(
			'The game never reached END OF THE DAY. Keep the earlier scenes and the ending working.'
		);
	}
	for (const trial of finished) {
		const output = stdoutOf(trial);
		for (const [time, place] of [
			['8:00 AM', 'GETTING TO SCHOOL'],
			['10:15 AM', 'NEXT CLASS'],
			['12:45 PM', 'AP'],
			['4:15 PM', 'LAST PERIOD']
		]) {
			if (!hasHeader(output, time, place)) {
				return fail(`The ${time} scene went missing. Keep every earlier scene.`);
			}
		}
		if (!has(after(output, 'end of the day'), 'you survived the day')) {
			return fail('The day should still end with YOU SURVIVED THE DAY.');
		}
	}
	const mostHeaders = Math.max(...trials.map((trial) => pipeHeaders(stdoutOf(trial)).size));
	if (mostHeaders < 5) {
		return fail('Add one new scene with a header like ----- 2:30 PM | CHEM LAB -----.');
	}
	return pass('Your new scene runs and the day still ends.');
}

const GRADERS = [
	gradeStep0,
	gradeStep1,
	gradeStep2,
	gradeStep3,
	gradeStep4,
	gradeStep5,
	gradeStep6,
	gradeStep7,
	gradeStep8,
	gradeStep9,
	gradeStep10,
	gradeStep11
];

/**
 * Deterministic trials for a step. `stdin` scripts every input() in order, one
 * line each (ENTER pauses are empty lines). `rolls` scripts the values that
 * random.randint hands out, in call order, so dice never change the result.
 *
 * @param {number} stepId
 * @returns {Array<{ stdin?: string[], rolls?: number[] }>}
 */
export function gamejamCheckTrials(stepId) {
	const choices = ['1', '2', '3'];
	switch (stepId) {
		case 2:
			return [{ stdin: [EXCUSE_A] }, { stdin: [EXCUSE_B] }];
		case 3:
			return [{ stdin: opening(EXCUSE_A) }, { stdin: opening(EXCUSE_B) }];
		case 4:
		case 5:
		case 6:
			return choices.map((choice) => ({ stdin: throughScene2(EXCUSE_A, choice) }));
		case 7:
			return [
				{ stdin: [...throughScene2(EXCUSE_A, '2'), '1', ''], rolls: [4] },
				{ stdin: [...throughScene2(EXCUSE_A, '2'), '2', ''], rolls: [2] }
			];
		case 8:
			return ['1', '2'].flatMap((activity) =>
				[1, 3, 5].map((roll) => ({ stdin: throughScene3(activity), rolls: [roll] }))
			);
		case 9:
			return [
				{ stdin: [...throughQuizIntro('1'), '5', '9', String(ANSWER)], rolls: [4, ANSWER] },
				{ stdin: [...throughQuizIntro('1'), '1', '1', '1', '1'], rolls: [4, ANSWER] }
			];
		case 10:
			return [
				{ stdin: [...throughQuizIntro('1'), '5', '9', String(ANSWER), ''], rolls: [4, ANSWER] },
				{ stdin: [...throughQuizIntro('1'), '1', '1', '1', '1', ''], rolls: [4, ANSWER] }
			];
		case 11:
			// Unknown new scene: the excuse, then "1" (a valid answer to almost any prompt),
			// and again with "2", so at least one path survives a scene that can kill.
			return [
				{ stdin: [EXCUSE_A, ...Array(60).fill('1')], rolls: [4, 3, 3, 3] },
				{ stdin: [EXCUSE_B, ...Array(60).fill('2')], rolls: [4, 3, 3, 3] }
			];
		default:
			return [{}];
	}
}

/**
 * @param {number} stepId
 * @param {PythonRunResult[]} trials
 * @param {{ source?: string }} [context]
 * @returns {CheckResult}
 */
export function gradeGamejamStep(stepId, trials, context = {}) {
	const grader = GRADERS[stepId];
	if (!grader) return fail('Unknown step id.');
	return grader(trials, context);
}

/**
 * @param {{
 *   run: (code: string, trial?: { stdin?: string[], rolls?: number[] }) => Promise<PythonRunResult>
 * }} host
 * @param {number} stepId
 * @param {string} source
 */
export async function runGamejamCheck(host, stepId, source) {
	const trials = [];
	for (const trial of gamejamCheckTrials(stepId)) {
		trials.push(await host.run(source, trial));
	}
	return gradeGamejamStep(stepId, trials, { source });
}
