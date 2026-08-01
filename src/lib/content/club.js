const discordJoinUrl = 'https://discord.gg/BMvrpKJjej';

export const clubContent = {
	name: 'Marianopolis Programming Club',
	joinUrl: discordJoinUrl,
	mission:
		'A welcoming place for Marianopolis students to learn programming, build together, and share software, with no experience required.',
	socialLinks: [
		{
			label: 'GitHub',
			url: 'https://github.com/MariHacks',
			icon: '/socials/github.svg'
		},
		{
			label: 'Discord',
			url: discordJoinUrl,
			icon: '/socials/discord.svg'
		},
		{
			label: 'Instagram',
			url: 'https://www.instagram.com/mari_programming_club/',
			icon: '/socials/instagram.svg'
		},
		{
			label: 'MariHacks',
			url: 'https://www.marihacks.com/',
			icon: '/socials/marihacks.png'
		}
	],
	events: [],
	workshops: [
		{
			id: 'intro-python',
			title: 'Intro to Python',
			track: 'Python foundations',
			term: '2023–2024',
			description: 'Variables, data types, operations, conditions, and loops.',
			links: [
				{
					label: 'Slides',
					url: 'https://docs.google.com/presentation/d/1MNX3TRe8Rzh_st2cG6TyUjDhHmbPRdsMHE0lI2--2Ho/edit?usp=drive_link'
				},
				{
					label: 'Colab',
					url: 'https://colab.research.google.com/drive/1UX_XKx1KWytoyxW7XACD2GparE-TPQU3?usp=sharing'
				}
			]
		},
		{
			id: 'functions-and-lists',
			title: 'Functions and lists',
			track: 'Python foundations',
			term: '2023–2024',
			description: 'Loops, lists, functions, dictionaries, and reusable problem-solving patterns.',
			links: [
				{
					label: 'Slides',
					url: 'https://docs.google.com/presentation/d/1QVGR1s9O3rBgoNJ8uCYrX1818NZHO8ZBH3mKDcvxrZI/edit?usp=sharing'
				}
			]
		},
		{
			id: 'collections',
			title: 'Working with lists and dictionaries',
			track: 'Python foundations',
			term: '2023–2024',
			description: 'Comprehensions, tuples, destructuring, and ways to transform collections.',
			links: [
				{
					label: 'Slides',
					url: 'https://docs.google.com/presentation/d/1rfqu_Dw09ZJm3pn5zqhRVWJ2DHssq5XXREJT0O5kYVM/edit?usp=sharing'
				}
			]
		},
		{
			id: 'strings-and-files',
			title: 'Strings and files',
			track: 'Python foundations',
			term: '2023–2024',
			description:
				'Character codes, string operations, and the basics of reading and writing files.',
			links: [
				{
					label: 'Slides',
					url: 'https://docs.google.com/presentation/d/1gnF6-zQ6X_ED3XhfKA_rlcbomAJhIHEeSqOYqPfrJLM/edit?usp=sharing'
				}
			]
		},
		{
			id: 'numpy',
			title: 'NumPy',
			track: 'Python libraries',
			term: '2023–2024',
			description:
				'Array shapes, dimensions, operations, and the foundations of numerical computing.',
			links: [
				{
					label: 'Slides',
					url: 'https://docs.google.com/presentation/d/1wuC7wCAerBPxLYiQRHgRp6zLSTp1cbIUUsiASsj94Co/edit?usp=sharing'
				}
			]
		},
		{
			id: 'matplotlib',
			title: 'Matplotlib',
			track: 'Python libraries',
			term: '2023–2024',
			description: 'Generate, label, and customize plots with Python.',
			links: [
				{
					label: 'Slides',
					url: 'https://docs.google.com/presentation/d/1jkPRUiXcry1UExDtmLrt6JVCmVcy9O6KB5NBIjO1mXE/edit?usp=sharing'
				}
			]
		},
		{
			id: 'python-review',
			title: 'Python review',
			track: 'Python foundations',
			term: '2023–2024',
			description: 'Review core Python concepts and practice applying them to short problems.',
			links: [
				{
					label: 'Slides',
					url: 'https://docs.google.com/presentation/d/1QETOIuXHtx2YUJXBGuVClhjnKoCCsB_mJs9dtq9KYpQ/edit?usp=sharing'
				},
				{
					label: 'Problem set',
					url: 'https://colab.research.google.com/drive/1GWQT1ciq4VNblDmxJPyom11JyqZg9EvV?usp=sharing'
				},
				{
					label: 'Solutions',
					url: 'https://colab.research.google.com/drive/1bSJggUXE4x-r3jQ8wwcGUAd14xQVuMs_?usp=sharing'
				}
			]
		},
		{
			id: 'object-oriented-python',
			title: 'Object-oriented Python',
			track: 'Python foundations',
			term: '2023–2024',
			description: 'Classes, objects, and how object-oriented programs organize related behavior.',
			links: [
				{
					label: 'Slides',
					url: 'https://docs.google.com/presentation/d/1LNfJLjlheS1SMNjqB1aNcXEuXffYOkMywmSv4qvUDEQ/edit?usp=sharing'
				},
				{
					label: 'Code examples',
					url: 'https://github.com/MariHacks/workshops-2023-2024/tree/main/OOP'
				}
			]
		},
		{
			id: 'hackathon-python-libraries',
			title: 'Python libraries for hackathons',
			track: 'Hackathon preparation',
			term: '2023–2024',
			description: 'Explore useful Python libraries for building a hackathon project quickly.',
			links: [
				{
					label: 'Slides',
					url: 'https://docs.google.com/presentation/d/1BP8OQZS9y7Ew_3Oq9zr1Ns2Ta2BVBLPtlPmfvu4RR34/edit?usp=sharing'
				},
				{
					label: 'Code examples',
					url: 'https://github.com/MariHacks/workshops-2023-2024/tree/main/marihacks_prep'
				}
			]
		}
	],
	resources: [
		{
			id: 'guided-learning',
			title: 'Learn the foundations',
			description: 'Follow a structured course when you want a clear place to begin.',
			links: [
				{ label: 'freeCodeCamp', url: 'https://www.freecodecamp.org/learn' },
				{ label: 'Codecademy', url: 'https://www.codecademy.com/' },
				{ label: 'Harvard CS50x', url: 'https://cs50.harvard.edu/x/' }
			]
		},
		{
			id: 'web-development',
			title: 'Build for the web',
			description: 'Learn web development by creating complete, practical projects.',
			links: [
				{ label: 'The Odin Project', url: 'https://www.theodinproject.com/' },
				{ label: 'web.dev', url: 'https://web.dev/learn' },
				{
					label: 'Frontend Mentor',
					url: 'https://www.frontendmentor.io/challenges'
				}
			]
		},
		{
			id: 'problem-solving',
			title: 'Practice problem solving',
			description: 'Strengthen algorithms and implementation skills with focused challenges.',
			links: [
				{ label: 'LeetCode', url: 'https://leetcode.com/' },
				{ label: 'Codewars', url: 'https://www.codewars.com/' },
				{ label: 'HackerRank', url: 'https://www.hackerrank.com/' }
			]
		},
		{
			id: 'video-and-community',
			title: 'Watch and ask questions',
			description: 'Use focused video guides, then research questions when you get stuck.',
			links: [
				{ label: 'freeCodeCamp on YouTube', url: 'https://www.youtube.com/@freecodecamp' },
				{ label: 'Tech with Tim', url: 'https://www.youtube.com/@TechWithTim' },
				{ label: 'Traversy Media', url: 'https://www.youtube.com/@TraversyMedia' },
				{ label: 'Coder Coder', url: 'https://www.youtube.com/@TheCoderCoder' },
				{ label: 'Pooky Codes', url: 'https://www.youtube.com/@PookyCodes' },
				{ label: 'Stack Overflow', url: 'https://stackoverflow.com/' }
			]
		}
	]
};

/**
 * @typedef {{ id: string, startsAt: string }} ClubEvent
 * @typedef {{ id: string, track: string }} Workshop
 */

/**
 * @param {ClubEvent[]} events
 * @param {Date} today
 * @returns {ClubEvent[]}
 */
export function getUpcomingEvents(events, today = new Date()) {
	return events.filter((event) => new Date(event.startsAt) >= today);
}

/**
 * @param {Workshop[]} workshops
 * @returns {Record<string, Workshop[]>}
 */
export function getWorkshopTracks(workshops) {
	/** @type {Record<string, Workshop[]>} */
	const tracks = {};

	for (const workshop of workshops) {
		tracks[workshop.track] = [...(tracks[workshop.track] ?? []), workshop];
	}

	return tracks;
}
