// @ts-nocheck

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ReportsPage from './+page.svelte';

const THREAD = '20000000-0000-4000-8000-000000000001';
const REPORT = '40000000-0000-4000-8000-000000000001';

afterEach(() => {
	cleanup();
});

describe('staff reports page', () => {
	it('renders the open report queue with target and reason', () => {
		render(ReportsPage, {
			data: {
				statusFilter: 'open',
				unavailable: false,
				reports: [
					{
						id: REPORT,
						targetKind: 'thread',
						targetId: THREAD,
						threadId: THREAD,
						reporterUserId: 'reporter-1',
						reason: 'spam in the title',
						status: 'open',
						resolvedAt: null,
						createdAt: '2026-08-28T16:00:00.000Z',
						href: `/tools/forum/${THREAD}`
					}
				]
			}
		});
		expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();
		expect(screen.getByText('spam in the title')).toBeInTheDocument();
		expect(screen.getByText('open')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /Open thread/i })).toHaveAttribute(
			'href',
			`/tools/forum/${THREAD}`
		);
		expect(screen.getByText('reporter-1')).toBeInTheDocument();
	});

	it('shows an empty state when the queue has no rows', () => {
		render(ReportsPage, {
			data: { statusFilter: 'open', unavailable: false, reports: [] }
		});
		expect(screen.getByText(/No open reports/i)).toBeInTheDocument();
	});

	it('shows an unavailable alert when the store is down', () => {
		render(ReportsPage, {
			data: { statusFilter: 'open', unavailable: true, reports: [] }
		});
		expect(screen.getByRole('alert')).toHaveTextContent(/unavailable/i);
	});
});
