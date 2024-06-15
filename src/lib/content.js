// all website text/content is stored here and dynamically imported to each page
// update content here and NOT directly in the Svelte components/pages!
// N.B. we just use a JS object (e.g. not a readable store) since this website displays static content only (components do not need to be dynamic/reactive)

// navbar
export const topNav = {
	'left': {
		// links on left side of brand/logo
		'Home': '/',
		'About us': '/about-us',
		'Our workshops': '/our-workshops'
	},
	'right': {
		// links on right side of brand
		'Resources': '/resources',
		'Roadmap': '/roadmap'
	},
	'cta': {
		// "call to action" (cta) btn on the right end/side of the top nav (or bottom of mobile expanded nav)
		'text': 'Sign up (coming soon)',
		'url': false // use a falsy value to disable the button
	},
	'brand': {
		// brand/logo "settings": sm = mobile, full = large screens
		'imgSm': '/logo-icon.svg',
		'imgFull': '/logo-full.svg',
		'imgHeightSm': 40,
		'imgHeightFull': 40,
		'imgAlt': 'Marianopolis Programming Club logo'
	}
};

// footer
export const footer = {
	'brand': '\u003cThe Marianopolis Programming Club\u00a0/\u003e', // footer 'title' text at bottom of every page
	'socials': {
		// social media links
		'GitHub': {
			'url': 'https://github.com/MariHacks',
			'icon': '/socials/github.svg',
			'iconAlt': 'GitHub logo',
			'height': 30
		},
		'Discord': {
			'url': 'https://discord.gg/BMvrpKJjej',
			'icon': '/socials/discord.svg',
			'iconAlt': 'Discord logo',
			'height': 30
		},
		'Instagram': {
			'url': 'https://www.instagram.com/mari_programming_club/',
			'icon': '/socials/instagram.svg',
			'iconAlt': 'Instagram logo',
			'height': 30
		},
		'MariHacks': {
			'url': 'https://www.marihacks.com/',
			'icon': '/socials/marihacks.png',
			'iconAlt': 'MariHacks logo',
			'height': 30
		}
	}
};

// home page
export const home = {
	'metaTitle': 'Marianopolis Programming Club',
	'metaDesc': 'Welcome to the Marianopolis Programming Club!',
	'seeAlsoLinks': {
		'About the Programming Club': {
			'text': 'Learn more about the club',
			'url': '/about-us'
		},
		'Workshop archive': {
			'text': 'Past workshop material',
			'url': '/our-workshops'
		},
		'Club roadmap': {
			'url': '/roadmap',
			'text': 'See the club roadmap'
		}
	},
	'heroText': 'Workshops, seminars, and activities for programmers of all levels!',
	'cta': {
		'text': 'Stay tuned for the F24 sign up form!',
		'url': false // use a falsy value to disable the button
	},
	'eventsTitle': 'Upcoming events',
	'events': {
		// structure/template of an event object is the following:
		/*
		'Name of event': {
			'date': 'Event date here',
			'desc': 'Event description here. This can be long or short.',
		}
		*/
		'Fall 2024 semester starts!': {
			'date': 'Aug 19, 2024',
			'desc':
				'Welcome (back) to Marianopolis College :) If our club interests you, explore this website and join our Discord to find out more!'
		}
	}
};

// about us page
export const aboutUs = {
	'metaTitle': 'About us | Programming Club',
	'metaDesc': 'About the Marianopolis Programming Club',
	'title': 'About us',
	'intro':
		"Whether you're a beginner or expert, the Programming Club is the perfect place to start (or continue) your coding journey! Discover the joy of programming with our community through a multitude of activities.",
	'introImg': {
		'src': '/club-preview-1.svg',
		'alt':
			'Preview of club activities such as workshops, lessons, guest speakers, MariHacks, bake sale and more'
	},
	'whatWeOfferTitle': 'What the Programming Club offers:',
	'whatWeOffer': [
		'Workshops on many topics: Python, algorithms, web development and more (no experience required!)',
		'Seminars by guest speakers such as university professors and industry professionals',
		'Other fun coding events including mini-contests and MariHacks!'
	],
	'seeAlsoLinks': {
		'Join our Discord server!': {
			'text': 'Join our Discord community to learn more and ask us questions!',
			'url': 'https://discord.gg/BMvrpKJjej'
		},
		'Workshop archive': {
			'text': 'Past workshop material',
			'url': '/our-workshops'
		},
		'Club roadmap': {
			'url': '/roadmap',
			'text': 'See the club roadmap'
		}
	}
};

