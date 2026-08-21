import { cleanup, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StaffLayout from './+layout.svelte';

vi.mock('$lib/auth/staff-sign-out.js', () => ({ endStaffSession: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

const STAFF = Object.freeze({
	userId: 'staff-user',
	sessionId: 'staff-session',
	email: 'team@marihacks.com',
	googleSubject: 'google-subject',
	expiresAt: new Date('2026-08-14T00:00:00.000Z')
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('protected staff shell', () => {
	it('uses Programming Club identity and a compact factual operations nav', () => {
		render(StaffLayout, { data: { staff: STAFF, pathname: '/staff' } });
		expect(screen.getByRole('banner')).toHaveTextContent('Programming Club Staff');
		expect(screen.getByRole('presentation')).toHaveAttribute('src', '/logo-icon.svg');
		expect(screen.getByRole('presentation')).toHaveClass('brand-mark');
		expect(screen.getByRole('link', { name: 'Catalogue' })).toHaveAttribute(
			'href',
			'/staff/catalogue/entries'
		);
		expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/staff');
		expect(screen.getByRole('link', { name: 'Book work' })).toHaveAttribute(
			'href',
			'/staff/book-work'
		);
		expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');
		expect(screen.getByRole('link', { name: 'Catalogue' })).not.toHaveAttribute(
			'aria-current',
			'page'
		);
		expect(screen.getByText(STAFF.email)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Sign out' })).toHaveAttribute('type', 'submit');
		expect(document.body).not.toHaveTextContent('MariHacks Staff');
		expect(screen.queryByRole('link', { name: 'Sign up' })).not.toBeInTheDocument();
	});

	it('signs out once, announces progress, and returns to staff access', async () => {
		const { endStaffSession } = await import('$lib/auth/staff-sign-out.js');
		const { goto } = await import('$app/navigation');
		vi.mocked(endStaffSession).mockResolvedValue(true);
		vi.mocked(goto).mockResolvedValue(undefined);
		const user = userEvent.setup();
		render(StaffLayout, { data: { staff: STAFF, pathname: '/staff' } });
		const button = screen.getByRole('button', { name: 'Sign out' });
		await user.click(button);
		expect(endStaffSession).toHaveBeenCalledOnce();
		expect(goto).toHaveBeenCalledWith('/staff/sign-in');
		expect(screen.getByRole('status')).toHaveTextContent('Signing out');
		expect(button).toBeDisabled();
	});

	it('keeps sign out recoverable without exposing an internal error', async () => {
		const { endStaffSession } = await import('$lib/auth/staff-sign-out.js');
		vi.mocked(endStaffSession).mockRejectedValue(new Error('session database secret'));
		const user = userEvent.setup();
		render(StaffLayout, { data: { staff: STAFF, pathname: '/staff' } });
		await user.click(screen.getByRole('button', { name: 'Sign out' }));
		expect(screen.getByRole('alert')).toHaveTextContent('Sign out is unavailable. Try again.');
		expect(document.body).not.toHaveTextContent('session database secret');
		expect(screen.getByRole('button', { name: 'Sign out' })).not.toBeDisabled();
	});

	it('does not show the protected shell on the public sign-in route', () => {
		render(StaffLayout, { data: { staff: null, pathname: '/staff/sign-in' } });
		expect(screen.queryByRole('banner')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
	});

	it('marks catalogue active only throughout catalogue routes', () => {
		render(StaffLayout, {
			data: { staff: STAFF, pathname: '/staff/catalogue/books' }
		});
		expect(screen.getByRole('link', { name: 'Catalogue' })).toHaveAttribute('aria-current', 'page');
		expect(screen.getByRole('link', { name: 'Orders' })).not.toHaveAttribute(
			'aria-current',
			'page'
		);
	});
});
