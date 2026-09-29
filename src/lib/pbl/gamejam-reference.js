/**
 * Cumulative reference programs for the Game Jam PBL: entry N is the whole game
 * as it should look after step N. Step 10 is the finished game. Step 11 adds the
 * example "make it yours" scene. Used to test the step checks against real Python.
 */

const SCENE_1_HEADER_ONLY = 'print("----- 8:00 AM | GETTING TO SCHOOL -----")\n';

const SCENE_1_STORY = `#1 : WAKING UP LATE

print("""
----- 8:00 AM | GETTING TO SCHOOL -----
""")

print("""Oops, it's 8:07 AM. You wake up and realize you have an 8:15 AM class... You're NOT making it.
Time to email your prof.""")
`;

const EXCUSE = `
excuse = input("Enter your goofy excuse: ")
`;

const EMAIL = `
print(f"\\nHi Professor, I can't make it to class today because {excuse}.")

input("\\nPress ENTER to send...")
print("Sent.")

input("\\nPress ENTER to continue...")
`;

/** @param {number} step */
function sceneTwo(step) {
	const bonus =
		step >= 5 ? '    print("BONUS: +1 chance for later.")\n    attempts = attempts + 1\n' : '';
	const death = step >= 6 ? '    print("YOU DIED.")\n    exit()\n' : '';
	return `

#2: NEXT CLASS

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
${bonus}
elif choice == "2":
    print("\\nYou open Wordle with your brightness at minimum. You understand 5% of the lecture.")

else:
    print("\\nYou close your eyes for 5 minutes. You wake up and everyone is gone. A ceiling tile falls on your head.")
${death}
input("\\nPress ENTER to continue...")
`;
}

const SCENE_3_INTRO = `

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

print(f"You rolled a {roll}.")
`;

const SCENE_3_FATE = `

# LIBRARY

if activity == "1":

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


# FOOD

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

input("\\nPress ENTER to continue...")
`;

const SCENE_4_QUIZ = `

#4: LAST PERIOD

print("""
----- 4:15 PM | LAST PERIOD -----
""")

print('Your teacher says, "Put everything away. Surprise quiz." Help, you forgot you had a quiz.')

input("\\nPress ENTER to try your best...")


# FINAL MINI-GAME

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
    print(f"Chances left: {attempts}")
`;

const ENDING = `

# ENDING

input("\\nPress ENTER to see how your day ends...")

print("""
----- END OF THE DAY -----
""")

if guess == answer:
    print("YOU SURVIVED THE DAY. You passed the quiz. See you tomorrow.")

else:
    print(f"The answer was {answer}.")
    print("YOU SURVIVED THE DAY. You failed the quiz. Don't check Omnivox tonight...")
`;

const CHEM_LAB = `

#3.5: CHEM LAB  (example "make it yours" scene)

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

input("\\nPress ENTER to continue...")
`;

/** @param {number} step */
function buildReference(step) {
	if (step === 0) return SCENE_1_HEADER_ONLY;
	let source = '';
	if (step >= 7) source += 'import random\n';
	if (step >= 5) source += 'attempts = 3\n';
	if (step >= 5) source += '\n\n';
	source += SCENE_1_STORY;
	if (step >= 2) source += EXCUSE;
	if (step >= 3) source += EMAIL;
	if (step >= 4) source += sceneTwo(step);
	if (step >= 7) source += SCENE_3_INTRO;
	if (step >= 8) source += SCENE_3_FATE;
	if (step >= 11) source += CHEM_LAB;
	if (step >= 9) source += SCENE_4_QUIZ;
	if (step >= 10) source += ENDING;
	return source;
}

/** @type {readonly string[]} */
export const GAMEJAM_REFERENCE_SOURCES = Object.freeze(
	Array.from({ length: 12 }, (_, step) => buildReference(step))
);
