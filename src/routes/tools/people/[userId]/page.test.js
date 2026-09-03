// @ts-nocheck

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ProfilePage from './+page.svelte';

afterEach(cleanup);

const USER = 'user-1';
const THREAD = '20000000-0000-4000-8000-000000000001';

describe('public profile page', () => {
	it('shows the case-preserved username, full name, profile picture, tenure, and recent posts', () => {
		render(ProfilePage, {
			data: {
				unavailable: false,
				viewerSignedIn: false,
				viewerIsStaff: false,
				profile: {
					userId: USER,
					username: 'AdaCodes',
					displayName: 'Ada Lovelace',
					profileImageDataUrl: 'data:image/png;base64,YXZhdGFy',
					role: 'executive',
					joinedAt: '2025-09-01T12:00:00.000Z',
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
		expect(screen.getByRole('heading', { name: 'AdaCodes' })).toBeInTheDocument();
		expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
		expect(screen.getByRole('img', { name: 'Ada Lovelace profile picture' })).toHaveAttribute(
			'src',
			'data:image/png;base64,YXZhdGFy'
		);
		expect(screen.getByText('Executive since Sep 2025')).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Recent posts' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Course outlines' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /Quiet study hall/i })).toHaveAttribute(
			'href',
			`/tools/forum/${THREAD}`
		);
		expect(screen.queryByText(USER)).not.toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: 'Moderation' })).not.toBeInTheDocument();
	});

	it('uses initials and polished empty states without exposing restrictions to visitors', () => {
		render(ProfilePage, {
			data: {
				unavailable: false,
				viewerSignedIn: false,
				viewerIsStaff: false,
				profile: {
					userId: USER,
					username: 'GraceH',
					displayName: 'Grace Hopper',
					profileImageDataUrl: null,
					role: 'student',
					joinedAt: null,
					isRestricted: true,
					isMuted: true,
					isBanned: false
				},
				threads: [],
				courseOutlines: []
			}
		});

		expect(screen.getByText('GH')).toBeInTheDocument();
		expect(screen.getByText('Member')).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'No posts yet' })).toBeInTheDocument();
		expect(screen.getByText('This member has not started a discussion yet.')).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'No outlines yet' })).toBeInTheDocument();
		expect(screen.getByText('This member has not shared any course outlines yet.')).toBeInTheDocument();
		expect(screen.queryByText(/Muted|Restricted|Banned/)).not.toBeInTheDocument();
	});

	it('renders shared course outlines when the public data includes them', () => {
		render(ProfilePage, {
			data: {
				unavailable: false,
				viewerSignedIn: false,
				viewerIsStaff: false,
				profile: {
					userId: USER,
					username: 'AdaCodes',
					displayName: 'Ada Lovelace',
					role: 'student',
					isRestricted: false,
					isMuted: false,
					isBanned: false
				},
				threads: [],
				courseOutlines: [
					{
						sha256: 'ab'.repeat(32),
						courseCode: '420-201-RE',
						title: 'Programming II',
						createdAt: '2026-08-28T16:00:00.000Z'
					}
				]
			}
		});

		expect(screen.getByText('420-201-RE')).toBeInTheDocument();
		expect(screen.getByText('Programming II')).toBeInTheDocument();
		expect(screen.getByText('Aug 28')).toBeInTheDocument();
	});

	it('shows remaining mute time and staff mute/ban buttons', () => {
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
		expect(screen.getByText(/Muted,/)).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Moderation' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Ban' })).toBeInTheDocument();
		expect(screen.queryByLabelText('Ban for')).not.toBeInTheDocument();
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
