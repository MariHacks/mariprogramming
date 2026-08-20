import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { clubContent, getWorkshopTracks } from '$lib/content/club';
import WorkshopsPage from './+page.svelte';

afterEach(cleanup);

const workshopDestinations = [
	{
		name: 'Open Intro to Python Slides',
		url: 'https://docs.google.com/presentation/d/1MNX3TRe8Rzh_st2cG6TyUjDhHmbPRdsMHE0lI2--2Ho/edit?usp=drive_link'
	},
	{
		name: 'Open Intro to Python Colab',
		url: 'https://colab.research.google.com/drive/1UX_XKx1KWytoyxW7XACD2GparE-TPQU3?usp=sharing'
	},
	{
		name: 'Open Functions and lists Slides',
		url: 'https://docs.google.com/presentation/d/1QVGR1s9O3rBgoNJ8uCYrX1818NZHO8ZBH3mKDcvxrZI/edit?usp=sharing'
	},
	{
		name: 'Open Working with lists and dictionaries Slides',
		url: 'https://docs.google.com/presentation/d/1rfqu_Dw09ZJm3pn5zqhRVWJ2DHssq5XXREJT0O5kYVM/edit?usp=sharing'
	},
	{
		name: 'Open Strings and files Slides',
		url: 'https://docs.google.com/presentation/d/1gnF6-zQ6X_ED3XhfKA_rlcbomAJhIHEeSqOYqPfrJLM/edit?usp=sharing'
	},
	{
		name: 'Open NumPy Slides',
		url: 'https://docs.google.com/presentation/d/1wuC7wCAerBPxLYiQRHgRp6zLSTp1cbIUUsiASsj94Co/edit?usp=sharing'
	},
	{
		name: 'Open Matplotlib Slides',
		url: 'https://docs.google.com/presentation/d/1jkPRUiXcry1UExDtmLrt6JVCmVcy9O6KB5NBIjO1mXE/edit?usp=sharing'
	},
	{
		name: 'Open Python review Slides',
		url: 'https://docs.google.com/presentation/d/1QETOIuXHtx2YUJXBGuVClhjnKoCCsB_mJs9dtq9KYpQ/edit?usp=sharing'
	},
	{
		name: 'Open Python review Problem set',
		url: 'https://colab.research.google.com/drive/1GWQT1ciq4VNblDmxJPyom11JyqZg9EvV?usp=sharing'
	},
	{
		name: 'Open Python review Solutions',
		url: 'https://colab.research.google.com/drive/1bSJggUXE4x-r3jQ8wwcGUAd14xQVuMs_?usp=sharing'
	},
	{
		name: 'Open Object-oriented Python Slides',
		url: 'https://docs.google.com/presentation/d/1LNfJLjlheS1SMNjqB1aNcXEuXffYOkMywmSv4qvUDEQ/edit?usp=sharing'
	},
	{
		name: 'Open Object-oriented Python Code examples',
		url: 'https://github.com/MariHacks/workshops-2023-2024/tree/main/OOP'
	},
	{
		name: 'Open Python libraries for hackathons Slides',
		url: 'https://docs.google.com/presentation/d/1BP8OQZS9y7Ew_3Oq9zr1Ns2Ta2BVBLPtlPmfvu4RR34/edit?usp=sharing'
	},
	{
		name: 'Open Python libraries for hackathons Code examples',
		url: 'https://github.com/MariHacks/workshops-2023-2024/tree/main/marihacks_prep'
	}
];

describe('workshops route', () => {
	it('labels the archive with only its necessary source context', () => {
		const { container } = render(WorkshopsPage);

		expect(screen.getByRole('heading', { level: 1, name: 'Workshop archive' })).toBeInTheDocument();
		expect(container.querySelectorAll('h1')).toHaveLength(1);
		expect(screen.getByText('Original workshop materials made by the club.')).toBeInTheDocument();
		expect(container).not.toHaveTextContent(/2023|2024/);
		expect(document.title).toBe(`Workshops | ${clubContent.name}`);
		expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
			'content',
			expect.stringMatching(/workshop materials/i)
		);
	});

	it('groups every workshop under its real learning track in source order', () => {
		render(WorkshopsPage);

		const tracks = /** @type {Record<string, Array<(typeof clubContent.workshops)[number]>>} */ (
			getWorkshopTracks(clubContent.workshops)
		);
		const trackHeadings = screen.getAllByRole('heading', { level: 2 });

		expect(trackHeadings.map(({ textContent }) => textContent)).toEqual(Object.keys(tracks));

		for (const [trackName, workshops] of Object.entries(tracks)) {
			const trackSection = screen.getByRole('region', { name: trackName });
			const workshopHeadings = within(trackSection).getAllByRole('heading', { level: 3 });

			expect(workshopHeadings.map(({ textContent }) => textContent)).toEqual(
				workshops.map(({ title }) => title)
			);
		}

		expect(screen.getByText(clubContent.workshops[0].description)).toBeInTheDocument();
	});

	it('keeps every authentic workshop material directly accessible and opens it safely', () => {
		render(WorkshopsPage);

		expect(screen.getAllByRole('link')).toHaveLength(workshopDestinations.length);

		for (const destination of workshopDestinations) {
			const link = screen.getByRole('link', { name: destination.name });

			expect(link).toHaveAttribute('href', destination.url);
			expect(link).toHaveAttribute('target', '_blank');
			expect(link).toHaveAttribute('rel', 'external noopener noreferrer');
		}
	});

	it('keeps the archive free from commerce or legacy UI', () => {
		const { container } = render(WorkshopsPage);
		expect(container).not.toHaveTextContent(/discord|fall 2024|coming soon/i);
		expect(container).not.toHaveTextContent(/\bcart\b|checkout|pickup|service fee|\$[0-9]/i);
		expect(screen.queryByRole('link', { name: /cart/i })).not.toBeInTheDocument();
	});
});
