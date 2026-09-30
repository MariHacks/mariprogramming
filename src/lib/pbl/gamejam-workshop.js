export const GAMEJAM_STARTER_SOURCE = 'print("Game loaded")\n';
export const GAMEJAM_START_ATTEMPTS = 3;
export const GAMEJAM_QUIZ_MAX = 10;

/**
 * @typedef {{
 *   id: number,
 *   title: string,
 *   minutes: number,
 *   body: string,
 *   starter?: string,
 *   notes?: readonly string[],
 *   outputNotes?: readonly string[],
 *   hints: readonly string[],
 *   stretch?: string
 * }} GamejamStep
 */

/** @type {readonly GamejamStep[]} */
export const GAMEJAM_STEPS = Object.freeze([
	Object.freeze({
		id: 0,
		title: 'Get something running',
		minutes: 3,
		body: `Welcome to your game jam! Today your team builds a tiny text adventure about surviving one very chaotic school day, and every step adds a new scene on top of the last one. Press Run once to see the starter \`print\`, then swap its text for the first scene header, ----- 8:00 AM | GETTING TO SCHOOL -----, and Run again.

This step just makes sure the shared editor and Run button work for your whole team. Your code carries into every next step, so by the end you will have a real game you can play (and maybe die in).`,
		starter: GAMEJAM_STARTER_SOURCE,
		outputNotes: Object.freeze([
			'Exactly one line',
			'The scene header: dashes, the time 8:00 AM, a | bar, then GETTING TO SCHOOL',
			'Not the starter text'
		]),
		hints: Object.freeze([
			'Swap the starter sentence for the scene header, then Run. Leaving the starter text does not move you on.',
			'The header is just text inside the quotes: `print`("----- TIME | PLACE -----")',
			'print("----- 8:00 AM | GETTING TO SCHOOL -----")'
		])
	}),
	Object.freeze({
		id: 1,
		title: 'Set the scene',
		minutes: 5,
		body: `It is 8:07 AM. You just woke up. Class started in 8 minutes. Time to set the scene! Turn your header into a block with \`triple quotes\` so it gets breathing room (a blank line above and below), then add a second \`print\` with the wake-up narration: it is 8:07 AM, you have an 8:15 AM class, you are NOT making it, so it is time to email your prof.

A \`triple quotes\` string keeps every line break exactly where you typed it, so you can lay a scene out like a movie script. Split the narration over two lines for extra drama.`,
		outputNotes: Object.freeze([
			'A blank line, then the scene header, then a blank line',
			'Then two lines of narration',
			'The narration mentions 8:07 AM, the 8:15 AM class and emailing your prof'
		]),
		notes: Object.freeze([
			'A line that starts with # is a comment. Python ignores it, so use one to label each scene, for example #1 : WAKING UP LATE'
		]),
		hints: Object.freeze([
			'Wrap the header and the narration in triple quotes so the line breaks stay where you typed them.',
			'print("""\nfirst line\nsecond line\n""")',
			'print("""\n----- 8:00 AM | GETTING TO SCHOOL -----\n""")\n\nprint("""Oops, it\'s 8:07 AM. You wake up and realize you have an 8:15 AM class... You\'re NOT making it.\n...""")'
		])
	}),
	Object.freeze({
		id: 2,
		title: 'Ask the player',
		minutes: 5,
		body: `Every good game gives the player a say. Before you email your prof, ask for their most ridiculous excuse for missing class with \`input()\` and store the answer in a \`variable\` named excuse. Use the prompt Enter your goofy excuse: so they know what to type.

\`input()\` pauses the game, waits for a line of text, and hands it back as a \`str\`. Put your answers in Program input before you Run, one line per question. Cat ate the alarm? Aliens? Go wild.`,
		outputNotes: Object.freeze([
			'The scene from before, then the prompt Enter your goofy excuse:',
			'Whatever the player types is stored in excuse'
		]),
		notes: Object.freeze(['Program input for this step: one line, your excuse.']),
		hints: Object.freeze([
			'Call input with the question as its prompt and store the answer in a variable on the left of the equals sign.',
			'excuse = `input`("your question here")',
			'excuse = input("Enter your goofy excuse: ")'
		])
	}),
	Object.freeze({
		id: 3,
		title: 'Write the email',
		minutes: 6,
		body: `Time to actually write that email. Use an \`f-string\` to drop the player's excuse right into the message: Hi Professor, I can't make it to class today because {excuse}. Then add two dramatic pauses: Press ENTER to send... followed by a Sent. line, and Press ENTER to continue...

An \`f-string\` fills live values into your text, so the email changes with whatever the player typed. A pause is just \`input()\` whose answer you ignore, like a game waiting for you to press start.`,
		outputNotes: Object.freeze([
			"A blank line, then Hi Professor, I can't make it to class today because plus the excuse",
			'The prompt Press ENTER to send... then the line Sent.',
			'The prompt Press ENTER to continue...'
		]),
		notes: Object.freeze([
			'Inside a string, \\n means a new line. Start a prompt with \\n to leave a blank line above it.',
			'Program input for this step: your excuse, then two blank lines (one per ENTER pause).'
		]),
		hints: Object.freeze([
			'Put an f before the opening quote and drop the excuse variable inside curly braces.',
			'print(f"... because {excuse}.")\ninput("\\nPress ENTER to send...")',
			'print(f"\\nHi Professor, I can\'t make it to class today because {excuse}.")\n\ninput("\\nPress ENTER to send...")\nprint("Sent.")\n\ninput(...)'
		])
	}),
	Object.freeze({
		id: 4,
		title: 'Make a choice',
		minutes: 8,
		body: `You made it to school! Halfway through class, your brain starts buffering. Add the 10:15 AM scene: a header, a line about losing focus, then a menu of three options (Lock in, Play Wordle, Take a quick nap). Read the choice with \`input()\` and give each option its own outcome using \`if\`, \`elif\` and \`else\`. Finish with a Press ENTER to continue... pause.

Only one branch runs each time, which is what makes a choice feel real. \`input()\` gives back text, so compare the answer with "1" in quotes using \`==\`.`,
		outputNotes: Object.freeze([
			'Scene header with 10:15 AM and NEXT CLASS',
			'A menu numbered 1 to 3: Lock in, Play Wordle, Take a quick nap',
			'A different outcome line for each choice',
			'A final Press ENTER to continue... pause'
		]),
		notes: Object.freeze([
			'Program input for this step: your excuse, two blank lines, your choice (1, 2 or 3), then one blank line.'
		]),
		hints: Object.freeze([
			'Read the choice once, then let a chain of conditions pick exactly one outcome to print.',
			'`if` choice == "1":\n    ...\n`elif` choice == "2":\n    ...\n`else`:\n    ...',
			'choice = input("""\nWhat do you do?\n\n1. Lock in\n2. Play Wordle\n3. Take a quick nap\n\nChoose: """)\n\nif choice == "1":\n    print("\\nYou actually listen and learn something.")\nelif choice == "2":\n    ...\nelse:\n    ...'
		])
	}),
	Object.freeze({
		id: 5,
		title: 'Keep score',
		minutes: 5,
		body: `Choices should matter! Add attempts = 3 at the very top of your file, above everything else. Those are your chances for the quiz waiting at the end of the day. Locking in is a smart move, so it now earns a reward: print BONUS: +1 chance for later. and raise attempts by 1.

A \`variable\` can be updated from its own old value, as in attempts = attempts + 1. Keep an eye on it, because future you will want every chance they can get.`,
		outputNotes: Object.freeze([
			'Choosing 1 prints the outcome and then the BONUS line',
			'Choices 2 and 3 print no BONUS line',
			'attempts goes up by 1 only when the player locks in'
		]),
		notes: Object.freeze(['Same Program input as before. Try each choice and watch the output.']),
		hints: Object.freeze([
			'Update a variable by assigning it to itself plus one, inside the branch that earns the bonus.',
			'attempts = attempts + 1',
			'attempts = 3\n\n...\n\nif choice == "1":\n    print("\\nYou actually listen and learn something.")\n    print("BONUS: +1 chance for later.")\n    attempts = ...'
		])
	}),
	Object.freeze({
		id: 6,
		title: 'Game over',
		minutes: 4,
		body: `Napping in class is a bold strategy. Let's see how it plays out. After the nap outcome line, print YOU DIED. and stop the whole program with \`exit()\`. Nothing after that should run, not even the ENTER pause.

\`exit()\` ends the program on the spot, which is how a game says game over. Try the nap, then try the other options to make sure the story keeps going for everyone who stays awake.`,
		outputNotes: Object.freeze([
			'Choice 3: the outcome line, then YOU DIED. and the game ends',
			'No Press ENTER prompt after YOU DIED.',
			'Choices 1 and 2 still continue as before'
		]),
		notes: Object.freeze(['Program input to test the nap: your excuse, two blank lines, then 3.']),
		hints: Object.freeze([
			'Print the death message at the end of the nap branch, then stop the whole program right there.',
			'print("YOU DIED.")\n`exit`()',
			'else:\n    print("\\nYou close your eyes for 5 minutes. You wake up and everyone is gone. A ceiling tile falls on your head.")\n    print("YOU DIED.")\n    ...'
		])
	}),
	Object.freeze({
		id: 7,
		title: 'Roll the dice',
		minutes: 8,
		body: `Lunchtime! You have 1 hour of AP and your fate is in the hands of a die. Add \`import\` random at the very top, then the 12:45 PM AP scene: a header, a line about your 1 hour of AP, and a menu of two options (the library, or food with friends) read into activity. Ask the player to press ENTER to roll, roll with \`random.randint\`(1, 6) into roll, and print You rolled a and the number.

While you test, you may set roll = 4 by hand to dodge bad luck, but switch back to \`random.randint\` before you Run the step for real.`,
		outputNotes: Object.freeze([
			'Scene header with 12:45 PM and AP',
			'A menu numbered 1 and 2: the library, or food with friends',
			'A Your fate is up to the dice. Press ENTER to roll... prompt',
			'One line: You rolled a, then the number'
		]),
		notes: Object.freeze([
			'Your own Run uses real random rolls. Team checks use fixed rolls so the results repeat.',
			'Program input for this step: your excuse, two blank lines, a scene 2 choice (1 or 2), a blank line, your activity (1 or 2), then a blank line for the roll.'
		]),
		hints: Object.freeze([
			'Import random once at the top, then call its randint function to pick a whole number from 1 to 6.',
			'import random\nroll = `random.randint`(1, 6)',
			'import random\n\nactivity = input("""\nWhat do you do?\n\n1. Larp as a productive student at the library\n2. Get food with friends\n\nChoose: """)\n\ninput("\\nYour fate is up to the dice. Press ENTER to roll...")\n\nroll = ...\n\nprint(f"You rolled a {roll}.")'
		])
	}),
	Object.freeze({
		id: 8,
		title: 'Fate branches',
		minutes: 10,
		body: `Now the dice decide your fate. At the library or with friends: roll 1 is death (YOU DIED. and \`exit()\`), rolls 2 to 3 are meh, and rolls 4 to 6 print BONUS: +1 chance for later. and add 1 to attempts. Give each place its own story (a bookshelf disaster? a suspicious shortcut?). End with a Press ENTER to continue... pause.

Put an \`if\` inside another \`if\`: the outer one picks the place, the inner ones pick the fate. Tip: set roll = 4 by hand to test the good path, then switch back.`,
		outputNotes: Object.freeze([
			'Roll 1: a story line, YOU DIED. and the game ends',
			'Rolls 2 and 3: a story line and no bonus',
			'Rolls 4 to 6: a story line, the BONUS line, and one more attempt',
			'The library and the food option use different story lines'
		]),
		notes: Object.freeze([
			'Program input for this step: your excuse, two blank lines, a scene 2 choice, a blank line, your activity, a blank line for the roll, then a blank line for the last pause.'
		]),
		hints: Object.freeze([
			'Check the place first, then nest a second set of conditions for the roll inside each place.',
			'if activity == "1":\n    if roll == 1:\n        ...\n    `elif` roll <= 3:\n        ...\n    else:\n        ...',
			'if activity == "1":\n\n    if roll == 1:\n        print("\\nYou pull a book off the shelf. The entire shelf tips over and somehow takes the library with it.")\n        print("YOU DIED.")\n        exit()\n\n    elif roll <= 3:\n        ...\n\n    else:\n        ...\n\nelse:\n    ...'
		])
	}),
	Object.freeze({
		id: 9,
		title: 'The quiz loop',
		minutes: 12,
		body: `It is 4:15 PM and your teacher says to put everything away. Surprise quiz! Add the scene: a header, the teacher's line, and a Press ENTER to try your best... pause. Then pick answer with \`random.randint\`(1, 10), print SURPRISE QUIZ and how many chances the player has. Loop with \`while\` attempts > 0, reading guess with \`int\`(\`input()\`). Right: Correct! and \`break\`. Lower: Too low. Higher: Too high. Each miss lowers attempts by 1 and prints Chances left: and the number.

This is where those bonus chances from earlier finally pay off. \`while\` repeats until its condition fails or \`break\` jumps out early.`,
		outputNotes: Object.freeze([
			'Scene header with 4:15 PM and LAST PERIOD, then the SURPRISE QUIZ header',
			'You have, then the attempts number, then chances to pass.',
			'Per guess: Too low., Too high. or Correct!',
			'After each miss: Chances left: and the new number',
			'A correct guess stops the loop right away'
		]),
		notes: Object.freeze([
			'Your own Run uses a real random answer. Team checks fix the dice so the answer repeats.',
			'Program input for this step: everything from before, a blank line for the last pause, a blank line to try your best, then at least six guesses, one per line. Extra lines are ignored. Running out of guesses shows an error in Output, but the step is still graded.'
		]),
		hints: Object.freeze([
			'Keep asking while attempts remain, compare each guess to the answer, and leave the loop early when it is right.',
			'while attempts > 0:\n    guess = int(input("\\nYour answer: "))\n    if guess == answer:\n        ...\n        `break`',
			'answer = random.randint(1, 10)\n\nwhile attempts > 0:\n\n    guess = int(input("\\nYour answer: "))\n\n    if guess == answer:\n        print("Correct!")\n        break\n\n    elif guess < answer:\n        print("Too low.")\n\n    else:\n        ...\n\n    attempts = ...\n    print(f"Chances left: {attempts}")'
		])
	}),
	Object.freeze({
		id: 10,
		title: 'How your day ends',
		minutes: 6,
		body: `The bell rings. The day is almost over and you survived (probably). After the loop, wait for a Press ENTER to see how your day ends... pause, print the END OF THE DAY header, and check whether the last guess was right. If guess == answer print YOU SURVIVED THE DAY. You passed the quiz. See you tomorrow. Otherwise print The answer was and the answer, then YOU SURVIVED THE DAY. You failed the quiz. Don't check Omnivox tonight...

After a \`while\` loop ends, your \`variable\`s still remember their last values, so guess and answer tell you which ending to show. This step finishes the whole game!`,
		outputNotes: Object.freeze([
			'The END OF THE DAY header',
			'Right guess: the passed-the-quiz ending',
			'Wrong guesses: The answer was and the number, then the failed-the-quiz ending',
			'Either way the day is survived'
		]),
		notes: Object.freeze([
			'Program input for this step: everything from before, at least six guesses, then one more blank line for the ending pause. Extra lines are ignored.'
		]),
		hints: Object.freeze([
			'The loop leaves guess and answer behind, so one comparison after it tells you which ending to show.',
			'if guess == answer:\n    ...\n`else`:\n    print(f"The answer was {answer}.")',
			'input("\\nPress ENTER to see how your day ends...")\n\nprint("""\n----- END OF THE DAY -----\n""")\n\nif guess == answer:\n    print("YOU SURVIVED THE DAY. You passed the quiz. See you tomorrow.")\n\nelse:\n    ...'
		])
	}),
	Object.freeze({
		id: 11,
		title: 'Make it yours',
		minutes: 12,
		body: `You built a whole game. Now make it yours! No recipe this time: add one original scene of your own, for example a 2:30 PM chem lab between AP and the quiz (mystery beaker, anyone?). Give it a header in the same style and use at least one idea from earlier: a menu with \`if\`, a dice roll, a bonus attempt, or a death with \`exit()\`.

This is the game jam part. Keep every earlier scene working, then add your own jokes, your own teachers, your own chaos.`,
		outputNotes: Object.freeze([
			'Every earlier scene still runs in order',
			'Your new scene has a header like ----- TIME | PLACE -----',
			'The day still ends with one of the two endings'
		]),
		notes: Object.freeze([
			'Program input: everything from before, plus one line for each input() in your new scene.'
		]),
		stretch:
			'Optional stretch: fix the known bugs. Any choice other than 1, 2 or 3 in scene 2 counts as the nap, anything other than 1 in scene 3 counts as food, and a guess that is not a number crashes `int()`. Loop with `while` until the player types something valid. More scenes, more dice and a longer quiz are also fair stretch work.',
		hints: Object.freeze([
			'Copy the shape of an earlier scene: header, story line, menu, outcomes, pause. Change the story, keep the structure.',
			'print("""\n----- 2:30 PM | CHEM LAB -----\n""")\nlab_choice = input("...")',
			'#3.5: CHEM LAB\n\nprint("""\n----- 2:30 PM | CHEM LAB -----\n""")\n\nlab_choice = input("""\nWhat do you do?\n\n1. Smell it\n2. Ask the TA\n\nChoose: """)\n\nif lab_choice == "2":\n    print("\\nThe TA sighs, but helps you.")\n    attempts = attempts + 1\n\nelse:\n    ...\n\ninput("\\nPress ENTER to continue...")'
		])
	})
]);

export const GAMEJAM_STEP_COUNT = GAMEJAM_STEPS.length;

/** @param {any} stepId */
export function getGamejamStep(stepId) {
	if (!Number.isInteger(stepId) || stepId < 0 || stepId >= GAMEJAM_STEPS.length) return null;
	return GAMEJAM_STEPS[stepId];
}
