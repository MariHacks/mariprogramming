import { clubContent } from './content/club.js';

export { clubContent, getUpcomingEvents, getWorkshopTracks } from './content/club.js';

// Compatibility exports for the legacy views. Each view will consume clubContent directly as it is
// redesigned, at which point this bridge can be removed.
/**
 * @param {{ label: string, url: string }[]} links
 * @returns {Record<string, string>}
 */
const toLegacyLinks = (links) => Object.fromEntries(links.map(({ label, url }) => [label, url]));

export const topNav = {
	left: {
		Home: '/',
		'About us': '/about-us',
		'Our workshops': '/our-workshops'
	},
	right: {
		Resources: '/resources'
	},
	cta: {
		text: 'Join Discord',
		url: clubContent.joinUrl
	},
	brand: {
		imgSm: '/logo-icon.svg',
		imgFull: '/logo-full.svg',
		imgHeightSm: 40,
		imgHeightFull: 40,
		imgAlt: 'Marianopolis Programming Club logo'
	}
};

export const footer = {
	brand: '\u003cThe Marianopolis Programming Club\u00a0/\u003e',
	socials: {
		GitHub: {
			url: 'https://github.com/MariHacks',
			icon: '/socials/github.svg',
			iconAlt: 'GitHub logo',
			height: 30
		},
		Discord: {
			url: clubContent.joinUrl,
			icon: '/socials/discord.svg',
			iconAlt: 'Discord logo',
			height: 30
		},
		Instagram: {
			url: 'https://www.instagram.com/mari_programming_club/',
			icon: '/socials/instagram.svg',
			iconAlt: 'Instagram logo',
			height: 30
		},
		MariHacks: {
			url: 'https://www.marihacks.com/',
			icon: '/socials/marihacks.png',
			iconAlt: 'MariHacks logo',
			height: 30
		}
	}
};

export const home = {
	metaTitle: 'Marianopolis Programming Club',
	metaDesc: clubContent.mission,
	seeAlsoLinks: {
		'About the Programming Club': {
			text: 'Learn more about the club',
			url: '/about-us'
		},
		'Workshop archive': {
			text: 'Explore club-made workshop material',
			url: '/our-workshops'
		}
	},
	heroText: clubContent.mission,
	cta: {
		text: 'Join the Discord',
		url: clubContent.joinUrl
	},
	eventsTitle: 'Upcoming events',
	events: {}
};

export const aboutUs = {
	metaTitle: 'About us | Programming Club',
	metaDesc: 'Learn about the Marianopolis Programming Club and how to take part.',
	title: 'About us',
	intro: clubContent.mission,
	introImg: {
		src: '/club-preview-1.svg',
		alt: 'A collage of Programming Club workshops, projects, and community activities'
	},
	whatWeOfferTitle: 'What you can do with the Programming Club',
	whatWeOffer: [
		'Learn programming fundamentals through beginner-friendly workshops.',
		'Build projects with other students and share what you discover.',
		'Find club updates, learning help, and event announcements in the Discord community.'
	],
	seeAlsoLinks: {
		'Join our Discord server': {
			text: 'Meet the community, ask questions, and get current updates',
			url: clubContent.joinUrl
		},
		'Workshop archive': {
			text: 'Explore club-made workshop material',
			url: '/our-workshops'
		}
	}
};

export const ourWorkshops = {
	metaTitle: 'Workshops | Programming Club',
	metaDesc: 'Programming Club workshop material organized by learning track.',
	title: 'Workshops',
	intro: 'Choose a learning track and work through club-made lessons at your own pace.',
	workshops: Object.fromEntries(
		clubContent.workshops.map((workshop) => [
			workshop.title,
			{
				series: workshop.track,
				desc: workshop.description,
				links: toLegacyLinks(workshop.links)
			}
		])
	),
	seeAlsoLinks: {
		'Join our Discord server': {
			text: 'Ask a question or hear about the next workshop',
			url: clubContent.joinUrl
		},
		'About us': {
			text: 'Learn more about the club',
			url: '/about-us'
		}
	}
};

export const resources = {
	metaTitle: 'Resources | Programming Club',
	metaDesc: 'Beginner-friendly programming resources recommended by the club.',
	title: 'Resources',
	intro: 'Pick the path that matches what you want to learn or build next.',
	recResources: Object.fromEntries(
		clubContent.resources.map((resource) => [resource.title, toLegacyLinks(resource.links)])
	),
	ctaTitle: 'Keep learning with the Marianopolis community',
	ctaBtns: {
		'Join our Discord server': clubContent.joinUrl,
		'Visit the AI Club': 'https://mariai.surge.sh/',
		'Explore MariHacks': 'https://www.marihacks.com/'
	},
	seeAlsoLinks: {
		'About us': {
			text: 'Learn more about the club',
			url: '/about-us'
		},
		'Workshop archive': {
			text: 'Explore club-made workshop material',
			url: '/our-workshops'
		}
	}
};

export const roadmap = {
	metaTitle: 'Club updates | Programming Club',
	metaDesc: 'Current Programming Club activities and announcements.',
	title: 'Club updates',
	intro:
		'No activities are scheduled here right now. Join the Discord for new dates as they are confirmed.',
	activities: {},
	seeAlsoLinks: {
		'Join our Discord server': {
			text: 'Get current club announcements',
			url: clubContent.joinUrl
		},
		'Workshop archive': {
			text: 'Explore club-made workshop material',
			url: '/our-workshops'
		}
	}
};

export const errorContent = {
	metaDesc: 'Marianopolis Programming Club',
	intro: 'We could not find the page you were looking for.',
	info: 'Use one of the links below or reach out to the club for help.',
	contact: {
		Discord: 'Join the community server and ask an executive for help.',
		Instagram: 'Message @mari_programming_club.',
		Omnivox: 'Send a MIO to a current club executive.'
	},
	seeAlsoLinks: {
		Home: {
			text: 'Return to the home page',
			url: '/'
		},
		'About us': {
			text: 'Learn more about the club',
			url: '/about-us'
		},
		'Workshop archive': {
			text: 'Explore club-made workshop material',
			url: '/our-workshops'
		},
		Resources: {
			text: 'Browse recommended programming resources',
			url: '/resources'
		},
		'Join our Discord server': {
			text: 'Join the community and ask a question',
			url: clubContent.joinUrl
		}
	}
};
