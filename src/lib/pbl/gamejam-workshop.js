export const GAMEJAM_STARTER_SOURCE = 'print("Game loaded")\n';
export const GAMEJAM_START_ATTEMPTS = 3;
export const GAMEJAM_QUIZ_MAX = 10;

/**
 * @typedef {{
 *   id: number,
 *   title: string,
 *   minutes: number,
 *   scene?: string,
 *   body: string,
 *   starter?: string,
 *   notes?: readonly string[],
 *   outputNotes?: readonly string[],
 *   requiredStrings?: readonly { label: string, strings: readonly string[] }[],
 *   hints: readonly string[],
 *   stretch?: string
 * }} GamejamStep
 */

/** @param {string} label @param {...string} strings */
function requiredGroup(label, ...strings) {
	return Object.freeze({ label, strings: Object.freeze(strings) });
}

/** @type {readonly GamejamStep[]} */
export const GAMEJAM_STEPS = Object.freeze([
	Object.freeze({
		id: 0,
		title: 'Get something running',
		minutes: 3,
		scene: '----- 8:00 AM | GETTING TO SCHOOL -----',
		body: `Press Run once. The starter line says Game loaded. Replace that text with the scene header, then Run again.

The code stays in the file. Every later step adds another scene on top of this one.`,
		starter: GAMEJAM_STARTER_SOURCE,
		outputNotes: Object.freeze([
			'Exactly one line',
			'The scene header: dashes, the time 8:00 AM, a | bar, then GETTING TO SCHOOL',
			'Not the starter text'
		]),
		requiredStrings: Object.freeze([
			requiredGroup('Header', '----- 8:00 AM | GETTING TO SCHOOL -----')
		]),
		hints: Object.freeze([
			'Replace the starter sentence with the scene header, then Run. If Game loaded is still there, this step stays where it is.',
			'The header is just text inside the quotes: `print`("----- TIME | PLACE -----")',
			'print("----- 8:00 AM | GETTING TO SCHOOL -----")'
		])
	}),
	Object.freeze({
		id: 1,
		title: 'Set the scene',
		minutes: 5,
		scene: `Oops, it's 8:07 AM. You wake up and realize you have an 8:15 AM class... You're NOT making it.
Time to email your prof.`,
		body: `Turn the header into a \`triple quotes\` block with a blank line above it and a blank line below it. Add a second \`print\` for the two narration lines in Required strings.

A \`triple quotes\` string keeps the line breaks where you typed them.`,
		outputNotes: Object.freeze([
			'A blank line, then the scene header, then a blank line',
			'Then two lines of narration',
			'The narration mentions 8:07 AM, the 8:15 AM class and emailing your prof'
		]),
		requiredStrings: Object.freeze([
			requiredGroup('Header', '----- 8:00 AM | GETTING TO SCHOOL -----'),
			requiredGroup(
				'Narration',
				"Oops, it's 8:07 AM. You wake up and realize you have an 8:15 AM class... You're NOT making it.",
				'Time to email your prof.'
			)
		]),
		notes: Object.freeze([
			'A line that starts with # is a comment. Python skips it. Label the scene with one, for example #1 : WAKING UP LATE.',
			'Partial code replaces the one-line print from the last step. Delete that print. Do not keep both.'
		]),
		hints: Object.freeze([
			'Put the header and the narration in triple quotes so the line breaks stay where you typed them.',
			'print("""\nfirst line\nsecond line\n""")',
			`#1 : WAKING UP LATE

print("""
----- 8:00 AM | GETTING TO SCHOOL -----
""")

print("""Oops, it's 8:07 AM. You wake up and realize you have an 8:15 AM class... You're NOT making it.
Time to email your prof.""")`
		])
	}),
	Object.freeze({
		id: 2,
		title: 'Ask the player',
		minutes: 5,
		scene: 'Enter your goofy excuse:',
		body: `Ask for the excuse with \`input()\` and store the answer in a \`variable\` named excuse. Use the prompt in Required strings.

\`input()\` waits for one line and hands it back as a \`str\`. Type that line in the console before you Run.`,
		outputNotes: Object.freeze([
			'The scene from before, then the prompt Enter your goofy excuse:',
			'Whatever the player types is stored in excuse'
		]),
		requiredStrings: Object.freeze([requiredGroup('Prompt', 'Enter your goofy excuse:')]),
		notes: Object.freeze(['In the console: one line, your excuse.']),
		hints: Object.freeze([
			'Call input with the question as its prompt. Put the answer in a variable on the left of the equals sign.',
			'excuse = `input`("your question here")',
			'excuse = input("Enter your goofy excuse: ")'
		])
	}),
	Object.freeze({
		id: 3,
		title: 'Write the email',
		minutes: 6,
		scene: `Hi Professor, I can't make it to class today because {excuse}.
Press ENTER to send...
Sent.`,
		body: `Use an \`f-string\` so the email contains whatever is stored in excuse. Then add the two pauses in Required strings: Press ENTER to send..., the line Sent., and Press ENTER to continue...

An \`f-string\` puts a live value into the text. A pause is an \`input()\` call. You can ignore what it returns.`,
		outputNotes: Object.freeze([
			"A blank line, then Hi Professor, I can't make it to class today because plus the excuse",
			'The prompt Press ENTER to send... then the line Sent.',
			'The prompt Press ENTER to continue...'
		]),
		requiredStrings: Object.freeze([
			requiredGroup('Email', "Hi Professor, I can't make it to class today because {excuse}."),
			requiredGroup('Pauses', 'Press ENTER to send...', 'Sent.', 'Press ENTER to continue...')
		]),
		notes: Object.freeze([
			'Inside a string, \\n means a new line. Start a prompt with \\n to leave a blank line above it.',
			'In the console: your excuse, then two blank lines (one per ENTER pause).'
		]),
		hints: Object.freeze([
			'Put an f before the opening quote and put the excuse variable inside curly braces.',
			'print(f"... because {excuse}.")\ninput("\\nPress ENTER to send...")',
			`print(f"\\nHi Professor, I can't make it to class today because {excuse}.")

input("\\nPress ENTER to send...")
print("Sent.")

input("\\nPress ENTER to continue...")`
		])
	}),
	Object.freeze({
		id: 4,
		title: 'Make a choice',
		minutes: 8,
		scene: `You eventually make it to school. Halfway through class, you start losing focus.
You actually listen and learn something.
You open Wordle with your brightness at minimum. You understand 5% of the lecture.
You close your eyes for 5 minutes. You wake up and everyone is gone. A ceiling tile falls on your head.`,
		body: `Add the 10:15 AM header and one line about losing focus. Print the menu lines from Required strings, then Choose:. Read the choice with \`input()\`. Use \`if\`, \`elif\`, and \`else\` so each option prints a different outcome. End with Press ENTER to continue...

Only one branch runs. \`input()\` gives back text, so compare the answer with "1" using \`==\`.`,
		outputNotes: Object.freeze([
			'Scene header with 10:15 AM and NEXT CLASS',
			'A menu numbered 1 to 3: Lock in, Play Wordle, Take a quick nap',
			'A different outcome line for each choice',
			'A final Press ENTER to continue... pause'
		]),
		requiredStrings: Object.freeze([
			requiredGroup(
				'Headers',
				'----- 8:00 AM | GETTING TO SCHOOL -----',
				'----- 10:15 AM | NEXT CLASS -----'
			),
			requiredGroup(
				'Menu',
				'1. Lock in',
				'2. Play Wordle',
				'3. Take a quick nap',
				'Choose:'
			),
			requiredGroup('Pause', 'Press ENTER to continue...')
		]),
		notes: Object.freeze([
			'In the console: your excuse, two blank lines, your choice (1, 2 or 3), then one blank line.'
		]),
		hints: Object.freeze([
			'Read the choice once. A chain of conditions then prints exactly one outcome.',
			'`if` choice == "1":\n    ...\n`elif` choice == "2":\n    ...\n`else`:\n    ...',
			`#2: NEXT CLASS

print("""
----- 10:15 AM | NEXT CLASS -----
""")

print("You eventually make it to school. Halfway through class, you start losing focus.")

choice = input("""
What do you do?

1. Lock in
2. Play Wordle
3. Take a quick nap

Choose: """)

if choice == "1":
    print("\\nYou actually listen and learn something.")
elif choice == "2":
    print("\\nYou open Wordle with your brightness at minimum. You understand 5% of the lecture.")
else:
    print("\\nYou close your eyes for 5 minutes. You wake up and everyone is gone. A ceiling tile falls on your head.")

input("\\nPress ENTER to continue...")`
		])
	}),
	Object.freeze({
		id: 5,
		title: 'Keep score',
		minutes: 5,
		scene: `You actually listen and learn something.
BONUS: +1 chance for later.`,
		body: `Put attempts = 3 at the top of the file, above every scene. That number is how many chances the quiz at the end of the day starts with. In the Lock in branch, print BONUS: +1 chance for later. and add 1 to attempts.

A \`variable\` can be set from its own old value: attempts = attempts + 1.`,
		outputNotes: Object.freeze([
			'Choosing 1 prints the outcome and then the BONUS line',
			'Choices 2 and 3 print no BONUS line',
			'attempts goes up by 1 only when the player locks in'
		]),
		requiredStrings: Object.freeze([
			requiredGroup('Bonus', 'BONUS: +1 chance for later.')
		]),
		notes: Object.freeze([
			'Same lines in the console as before. Try each choice and watch the output.',
			'Partial code starts with attempts = 3. Put that line at the top of the file, above every scene. Then replace your Lock in branch with the if choice == "1" block.'
		]),
		hints: Object.freeze([
			'Inside the branch that earns the bonus, set the variable to itself plus one.',
			'attempts = attempts + 1',
			`attempts = 3

if choice == "1":
    print("\\nYou actually listen and learn something.")
    print("BONUS: +1 chance for later.")
    attempts = attempts + 1`
		])
	}),
	Object.freeze({
		id: 6,
		title: 'Game over',
		minutes: 4,
		scene: `You close your eyes for 5 minutes. You wake up and everyone is gone. A ceiling tile falls on your head.
YOU DIED.`,
		body: `After the nap outcome, print YOU DIED. and call \`exit()\` so nothing after that line runs, including the ENTER pause.

\`exit()\` stops the program immediately. Run choice 3, then run choices 1 and 2 and check that those still continue.`,
		outputNotes: Object.freeze([
			'Choice 3: the outcome line, then YOU DIED. and the game ends',
			'No Press ENTER prompt after YOU DIED.',
			'Choices 1 and 2 still continue as before'
		]),
		requiredStrings: Object.freeze([requiredGroup('Death', 'YOU DIED.')]),
		notes: Object.freeze([
			'In the console, to test the nap: your excuse, two blank lines, then 3.',
			'Partial code replaces your else branch. Leave the Press ENTER to continue... line after the whole if, elif, else.'
		]),
		hints: Object.freeze([
			'Print the death message at the end of the nap branch, then stop the program on the next line.',
			'print("YOU DIED.")\nexit()',
			`else:
    print("\\nYou close your eyes for 5 minutes. You wake up and everyone is gone. A ceiling tile falls on your head.")
    print("YOU DIED.")
    exit()`
		])
	}),
	Object.freeze({
		id: 7,
		title: 'Roll the dice',
		minutes: 8,
		scene: `You have 1 hour of AP.
1. Larp as a productive student at the library
2. Get food with friends
Your fate is up to the dice. Press ENTER to roll...`,
		body: `Add \`import\` random at the top of the file. Add the 12:45 PM header, a line about the AP hour, and the menu from Required strings. Store the answer in activity. Ask for ENTER with the roll prompt, set roll with \`random.randint\`(1, 6), and print You rolled a followed by the number.

You can set roll = 4 by hand while you test. Put \`random.randint\` back before you Run this step for real.`,
		outputNotes: Object.freeze([
			'Scene header with 12:45 PM and AP',
			'A menu numbered 1 and 2: the library, or food with friends',
			'A Your fate is up to the dice. Press ENTER to roll... prompt',
			'One line: You rolled a, then the number'
		]),
		requiredStrings: Object.freeze([
			requiredGroup(
				'Headers',
				'----- 8:00 AM | GETTING TO SCHOOL -----',
				'----- 10:15 AM | NEXT CLASS -----',
				'----- 12:45 PM | AP -----'
			),
			requiredGroup(
				'Menu',
				'1. Larp as a productive student at the library',
				'2. Get food with friends'
			),
			requiredGroup('Roll', 'Your fate is up to the dice. Press ENTER to roll...', 'You rolled a {roll}.')
		]),
		notes: Object.freeze([
			'Your own Run uses real random rolls. The team check uses fixed rolls so the results repeat.',
			'In the console: your excuse, two blank lines, a scene 2 choice (1 or 2), a blank line, your activity (1 or 2), then a blank line for the roll.'
		]),
		hints: Object.freeze([
			'Import random once at the top, then call randint to pick a whole number from 1 to 6.',
			'import random\nroll = `random.randint`(1, 6)',
			`import random

#3: AP

print("""
----- 12:45 PM | AP -----
""")

print("You have 1 hour of AP.")

activity = input("""
What do you do?

1. Larp as a productive student at the library
2. Get food with friends

Choose: """)

input("\\nYour fate is up to the dice. Press ENTER to roll...")

roll = random.randint(1, 6)

print(f"You rolled a {roll}.")`
		])
	}),
	Object.freeze({
		id: 8,
		title: 'Fate branches',
		minutes: 10,
		scene: `You pull a book off the shelf. The entire shelf tips over and somehow takes the library with it.
You start doomscrolling. You look up and AP is already over.
You somehow actually study.
You take one bite. You forgot you're severely allergic.
Your friend says they know a shortcut. You end up nowhere near the restaurant and you're now hangry.
The food was actually worth it. You come back fueled.`,
		body: `Roll 1 prints YOU DIED. and calls \`exit()\`. Rolls 2 and 3 print a story line and no bonus. Rolls 4 to 6 print BONUS: +1 chance for later. and add 1 to attempts. Write a different story line for the library and for food. End with Press ENTER to continue...

Use an \`if\` inside another \`if\`. The outer one is the place. The inner ones are the roll. You can set roll = 4 by hand to try the good path, then switch it back.`,
		outputNotes: Object.freeze([
			'Roll 1: a story line, YOU DIED. and the game ends',
			'Rolls 2 and 3: a story line and no bonus',
			'Rolls 4 to 6: a story line, the BONUS line, and one more attempt',
			'The library and the food option use different story lines'
		]),
		requiredStrings: Object.freeze([
			requiredGroup('Death', 'YOU DIED.'),
			requiredGroup('Bonus', 'BONUS: +1 chance for later.'),
			requiredGroup('Pause', 'Press ENTER to continue...')
		]),
		notes: Object.freeze([
			'In the console: your excuse, two blank lines, a scene 2 choice, a blank line, your activity, a blank line for the roll, then a blank line for the last pause.'
		]),
		hints: Object.freeze([
			'Check the place first. Inside each place, check the roll with a second set of conditions.',
			'if activity == "1":\n    if roll == 1:\n        ...\n    `elif` roll <= 3:\n        ...\n    else:\n        ...',
			`if activity == "1":

    if roll == 1:
        print("\\nYou pull a book off the shelf. The entire shelf tips over and somehow takes the library with it.")
        print("YOU DIED.")
        exit()

    elif roll <= 3:
        print("\\nYou start doomscrolling. You look up and AP is already over.")

    else:
        print("\\nYou somehow actually study.")
        print("BONUS: +1 chance for later.")
        attempts = attempts + 1

else:

    if roll == 1:
        print("\\nYou take one bite. You forgot you're severely allergic.")
        print("YOU DIED.")
        exit()

    elif roll <= 3:
        print("\\nYour friend says they know a shortcut. You end up nowhere near the restaurant and you're now hangry.")

    else:
        print("\\nThe food was actually worth it. You come back fueled.")
        print("BONUS: +1 chance for later.")
        attempts = attempts + 1

input("\\nPress ENTER to continue...")`
		])
	}),
	Object.freeze({
		id: 9,
		title: 'The quiz loop',
		minutes: 12,
		scene: `Your teacher says, "Put everything away. Surprise quiz." Help, you forgot you had a quiz.
Turns out some of your decisions today actually mattered!
Guess the correct answer from 1 to 10.`,
		body: `Add the last-period header, the teacher's line, and the pause Press ENTER to try your best.... Set answer with \`random.randint\`(1, 10). Print the SURPRISE QUIZ header and how many chances are left. Loop with \`while\` attempts > 0. Read guess with \`int\`(\`input()\`). Print Correct! and \`break\` on a match, Too low. when the guess is smaller, and Too high. when it is bigger. Each miss does attempts = attempts - 1 and prints Chances left: plus the number.

\`while\` keeps going while its condition is true. \`break\` leaves the loop early.`,
		outputNotes: Object.freeze([
			'Scene header with 4:15 PM and LAST PERIOD, then the SURPRISE QUIZ header',
			'You have, then the attempts number, then chances to pass.',
			'Per guess: Too low., Too high. or Correct!',
			'After each miss: Chances left: and the new number',
			'A correct guess stops the loop right away'
		]),
		requiredStrings: Object.freeze([
			requiredGroup(
				'Headers',
				'----- 8:00 AM | GETTING TO SCHOOL -----',
				'----- 10:15 AM | NEXT CLASS -----',
				'----- 12:45 PM | AP -----',
				'----- 4:15 PM | LAST PERIOD -----',
				'----- SURPRISE QUIZ -----'
			),
			requiredGroup('Pause', 'Press ENTER to try your best...'),
			requiredGroup(
				'Quiz',
				'You have {attempts} chances to pass.',
				'Your answer:',
				'Too low.',
				'Too high.',
				'Correct!',
				'Chances left: {attempts}'
			)
		]),
		notes: Object.freeze([
			'Your own Run uses a real random answer. The team check fixes the dice so the answer repeats.',
			'In the console: everything from before, a blank line for the last pause, a blank line to try your best, then at least six guesses, one per line. Extra lines are ignored. If you run out of guesses, the console shows an error. The step is still graded.'
		]),
		hints: Object.freeze([
			'Keep asking while attempts remain. Compare each guess with the answer, and leave the loop when the guess is right.',
			'while attempts > 0:\n    guess = int(input("\\nYour answer: "))\n    if guess == answer:\n        ...\n        `break`',
			`print("""
----- 4:15 PM | LAST PERIOD -----
""")

print('Your teacher says, "Put everything away. Surprise quiz." Help, you forgot you had a quiz.')

input("\\nPress ENTER to try your best...")

answer = random.randint(1, 10)

print("""
----- SURPRISE QUIZ -----
""")

print(f"You have {attempts} chances to pass.")
print("Turns out some of your decisions today actually mattered!")
print("Guess the correct answer from 1 to 10.")

while attempts > 0:

    guess = int(input("\\nYour answer: "))

    if guess == answer:
        print("Correct!")
        break

    elif guess < answer:
        print("Too low.")

    else:
        print("Too high.")

    attempts = attempts - 1
    print(f"Chances left: {attempts}")`
		])
	}),
	Object.freeze({
		id: 10,
		title: 'How your day ends',
		minutes: 6,
		scene: `YOU SURVIVED THE DAY. You passed the quiz. See you tomorrow.
The answer was {answer}.
YOU SURVIVED THE DAY. You failed the quiz. Don't check Omnivox tonight...`,
		body: `After the loop, add the pause Press ENTER to see how your day ends.... Print the END OF THE DAY header. If guess == answer, print the passed ending from Required strings. Otherwise print The answer was and the answer, then the failed ending.

A \`while\` loop leaves guess and answer with their last values, so you can still check them. This is the last scene of the written game.`,
		outputNotes: Object.freeze([
			'The END OF THE DAY header',
			'Right guess: the passed-the-quiz ending',
			'Wrong guesses: The answer was and the number, then the failed-the-quiz ending',
			'Both endings still say the day was survived'
		]),
		requiredStrings: Object.freeze([
			requiredGroup('Header', '----- END OF THE DAY -----'),
			requiredGroup('Pause', 'Press ENTER to see how your day ends...'),
			requiredGroup('Passed', 'YOU SURVIVED THE DAY. You passed the quiz. See you tomorrow.'),
			requiredGroup(
				'Failed',
				'The answer was {answer}.',
				"YOU SURVIVED THE DAY. You failed the quiz. Don't check Omnivox tonight..."
			)
		]),
		notes: Object.freeze([
			'In the console: everything from before, at least six guesses, then one more blank line for the ending pause. Extra lines are ignored.'
		]),
		hints: Object.freeze([
			'The loop leaves guess and answer behind. One comparison after it picks the ending.',
			'if guess == answer:\n    ...\n`else`:\n    print(f"The answer was {answer}.")',
			`input("\\nPress ENTER to see how your day ends...")

print("""
----- END OF THE DAY -----
""")

if guess == answer:
    print("YOU SURVIVED THE DAY. You passed the quiz. See you tomorrow.")

else:
    print(f"The answer was {answer}.")
    print("YOU SURVIVED THE DAY. You failed the quiz. Don't check Omnivox tonight...")`
		])
	}),
	Object.freeze({
		id: 11,
		title: 'Make it yours',
		minutes: 12,
		scene: `Your lab partner slides you an unlabeled beaker and says it's "probably fine."
The TA sighs, but helps you. You finish the lab early.
It was vinegar. Your eyes water for the rest of the period.
It was just water. Nothing happens. You feel slightly silly.`,
		body: `Add one new scene. A 2:30 PM chem lab between AP and the quiz is a shape that already fits. Give it a header like ----- TIME | PLACE -----. Use at least one thing from an earlier step: a menu with \`if\`, a dice roll, a bonus attempt, or \`exit()\` after a death.

Leave the earlier scenes working.`,
		outputNotes: Object.freeze([
			'Every earlier scene still runs in order',
			'Your new scene has a header like ----- TIME | PLACE -----',
			'The day still ends with one of the two endings'
		]),
		requiredStrings: Object.freeze([
			requiredGroup(
				'Keep',
				'----- 8:00 AM | GETTING TO SCHOOL -----',
				'----- 10:15 AM | NEXT CLASS -----',
				'----- 12:45 PM | AP -----',
				'----- 4:15 PM | LAST PERIOD -----',
				'----- END OF THE DAY -----',
				'YOU SURVIVED THE DAY'
			),
			requiredGroup('New scene', '----- TIME | PLACE -----')
		]),
		notes: Object.freeze([
			'In the console: everything from before, plus one line for each input() in your new scene.'
		]),
		stretch:
			'Optional: fix the known bugs. Any choice other than 1, 2, or 3 in scene 2 is treated as the nap. Anything other than 1 in scene 3 is treated as food. A guess that is not a number crashes `int()`. A `while` loop can keep asking until the player types something the program can use. More scenes, more dice, or a longer quiz also count.',
		hints: Object.freeze([
			'Copy the shape of an earlier scene: header, story line, menu, outcomes, pause. Change the story and keep that shape.',
			'print("""\n----- 2:30 PM | CHEM LAB -----\n""")\nlab_choice = input("...")',
			`#3.5: CHEM LAB

print("""
----- 2:30 PM | CHEM LAB -----
""")

print("Your lab partner slides you an unlabeled beaker and says it's \\"probably fine.\\"")

lab_choice = input("""
What do you do?

1. Smell it
2. Ask the TA

Choose: """)

if lab_choice == "2":
    print("\\nThe TA sighs, but helps you. You finish the lab early.")
    print("BONUS: +1 chance for later.")
    attempts = attempts + 1

else:
    input("\\nYour fate is up to the dice. Press ENTER to roll...")
    roll = random.randint(1, 6)
    print(f"You rolled a {roll}.")

    if roll <= 2:
        print("\\nIt was vinegar. Your eyes water for the rest of the period.")
    else:
        print("\\nIt was just water. Nothing happens. You feel slightly silly.")

input("\\nPress ENTER to continue...")`
		])
	})
]);

export const GAMEJAM_STEP_COUNT = GAMEJAM_STEPS.length;

/** @param {any} stepId */
export function getGamejamStep(stepId) {
	if (!Number.isInteger(stepId) || stepId < 0 || stepId >= GAMEJAM_STEPS.length) return null;
	return GAMEJAM_STEPS[stepId];
}
