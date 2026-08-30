import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import SemesterPage from './+page.svelte';

const stylesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../lib/maritools/styles');

afterEach(cleanup);

describe('semester page', () => {
	it('sends visitors to the account page when they are signed out', () => {
		render(SemesterPage, { props: { data: { view: { kind: 'need-sign-in' } } } });
		expect(screen.getByRole('heading', { name: 'Sign in to upload outlines' })).toBeInTheDocument();
		const openAccount = screen.getByRole('link', { name: 'Open account' });
		expect(openAccount).toHaveAttribute('href', '/tools/account');
		expect(openAccount).toHaveClass('primary-button');
		expect(screen.getByText(/Course outlines stay private until you choose to share/)).toBeInTheDocument();
		const stackGate = screen.getByRole('link', { name: 'Sign in to add an outline' });
		expect(stackGate).toHaveAttribute('href', '/tools/account');
		expect(stackGate).not.toHaveClass('primary-button');
		expect(stackGate).toHaveClass('quiet-button');
		const primaryAccountLinks = screen
			.getAllByRole('link')
			.filter(
				(link) =>
					link.classList.contains('primary-button') && link.getAttribute('href') === '/tools/account'
			);
		expect(primaryAccountLinks).toHaveLength(1);
		expect(screen.queryByLabelText('Course outline PDF')).not.toBeInTheDocument();
	});

	it('accepts a PDF upload when the account is ready', () => {
		render(SemesterPage, { props: { data: { view: { kind: 'ready' } } } });
		expect(screen.getByLabelText('Course outline PDF')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Extract outline' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Upload an outline' })).toBeInTheDocument();
		expect(screen.getByText(/Scanned image PDFs will not work/)).toBeInTheDocument();
		expect(screen.getByText('No file selected')).toBeInTheDocument();
	});

	it('sends incomplete accounts back to finish setup', () => {
		render(SemesterPage, { props: { data: { view: { kind: 'need-profile' } } } });
		expect(screen.getByRole('heading', { name: 'Finish your account' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Open account' })).toHaveAttribute('href', '/tools/account');
		expect(screen.getByText('Finish account to upload')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Finish account to add an outline' })).toHaveAttribute(
			'href',
			'/tools/account'
		);
		expect(screen.queryByLabelText('Course outline PDF')).not.toBeInTheDocument();
		cleanup();
		render(SemesterPage, { props: { data: { view: { kind: 'need-disclosure' } } } });
		expect(screen.getByRole('heading', { name: 'Confirm the NVIDIA disclosure' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Open account' })).toHaveAttribute('href', '/tools/account');
		expect(screen.getByText('Confirm disclosure to upload')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Confirm disclosure to add an outline' })).toHaveAttribute(
			'href',
			'/tools/account'
		);
		expect(screen.queryByLabelText('Course outline PDF')).not.toBeInTheDocument();
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
							courseCode: '420-SNT-MS',
							title: 'Web Programming',
							section: '00001',
							teacherName: 'Ada',
							assessments: [{ title: 'Midterm', weight: 30, date: '2026-10-20' }],
							books: [{ title: 'University Physics', author: 'Young', required: true }]
						}
					}
				}
			}
		});
		expect(screen.getByDisplayValue('Midterm')).toBeInTheDocument();
		expect(screen.getByDisplayValue('420-SNT-MS')).toBeInTheDocument();
		expect(screen.getByDisplayValue('Web Programming')).toBeInTheDocument();
		expect(screen.getByDisplayValue('00001')).toBeInTheDocument();
		expect(screen.getByDisplayValue('Ada')).toBeInTheDocument();
		expect(screen.getByText('Private unless you share.')).toBeInTheDocument();
		expect(screen.getByText('Share course facts with the catalog')).toBeInTheDocument();
		expect(
			screen.getByText(
				'Only the course code, instructor, assessments, and book references are shared.'
			)
		).toBeInTheDocument();
		const selected = screen.getByRole('button', { name: /Web Programming/ });
		expect(selected).toHaveTextContent('4/4 identity');
		expect(selected).not.toHaveClass('needs-dates');
	});

	it('marks missing assessment dates on the selected course chip', () => {
		render(SemesterPage, {
			props: {
				data: { view: { kind: 'ready' } },
				form: {
					extraction: {
						ok: true,
						sha256: 'ab'.repeat(32),
						proposals: {
							assessments: [{ title: 'Midterm', weight: 30, date: '' }],
							books: []
						}
					}
				}
			}
		});
		const selected = screen.getByRole('button', { name: /Untitled outline/ });
		expect(selected).toHaveTextContent('1 date missing');
		expect(selected).toHaveClass('needs-dates');
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
		expect(screen.getAllByText(/date missing/i).length).toBeGreaterThan(0);
		expect(screen.getByText('1 assessment date missing')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: '+ Add assessment' }));
		expect(screen.getAllByLabelText('Assessment')).toHaveLength(2);
		fireEvent.click(screen.getAllByRole('button', { name: 'Remove assessment' })[0]);
		expect(screen.getAllByLabelText('Assessment')).toHaveLength(1);
		fireEvent.click(screen.getByRole('checkbox'));
		expect(screen.getByRole('button', { name: 'Share to catalog' })).toBeInTheDocument();
	});

	it('keeps a visible outline file control in the course stack', () => {
		render(SemesterPage, { props: { data: { view: { kind: 'ready' } } } });
		const input = screen.getByLabelText('Course outline PDF');
		expect(input).toHaveAttribute('type', 'file');
		const label = input.closest('label');
		expect(label).toHaveClass('outline-picker');
		expect(label?.textContent).toMatch(/Course outline PDF/i);
		expect(label?.closest('.review-sheet')).toBeNull();
		expect(document.querySelectorAll('input[type="file"][name="outline"]')).toHaveLength(1);
		expect(document.querySelector('.review-sheet input[type="file"]')).toBeNull();
		expect(screen.getByRole('button', { name: 'Extract outline' })).toBeInTheDocument();
	});

	it('keeps the course-stack extract button styled as primary', () => {
		const extras = readFileSync(path.join(stylesDir, 'preview-extras.css'), 'utf8');
		const pages = readFileSync(path.join(stylesDir, 'preview-pages.css'), 'utf8');
		const merged = readFileSync(path.join(stylesDir, 'merged-pages.css'), 'utf8');
		const cascade = `${pages}\n${extras}\n${merged}`;

		expect(pages).toMatch(/\.course-stack\s+\.outline-picker\s*\{/);
		expect(pages).toMatch(
			/\.course-stack\s+\.stack-head\s+\.add-outline\s*\{[^}]*\bposition:\s*static\b/s
		);
		expect(cascade).toMatch(/\.outline-picker/);
	});
});