// our workshops page
export const ourWorkshops = {
	'metaTitle': 'Our workshops | Programming Club',
	'metaDesc': 'Archive of Programming Club workshop material',
	'title': 'Our workshops',
	'intro': "Here's the past material from our 2023-24 club workshops!",
	'workshops': {
		// structure/template of a workshop object is the following:
		// if there is no link for something (e.g. Colab) then just don't include it in 'links'
		// see `src/lib/components/Card.svelte` for full info
		/*
		'Name of workshop': {
			'series': 'Workshop series (e.g. Python basics)',
			'desc': 'Workshop description here. This can be long or short.',
			'links': {
				'Slides': 'Link to slides if there are any',
				'Colab': 'Link to Google Colab if any',
				'Code examples': 'Link to code examples, e.g. on GitHub, if applicable',
				'Link text': 'https://example.com',
			}
		}
		*/
		'#1: Intro to Python': {
			'series': 'Python basics',
			'desc':
				'The basics of Python: variables, data types, operations, conditional statements and loops.',
			'links': {
				'Slides':
					'https://docs.google.com/presentation/d/1MNX3TRe8Rzh_st2cG6TyUjDhHmbPRdsMHE0lI2--2Ho/edit?usp=drive_link',
				'Colab':
					'https://colab.research.google.com/drive/1UX_XKx1KWytoyxW7XACD2GparE-TPQU3?usp=sharing'
			}
		},
		'#2: Functions and lists': {
			'series': 'Python basics',
			'desc': 'More Python basics: loops, lists, functions, dictionaries, etc.',
			'links': {
				'Slides':
					'https://docs.google.com/presentation/d/1QVGR1s9O3rBgoNJ8uCYrX1818NZHO8ZBH3mKDcvxrZI/edit?usp=sharing'
			}
		},
		'#3: Manipulating dictionaries and lists': {
			'series': 'Python basics',
			'desc':
				'Dictionary and list manipulation: list and dictionary comprehensions, tuples, destructuring, etc.',
			'links': {
				'Slides':
					'https://docs.google.com/presentation/d/1rfqu_Dw09ZJm3pn5zqhRVWJ2DHssq5XXREJT0O5kYVM/edit?usp=sharing'
			}
		},
		'#3.5: Strings and files': {
			'series': 'Python basics',
			'desc': 'String and file basics: character codes, strings, manipulating files.',
			'links': {
				'Slides':
					'https://docs.google.com/presentation/d/1gnF6-zQ6X_ED3XhfKA_rlcbomAJhIHEeSqOYqPfrJLM/edit?usp=sharing'
			}
		},
		'#4: NumPy': {
			'series': 'Python libraries',
			'desc':
				'The fundamentals of the NumPy library: working with NumPy arrays (shape, dimension, operations...).',
			'links': {
				'Slides':
					'https://docs.google.com/presentation/d/1wuC7wCAerBPxLYiQRHgRp6zLSTp1cbIUUsiASsj94Co/edit?usp=sharing'
			}
		},
		'#5: Matplotlib': {
			'series': 'Python libraries',
			'desc': 'Matplotlib library basics: generating and customizing plots.',
			'links': {
				'Slides':
					'https://docs.google.com/presentation/d/1jkPRUiXcry1UExDtmLrt6JVCmVcy9O6KB5NBIjO1mXE/edit?usp=sharing'
			}
		},
		'#5.5: Review Workshop 1': {
			'series': 'Python review',
			'desc':
				'A review of everything we covered in previous workshops: the basics of Python and some Python libraries!',
			'links': {
				'Slides':
					'https://docs.google.com/presentation/d/1QETOIuXHtx2YUJXBGuVClhjnKoCCsB_mJs9dtq9KYpQ/edit?usp=sharing',
				'Problem set':
					'https://colab.research.google.com/drive/1GWQT1ciq4VNblDmxJPyom11JyqZg9EvV?usp=sharing',
				'Solution set':
					'https://colab.research.google.com/drive/1bSJggUXE4x-r3jQ8wwcGUAd14xQVuMs_?usp=sharing'
			}
		},
		'#6: Object-Oriented Programming 1': {
			'series': 'OOP with Python',
			'desc':
				'We start with basic OOP concepts (creating classes, etc.) and gradually delve into more advanced and interesting applications.',
			'links': {
				'Slides':
					'https://docs.google.com/presentation/d/1LNfJLjlheS1SMNjqB1aNcXEuXffYOkMywmSv4qvUDEQ/edit?usp=sharing',
				'Code examples': 'https://github.com/MariHacks/workshops-2023-2024/tree/main/OOP'
			}
		},
		'MariHacks special: Python Libraries': {
			'series': 'MariHacks prep',
			'desc':
				'We discuss lots of popular and useful Python libraries that could come in handy at MariHacks!',
			'links': {
				'Slides':
					'https://docs.google.com/presentation/d/1BP8OQZS9y7Ew_3Oq9zr1Ns2Ta2BVBLPtlPmfvu4RR34/edit?usp=sharing',
				'Code examples': 'https://github.com/MariHacks/workshops-2023-2024/tree/main/marihacks_prep'
			}
		}
	},
	'seeAlsoLinks': {
		'Join our Discord server!': {
			'text': 'Join our Discord community to learn more and ask us questions!',
			'url': 'https://discord.gg/BMvrpKJjej'
		},
		'About us': {
			'text': 'Learn more about the club',
			'url': '/about-us'
		},
		'Club roadmap': {
			'url': '/roadmap',
			'text': 'See the club roadmap'
		}
	}
};

