import { cleanup, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import RequestPage from './+page.svelte';

afterEach(cleanup);

function requestData() {
	return /** @type {any} */ ({
		launchState: 'live',
		unavailable: false,
		teachers: [{ id: '10000000-0000-4000-8000-000000000001', name: 'Mme Tremblay' }],
		courses: [
			{
				id: '20000000-0000-4000-8000-000000000001',
				code: 'FRE-101',
				title: 'French 101'
			}
		],
		clientRequestId: '30000000-0000-4000-8000-000000000001',
		contact: {
			inquiry: {
				label: 'Email the team',
				href: 'mailto:team@marihacks.com?subject=Programming%20Club%20inquiry'
			},
			bug: {
				label: 'Report a bug',
				href: 'mailto:team@marihacks.com?subject=Programming%20Club%20bug%20report'
			}
		}
	});
}

describe('book request form', () => {
	it('keeps the contact links and Other options on the form', () => {
		render(RequestPage, {
			props: {
				data: requestData(),
				form: /** @type {any} */ ({})
			}
		});
		expect(screen.getByRole('heading', { name: 'Request a book we do not carry' })).toBeVisible();
		expect(document.body).not.toHaveTextContent(/we will email you/i);
		expect(screen.getByRole('link', { name: 'Email the team' })).toHaveAttribute(
			'href',
			'mailto:team@marihacks.com?subject=Programming%20Club%20inquiry'
		);
		expect(screen.getByRole('link', { name: 'Report a bug' })).toHaveAttribute(
			'href',
			'mailto:team@marihacks.com?subject=Programming%20Club%20bug%20report'
		);
		expect(screen.getByRole('combobox', { name: 'Catalogue teacher' })).toBeVisible();
		expect(screen.getAllByRole('option', { name: 'Other' })).toHaveLength(2);
		expect(screen.getByRole('button', { name: 'Submit request' })).toHaveAttribute('type', 'submit');
	});

	it('reveals the other teacher and course textboxes after Other is selected', async () => {
		const user = userEvent.setup();
		render(RequestPage, {
			props: {
				data: requestData(),
				form: /** @type {any} */ ({})
			}
		});
		expect(screen.getByLabelText('Other teacher')).not.toBeVisible();
		await user.selectOptions(screen.getByRole('combobox', { name: 'Catalogue teacher' }), 'other');
		expect(screen.getByLabelText('Other teacher')).toBeVisible();
		await user.selectOptions(screen.getByRole('combobox', { name: 'Catalogue course' }), 'other');
		expect(screen.getByLabelText('Other course')).toBeVisible();
	});
});
