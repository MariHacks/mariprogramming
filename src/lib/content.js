import { clubContent } from './content/club.js';

export { clubContent, getUpcomingEvents, getWorkshopTracks } from './content/club.js';

// Compatibility exports for the legacy views. Each view will consume clubContent directly as it is
// redesigned, at which point this bridge can be removed.
/**
 * @param {{ label: string, url: string }[]} links
 * @returns {Record<string, string>}
 */
const toLegacyLinks = (links) => Object.fromEntries(links.map(({ label, url }) => [label, url]));
const { communityAction } = clubContent;

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
		text: communityAction.label,
		url: communityAction.url
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
	brand: `\u003cThe ${clubContent.name}\u00a0/\u003e`,
	socials: Object.fromEntries(
		clubContent.socialLinks.map(({ label, url, icon }) => [
			label,
			{ url, icon, iconAlt: `${label} logo`, height: 30 }
		])
	)
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
		text: communityAction.label,
		url: communityAction.url
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
		'Find club updates and event announcements through our current community channel.'
	],
	seeAlsoLinks: {
		[communityAction.label]: {
			text: 'Follow club updates and reach the community',
			url: communityAction.url
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
		[communityAction.label]: {
			text: 'See current workshop announcements',
			url: communityAction.url
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
		[communityAction.label]: communityAction.url,
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
		'No activities are scheduled here right now. Follow the club for new dates as they are confirmed.',
	activities: {},
	seeAlsoLinks: {
		[communityAction.label]: {
			text: 'Get current club announcements',
			url: communityAction.url
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
		[communityAction.label]: {
			text: 'Follow club updates and reach the community',
			url: communityAction.url
		}
	}
};
