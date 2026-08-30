// @ts-nocheck

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ProfilePage from './+page.svelte';

afterEach(cleanup);

const USER = 'user-1';
const THREAD = '20000000-0000-4000-8000-000000000001';

describe('public profile page', () => {
	it('shows display name and recent threads', () => {
		render(ProfilePage, {
			data: {
				unavailable: false,
				viewerSignedIn: false,
				viewerIsStaff: false,
				profile: {
					userId: USER,
					displayName: 'Ada Lovelace',
					role: 'student',
					isRestricted: false,
					isMuted: false,
					isBanned: false
				},
				threads: [
					{
						id: THREAD,
						title: 'Quiet study hall',
						createdAt: '2026-08-28T16:00:00.000Z'
					}
				]
			}
		});
		expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /Quiet study hall/i })).toHaveAttribute(
			'href',
			`/tools/forum/${THREAD}`
		);
		expect(screen.queryByText(USER)).not.toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: 'Staff moderation' })).not.toBeInTheDocument();
	});

	it('shows remaining mute time and staff duration controls', () => {
		const mutedUntil = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
		render(ProfilePage, {
			data: {
				unavailable: false,
				viewerSignedIn: true,
				viewerIsStaff: true,
				profile: {
					userId: USER,
					displayName: 'Ada Lovelace',
					role: 'student',
					isRestricted: true,
					isMuted: true,
					isBanned: false,
					mutedUntil
				},
				threads: []
			}
		});
		expect(screen.getByText(/Muted ·/)).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Staff moderation' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
		expect(screen.getByLabelText('Ban for')).toBeInTheDocument();
	});

	it('shows an unavailable alert', () => {
		render(ProfilePage, {
			data: {
				unavailable: true,
				profile: null,
				threads: [],
				viewerSignedIn: false,
				viewerIsStaff: false
			}
		});
		expect(screen.getByRole('alert')).toHaveTextContent(/unavailable/i);
	});
});
