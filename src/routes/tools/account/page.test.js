import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { NIM_DISCLOSURE } from '$lib/server/maritools/community.js';
import AccountPage from './+page.svelte';

afterEach(cleanup);

const base = {
	callbackURL: 'https://club.example.com/tools/account',
	recoveryMessage: null,
	nimDisclosure: NIM_DISCLOSURE
};

describe('account page', () => {
	it('offers Google sign-in to a guest', () => {
		render(AccountPage, { props: { data: { ...base, view: { kind: 'guest' } } } });
		expect(screen.getByRole('heading', { name: 'Your account' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
		expect(screen.queryByLabelText('Student number')).not.toBeInTheDocument();
	});

	it('asks for a student number and NVIDIA disclosure without showing an existing id', () => {
		render(AccountPage, {
			props: { data: { ...base, view: { kind: 'incomplete', email: 'ada@gmail.com' } } }
		});
		expect(screen.getByText('ada@gmail.com')).toBeInTheDocument();
		expect(screen.getByLabelText('Student number')).toBeInTheDocument();
		expect(screen.getByText(NIM_DISCLOSURE)).toBeInTheDocument();
		expect(screen.queryByText('2530622')).not.toBeInTheDocument();
	});

	it('shows a completed profile without the student number', () => {
		render(AccountPage, {
			props: {
				data: {
					...base,
					view: {
						kind: 'complete',
						email: 'ada@gmail.com',
						displayName: 'Ada',
						nimAccepted: true
					}
				}
			}
		});
		expect(screen.getByText('ada@gmail.com')).toBeInTheDocument();
		expect(screen.getByText('Ada')).toBeInTheDocument();
		expect(screen.getByText('Saved, and kept off other pages.')).toBeInTheDocument();
		expect(screen.queryByText('2530622')).not.toBeInTheDocument();
	});

	it('asks for disclosure on a saved account and surfaces form state', () => {
		render(AccountPage, {
			props: {
				data: {
					...base,
					recoveryMessage: 'We could not finish sign-in. Try again.',
					unavailable: true,
					view: {
						kind: 'complete',
						email: 'ada@gmail.com',
						displayName: null,
						nimAccepted: false
					}
				},
				form: { error: 'Confirm the NVIDIA disclosure before saving.' }
			}
		});
		expect(screen.getByText('We could not finish sign-in. Try again.')).toBeInTheDocument();
		expect(screen.getByText('Account details are unavailable right now. Try again.')).toBeInTheDocument();
		expect(screen.getByText('Confirm the NVIDIA disclosure before saving.')).toBeInTheDocument();
		expect(screen.getByText('Not accepted yet')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Save account' })).toBeInTheDocument();
	});

	it('confirms a saved account', () => {
		render(AccountPage, {
			props: {
				data: {
					...base,
					view: {
						kind: 'complete',
						email: 'ada@gmail.com',
						displayName: 'Ada',
						nimAccepted: true
					}
				},
				form: { success: true }
			}
		});
		expect(screen.getByText('Account saved.')).toBeInTheDocument();
	});
});
