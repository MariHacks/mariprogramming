import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import SemesterPage from './+page.svelte';

afterEach(cleanup);

describe('semester page', () => {
	it('sends visitors to the account page when they are signed out', () => {
		render(SemesterPage, { props: { data: { view: { kind: 'need-sign-in' } } } });
		expect(screen.getByRole('heading', { name: 'Sign in to upload outlines' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Open account' })).toHaveAttribute('href', '/tools/account');
		expect(screen.getByText(/Course outlines stay private until you choose to share/)).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Sign in to add an outline' })).toHaveAttribute(
			'href',
			'/tools/account'
		);
		expect(screen.queryByLabelText('Course outline PDF')).not.toBeInTheDocument();
	});

	it('accepts a PDF upload when the account is ready', () => {
		render(SemesterPage, { props: { data: { view: { kind: 'ready' } } } });
		expect(screen.getByLabelText('Course outline PDF')).toBeInTheDocument();
		expect(screen.getByText('Add course outline')).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Upload an outline' })).toBeInTheDocument();
		expect(screen.getByText(/Scanned image PDFs will not work/)).toBeInTheDocument();
	});

	it('sends incomplete accounts back to finish setup', () => {
		render(SemesterPage, { props: { data: { view: { kind: 'need-profile' } } } });
		expect(screen.getByRole('heading', { name: 'Finish your account' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Open account' })).toHaveAttribute('href', '/tools/account');
		cleanup();
		render(SemesterPage, { props: { data: { view: { kind: 'need-disclosure' } } } });
		expect(screen.getByRole('heading', { name: 'Confirm the NVIDIA disclosure' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Open account' })).toHaveAttribute('href', '/tools/account');
	});

	it('lets a student review extracted assessments privately', () => {
		render(SemesterPage, {
			props: {
				data: { view: { kind: 'ready' } },
				form: {
					extraction: {
						ok: true,
						sha256: 'ab'.repeat(32),
						proposals: {
							assessments: [{ title: 'Midterm', weight: 30, date: '2026-10-20' }],
							books: [{ title: 'University Physics', author: 'Young', required: true }]
						}
					}
				}
			}
		});
		expect(screen.getByDisplayValue('Midterm')).toBeInTheDocument();
		expect(screen.getByText('Private unless you share.')).toBeInTheDocument();
		expect(screen.getByText('Share course facts with the catalog')).toBeInTheDocument();
		expect(
			screen.getByText(
				'Only the course code, instructor, assessments, and book references are shared.'
			)
		).toBeInTheDocument();
	});

	it('explains a missing NVIDIA key and a reused extraction', () => {
		render(SemesterPage, {
			props: {
				data: { view: { kind: 'ready' } },
				form: {
					extraction: {
						ok: false,
						reason: 'missing-key',
						sha256: 'ab'.repeat(32),
						cacheHit: true,
						proposals: { assessments: [], books: [] }
					}
				}
			}
		});
		expect(screen.getByText(/Automatic extraction is unavailable/)).toBeInTheDocument();
		expect(screen.getByText('Used a saved extraction for this file.')).toBeInTheDocument();
		cleanup();
		render(SemesterPage, {
			props: {
				data: { view: { kind: 'ready' } },
				form: {
					error: 'Upload a PDF file.',
					extraction: {
						ok: false,
						reason: 'provider',
						sha256: 'ab'.repeat(32),
						proposals: { assessments: [], books: [] }
					}
				}
			}
		});
		expect(screen.getByText(/We could not extract this outline automatically/)).toBeInTheDocument();
		expect(screen.getByText('Upload a PDF file.')).toBeInTheDocument();
	});

	it('confirms a catalog share', () => {
		render(SemesterPage, {
			props: {
				data: { view: { kind: 'ready' } },
				form: { contributed: true }
			}
		});
		expect(screen.getByText('Saved to the catalog.')).toBeInTheDocument();
	});

	it('lets the student add and remove assessment rows', () => {
		render(SemesterPage, {
			props: {
				data: { view: { kind: 'ready' } },
				form: {
					extraction: {
						ok: true,
						sha256: 'ab'.repeat(32),
						proposals: {
							assessments: [{ title: 'Final project', weight: 20, date: '' }],
							books: [{ title: '', author: '', isbn: '', required: false }]
						}
					}
				}
			}
		});
		expect(screen.getByText(/date missing/)).toBeInTheDocument();
		expect(screen.getByText(/field needs attention/)).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: '+ Add assessment' }));
		expect(screen.getAllByLabelText('Assessment')).toHaveLength(2);
		fireEvent.click(screen.getAllByRole('button', { name: 'Remove assessment' })[0]);
		expect(screen.getAllByLabelText('Assessment')).toHaveLength(1);
		fireEvent.click(screen.getByRole('checkbox'));
		expect(screen.getByRole('button', { name: 'Share to catalog' })).toBeInTheDocument();
	});
});
