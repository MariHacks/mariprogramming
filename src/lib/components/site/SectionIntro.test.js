import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import SectionIntro from './SectionIntro.svelte';

describe('SectionIntro', () => {
	it('orients students with one page title and the supplied context', () => {
		render(SectionIntro, {
			props: {
				eyebrow: 'Workshops',
				title: 'Build something after class',
				summary: 'Find hands-on sessions led by Marianopolis students.'
			}
		});

		expect(
			screen.getByRole('heading', { level: 1, name: 'Build something after class' })
		).toBeInTheDocument();
		expect(screen.getByText('Workshops')).toHaveClass('eyebrow');
		expect(screen.getByText('Find hands-on sessions led by Marianopolis students.')).toHaveClass(
			'summary'
		);
	});

	it('omits optional elements when their content is empty', () => {
		const { container } = render(SectionIntro, {
			props: { title: 'Club resources', eyebrow: '', summary: '' }
		});

		expect(container.querySelector('header')).toBeInTheDocument();
		expect(container.querySelector('.eyebrow')).not.toBeInTheDocument();
		expect(container.querySelector('.summary')).not.toBeInTheDocument();
	});
});
