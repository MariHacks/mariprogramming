import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { clubContent, getWorkshopTracks } from '$lib/content/club';
import WorkshopsPage from './+page.svelte';

afterEach(cleanup);

describe('workshops route', () => {
	it('introduces a truthful self-paced archive with useful metadata', () => {
		const { container } = render(WorkshopsPage);

		expect(
			screen.getByRole('heading', { level: 1, name: 'Learn from the workshop archive' })
		).toBeInTheDocument();
		expect(container.querySelectorAll('h1')).toHaveLength(1);
		expect(screen.getByText(/self-paced archive/i)).toBeInTheDocument();
		expect(screen.getByText(/2023–2024 source term/i)).toBeInTheDocument();
		expect(document.title).toBe(`Workshops | ${clubContent.name}`);
		expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
			'content',
			expect.stringMatching(/workshop archive/i)
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

		for (const workshop of clubContent.workshops) {
			for (const material of workshop.links) {
				const link = screen.getByRole('link', {
					name: `Open ${workshop.title} ${material.label}`
				});

				expect(link).toHaveAttribute('href', material.url);
				expect(link).toHaveAttribute('target', '_blank');
				expect(link).toHaveAttribute('rel', 'noopener noreferrer');
			}
		}
	});

	it('ends with the current community action and never leaks commerce or legacy UI', () => {
		const { container } = render(WorkshopsPage);
		const communityLink = screen.getByRole('link', {
			name: clubContent.communityAction.label
		});

		expect(communityLink).toHaveAttribute('href', clubContent.communityAction.url);
		expect(communityLink).toHaveAttribute('target', '_blank');
		expect(communityLink).toHaveAttribute('rel', 'noopener noreferrer');
		expect(container).not.toHaveTextContent(/discord|fall 2024|coming soon/i);
		expect(container).not.toHaveTextContent(/\bcart\b|checkout|pickup|service fee|\$[0-9]/i);
		expect(screen.queryByRole('link', { name: /cart/i })).not.toBeInTheDocument();
	});
});