// resources page
export const resources = {
	'metaTitle': 'Resources | Programming Club',
	'metaDesc': 'Programming resources recommended by our club execs',
	'title': 'Resources',
	'intro': 'Some helpful programming resources we recommend.',
	'recResources': {
		'Coding courses': {
			'freeCodeCamp': 'https://www.freecodecamp.org/learn',
			'Codecademy': 'https://www.codecademy.com/',
			'The Odin Project (web dev)': 'https://www.theodinproject.com/',
			'Harvard CS50x: Introduction to CS': 'https://cs50.harvard.edu/x/',
			'Google Developers Web (web dev)': 'https://web.dev/learn'
		},
		'Coding YouTube channels': {
			'freeCodeCamp on YT': 'https://www.youtube.com/@freecodecamp',
			'Tech with Tim': 'https://www.youtube.com/@TechWithTim',
			'Traversy Media': 'https://www.youtube.com/@TraversyMedia',
			'Coder Coder (web dev)': 'https://www.youtube.com/@TheCoderCoder',
			'Pooky Codes': 'https://www.youtube.com/@PookyCodes'
		},
		'Coding practice and forums': {
			'LeetCode': 'https://leetcode.com/',
			'Codewars': 'https://www.codewars.com/',
			'HackerRank': 'https://www.hackerrank.com/',
			'Frontend Mentor (frontend challenges)': 'https://www.frontendmentor.io/challenges',
			'Stack Overflow': 'https://stackoverflow.com/'
		}
	},
	'ctaTitle': 'Interested in coding, AI or hackathons?',
	'ctaBtns': {
		// the design is meant to have 3 buttons here, but you can technically add/remove
		'Join our Discord server': 'https://discord.gg/BMvrpKJjej',
		'Check out the AI Club': 'https://mariai.surge.sh/',
		'We also organize MariHacks!': 'https://www.marihacks.com/'
	},
	'seeAlsoLinks': {
		'About us': {
			'text': 'Learn more about the club',
			'url': '/about-us'
		},
		'Workshop archive': {
			'text': 'Past workshop material',
			'url': '/our-workshops'
		},
		'Club roadmap': {
			'url': '/roadmap',
			'text': 'See the club roadmap'
		}
	}
};

// roadmap page
export const roadmap = {
	'metaTitle': 'Roadmap | Programming Club',
	'metaDesc': 'Roadmap of Programming Club activities',
	'title': 'Roadmap',
	'intro':
		"This is a (tentative) roadmap of our Winter 2024 activities. Suggestions/requests are welcome: don't hesitate to contact us on Discord, Instagram or Omnivox :)",
	'activities': {
		// structure of an activity/roadmap object is as follows:
		/*
		'Name of activity/series': {
			'timeline': 'Estimated timeline (e.g. early Jan - Feb)',
			'list': [
				'Some plans here',
				'More plans here',
				'Even more plans here!',
			],
			'links': {
				'Optional link text if you want some links': 'url',
				'Another link if you'd like': 'url2',
			}
		}
		*/
		'Weeks 1-2: Object-oriented programming': {
			'timeline': 'Early - mid February',
			'list': [
				'The OOP paradigm',
				'Classes and objects',
				'Encapsulation, inheritance, polymorphism'
			]
		},
		'Weeks 2-3: Algorithms and DS': {
			'timeline': 'Mid - end of February',
			'list': [
				'Computing competition prep',
				'Algorithms (sorting, searching, etc.)',
				'Data structures (hash tables, stacks, linked lists, etc.)',
				'Time and space complexity'
			]
		},
		'Weeks 3-5: Web development': {
			'timeline': 'End of February - mid March',
			'list': ['HTML and CSS', 'JavaScript', 'Depending on interest and participation: React.js']
		},
		'Weeks 6-8: Applications of Python': {
			'timeline': 'Mid March - early April',
			'list': [
				'Topics to be confirmed based on interest and resources',
				'Data science',
				'Back-end development'
			]
		},
		'Week 9: MariHacks VII': {
			'timeline': 'April 5-6',
			'list': [
				'24-hour in-person hackathon at Marianopolis',
				'Open to high school and CEGEP students',
				'Beginner and advanced challenges',
				'Workshops and seminars',
				'Free food and prizes!'
			],
			'links': { 'MariHacks website': 'https://www.marihacks.com/' }
		}
	},
	'seeAlsoLinks': {
		'Join our Discord server!': {
			'text': 'Join our Discord community to learn more and ask us questions!',
			'url': 'https://discord.gg/BMvrpKJjej'
		},
		'About us': {
			'text': 'Learn more about the club',
			'url': '/about-us'
		},
		'Workshop archive': {
			'text': 'Past workshop material',
			'url': '/our-workshops'
		}
	}
};
