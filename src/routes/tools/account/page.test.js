import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NIM_DISCLOSURE } from '$lib/server/maritools/community.js';
import AccountPage from './+page.svelte';

vi.mock('$lib/auth/staff-sign-out.js', () => ({
	endStaffSession: vi.fn(async () => true)
}));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

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
		expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
	});

	it('asks for a student number and NVIDIA disclosure without showing an existing id', () => {
		render(AccountPage, {
			props: { data: { ...base, view: { kind: 'incomplete', email: 'ada@gmail.com' } } }
		});
		expect(screen.getByText('ada@gmail.com')).toBeInTheDocument();
		expect(screen.getByLabelText('Student number')).toBeInTheDocument();
		expect(screen.getByText(NIM_DISCLOSURE)).toBeInTheDocument();
		expect(screen.getByText('Encrypted')).toBeInTheDocument();
		expect(screen.getByText('Never displayed publicly')).toBeInTheDocument();
		expect(screen.getByText('How your student number is protected')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
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
		expect(screen.getByText('Saved')).toBeInTheDocument();
		expect(screen.getByText('Kept off other pages')).toBeInTheDocument();
		expect(screen.getByText('Encrypted')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
		expect(screen.queryByText('2530622')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Delete account' })).not.toBeInTheDocument();
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
		expect(
			screen.getByText('Account details are unavailable right now. Try again.')
		).toBeInTheDocument();
		expect(screen.getByText('Confirm the NVIDIA disclosure before saving.')).toBeInTheDocument();
		expect(screen.getByText('Not accepted yet')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
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

	it('signs the student out and returns to the account page', async () => {
		const { endStaffSession } = await import('$lib/auth/staff-sign-out.js');
		const assign = vi.fn();
		vi.stubGlobal('location', { assign });
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
		await fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
		expect(endStaffSession).toHaveBeenCalled();
		expect(assign).toHaveBeenCalledWith('/tools/account');
	});

	it('keeps the student signed in when sign out fails', async () => {
		const { endStaffSession } = await import('$lib/auth/staff-sign-out.js');
		endStaffSession.mockRejectedValueOnce(new Error('Sign out is unavailable'));
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
		await fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
		expect(screen.getByText('Sign out is unavailable. Try again.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
	});
});
