import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import SocialIcon from './SocialIcon.svelte';

describe('SocialIcon', () => {
	it('draws a mail envelope for the team mailbox', () => {
		const { container } = render(SocialIcon, { props: { name: 'Mail' } });
		const icon = container.querySelector('svg');

		expect(icon).not.toBeNull();
		expect(icon).toHaveAttribute('aria-hidden', 'true');
		expect(icon).toHaveAttribute('viewBox', '0 0 24 24');
	});
});
