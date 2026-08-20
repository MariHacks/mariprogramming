// @ts-nocheck
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import {
	StaffCatalogueConflictError,
	StaffCatalogueUnavailableError,
	StaffCatalogueValidationError
} from '$lib/server/catalogue/staff-repository.js';
import { StaffActionRequestError } from '$lib/server/staff/request.js';
import { _createStaffCatalogueHandlers } from './+page.server.js';

const STAFF = Object.freeze({
	userId: 'staff-user',
	sessionId: 'staff-session',
	email: 'team@marihacks.com'
});
const ID = '10000000-0000-4000-8000-000000000001';
const REQUEST_ID = '60000000-0000-4000-8000-000000000001';

function repository(overrides = {}) {
	return {
		listStaffCatalogue: vi.fn(async () => ({ records: [], totalCount: 0 })),
		getStaffCatalogueRecord: vi.fn(async () => null),
		createStaffCatalogueRecord: vi.fn(async () => ({ id: ID, active: true, version: 1 })),
		updateStaffCatalogueRecord: vi.fn(async () => ({ id: ID, active: true, version: 2 })),
		setStaffCatalogueRecordActive: vi.fn(async () => ({ id: ID, active: false, version: 2 })),
		...overrides
	};
}

function setup(overrides = {}) {
	const staffRepository = repository(overrides.repository);
	const authorize = vi.fn(() => STAFF);
	const createRepository = vi.fn(() => staffRepository);
	const guardMutation = vi.fn(async (_event, options) => ({
		staff: STAFF,
		form: Object.fromEntries(options.fields.map((field) => [field, valueFor(field)])),
		requestId: REQUEST_ID,
		runtime: {
			databaseUrl: 'postgresql://staff:secret@db.example.com/club',
			approvedHostnames: ['shop.example.com']
		}
	}));
	const handlers = _createStaffCatalogueHandlers({
		authorize,
		readEnvironment: vi.fn(() => ({
			databaseUrl: 'postgresql://staff:secret@db.example.com/club',
			approvedHostnames: ['shop.example.com']
		})),
		createRepository,
		guardMutation,
		...overrides
	});
	return { handlers, authorize, createRepository, guardMutation, staffRepository };
}

function valueFor(field) {
	return {
		id: ID,
		version: '1',
		slug: 'ada-lovelace',
		name: 'Ada Lovelace',
		teacherId: ID,
		code: 'CSC 205',
		title: 'Data Structures',
		serviceFee: '5.00',
		bookstoreId: ID,
		author: '',
		isbn: '',
		retailerUrl: 'https://shop.example.com/book',
		coverUrl: '',
		price: '42.99',
		courseId: ID,
		bookId: ID,
		position: '0'
	}[field];
}

function event(
	resource = 'teachers',
	url = `https://club.example.com/staff/catalogue/${resource}`
) {
	return /** @type {any} */ ({
		locals: { staff: STAFF },
		params: { resource },
		request: new Request(url, { method: 'POST' }),
		url: new URL(url),
		setHeaders: vi.fn()
	});
}

describe('staff catalogue resource load', () => {
	it('reauthorizes, lists one resource, loads relationship options, and selects an editor', async () => {
		const selected = { id: ID, name: 'Ada Lovelace', active: true, version: 1 };
		const setupResult = setup({
			repository: {
				listStaffCatalogue: vi
					.fn()
					.mockResolvedValueOnce({ records: [selected], totalCount: 1 })
					.mockResolvedValueOnce({ records: [selected], totalCount: 1 }),
				getStaffCatalogueRecord: vi.fn(async () => selected)
			}
		});
		const current = event(
			'courses',
			`https://club.example.com/staff/catalogue/courses?q=data&edit=${ID}`
		);
		await expect(setupResult.handlers.load(current)).resolves.toEqual({
			resource: 'courses',
			search: 'data',
			records: [selected],
			totalCount: 1,
			selected,
			mode: 'edit',
			options: { teachers: [selected] },
			unavailable: false
		});
		expect(setupResult.authorize).toHaveBeenCalledWith(current.locals);
		expect(setupResult.staffRepository.listStaffCatalogue).toHaveBeenNthCalledWith(
			1,
			'courses',
			'data'
		);
		expect(setupResult.staffRepository.listStaffCatalogue).toHaveBeenNthCalledWith(
			2,
			'teachers',
			''
		);
		expect(setupResult.staffRepository.getStaffCatalogueRecord).toHaveBeenCalledWith('courses', ID);
	});

	it.each([
		['teachers', {}],
		['courses', { teachers: [] }],
		['bookstores', {}],
		['books', { bookstores: [] }],
		['assignments', { courses: [], books: [] }]
	])('loads exact relationship options for %s', async (resource, options) => {
		const setupResult = setup();
		await expect(setupResult.handlers.load(event(resource))).resolves.toMatchObject({ options });
	});

	it('opens the add editor without inventing a selected record', async () => {
		const setupResult = setup();
		await expect(
			setupResult.handlers.load(
				event('books', 'https://club.example.com/staff/catalogue/books?add=1')
			)
		).resolves.toMatchObject({ mode: 'add', selected: null });
	});

	it('returns a useful unavailable state without leaking the storage error', async () => {
		const setupResult = setup({
			repository: {
				listStaffCatalogue: vi.fn(async () => {
					throw new StaffCatalogueUnavailableError();
				})
			}
		});
		await expect(setupResult.handlers.load(event())).resolves.toMatchObject({
			unavailable: true,
			records: [],
			totalCount: 0,
			selected: null,
			options: {}
		});
	});

	it('returns the same bounded unavailable state when catalogue configuration is missing', async () => {
		const setupResult = setup({
			readEnvironment: vi.fn(() => {
				throw new Error('missing catalogue configuration');
			})
		});
		await expect(setupResult.handlers.load(event())).resolves.toEqual({
			resource: 'teachers',
			search: '',
			records: [],
			totalCount: 0,
			selected: null,
			mode: null,
			options: {},
			unavailable: true
		});
		expect(setupResult.createRepository).not.toHaveBeenCalled();
	});

	it('does not misclassify an unexpected catalogue load failure', async () => {
		const unexpected = new TypeError('programming error');
		const setupResult = setup({
			repository: {
				listStaffCatalogue: vi.fn(async () => {
					throw unexpected;
				})
			}
		});
		await expect(setupResult.handlers.load(event())).rejects.toBe(unexpected);
	});

	it('authorizes before rejecting an unknown resource', async () => {
		const setupResult = setup();
		await expect(setupResult.handlers.load(event('orders'))).rejects.toMatchObject({ status: 404 });
		expect(setupResult.authorize).toHaveBeenCalledOnce();
		expect(setupResult.createRepository).not.toHaveBeenCalled();
	});

	it('authorizes before rejecting a missing resource parameter', async () => {
		const setupResult = setup();
		const current = event();
		current.params = {};
		await expect(setupResult.handlers.load(current)).rejects.toMatchObject({ status: 404 });
		expect(setupResult.authorize).toHaveBeenCalledOnce();
		expect(setupResult.createRepository).not.toHaveBeenCalled();
	});

	it('returns not found when an editor record no longer exists', async () => {
		const setupResult = setup();
		await expect(
			setupResult.handlers.load(
				event('teachers', `https://club.example.com/staff/catalogue/teachers?edit=${ID}`)
			)
		).rejects.toMatchObject({ status: 404 });
	});

	it.each(['x'.repeat(101), 'line%0Abreak'])(
		'rejects invalid search %s with a generic client error',
		async (search) => {
			const setupResult = setup({
				repository: {
					listStaffCatalogue: vi.fn(async () => {
						throw new StaffCatalogueValidationError({ q: 'invalid' });
					})
				}
			});
			await expect(
				setupResult.handlers.load(
					event('teachers', `https://club.example.com/staff/catalogue/teachers?q=${search}`)
				)
			).rejects.toMatchObject({ status: 400 });
		}
	);
});

describe('staff catalogue named actions', () => {
	it('authorizes before rejecting an unknown action resource', async () => {
		const setupResult = setup();
		await expect(setupResult.handlers.actions.create(event('orders'))).rejects.toMatchObject({
			status: 404
		});
		expect(setupResult.authorize).toHaveBeenCalledOnce();
		expect(setupResult.guardMutation).not.toHaveBeenCalled();
	});

	it('does not misclassify an unexpected request-guard failure as a bounded form error', async () => {
		const unexpected = new TypeError('programming error');
		const setupResult = setup({
			guardMutation: vi.fn(async () => {
				throw unexpected;
			})
		});
		await expect(setupResult.handlers.actions.activate(event('teachers'))).rejects.toBe(unexpected);
	});

	it('exports only create, update, activate, and deactivate mutations', () => {
		const { handlers } = setup();
		expect(Object.keys(handlers.actions)).toEqual(['create', 'update', 'activate', 'deactivate']);
		expect(handlers.actions).not.toHaveProperty('default');
		expect(handlers.actions).not.toHaveProperty('delete');
	});

	it.each([
		['teachers', ['slug', 'name']],
		['courses', ['teacherId', 'code', 'title']],
		['bookstores', ['name', 'serviceFee']],
		['books', ['bookstoreId', 'title', 'author', 'isbn', 'retailerUrl', 'coverUrl', 'price']],
		['assignments', ['courseId', 'bookId', 'position']]
	])('creates %s through its exact action fields', async (resource, fields) => {
		const setupResult = setup();
		await expect(setupResult.handlers.actions.create(event(resource))).resolves.toEqual({
			success: true,
			message: expect.any(String),
			selectedId: ID
		});
		expect(setupResult.guardMutation).toHaveBeenCalledWith(expect.anything(), {
			action: `catalogue_create_${resource === 'assignments' ? 'course_book' : resource.slice(0, -1)}`,
			fields
		});
		expect(setupResult.staffRepository.createStaffCatalogueRecord).toHaveBeenCalledWith(
			resource,
			Object.fromEntries(fields.map((field) => [field, valueFor(field)])),
			{ userId: STAFF.userId, email: STAFF.email, requestId: REQUEST_ID }
		);
	});

	it('updates assignment position without allowing course or book identity changes', async () => {
		const setupResult = setup();
		await expect(setupResult.handlers.actions.update(event('assignments'))).resolves.toMatchObject({
			success: true,
			selectedId: ID
		});
		expect(setupResult.guardMutation).toHaveBeenCalledWith(expect.anything(), {
			action: 'catalogue_update_course_book',
			fields: ['id', 'version', 'position'],
			contextField: 'id'
		});
		expect(setupResult.staffRepository.updateStaffCatalogueRecord).toHaveBeenCalledWith(
			'assignments',
			ID,
			1,
			{ position: '0' },
			expect.objectContaining({ requestId: REQUEST_ID })
		);
	});

	it.each([
		['activate', true],
		['deactivate', false]
	])('%s uses a versioned POST state mutation', async (action, active) => {
		const setupResult = setup();
		await expect(setupResult.handlers.actions[action](event('teachers'))).resolves.toMatchObject({
			success: true,
			selectedId: ID
		});
		expect(setupResult.staffRepository.setStaffCatalogueRecordActive).toHaveBeenCalledWith(
			'teachers',
			ID,
			1,
			active,
			expect.objectContaining({ requestId: REQUEST_ID })
		);
	});

	it('preserves entered fields and returns associated validation errors', async () => {
		const setupResult = setup({
			repository: {
				createStaffCatalogueRecord: vi.fn(async () => {
					throw new StaffCatalogueValidationError({ name: 'Enter a name.' });
				})
			}
		});
		const response = await setupResult.handlers.actions.create(event('teachers'));
		expect(response.status).toBe(400);
		expect(response.data).toEqual({
			errorSummary: 'Check the highlighted fields.',
			fieldErrors: { name: 'Enter a name.' },
			values: { slug: 'ada-lovelace', name: 'Ada Lovelace' },
			action: 'create'
		});
	});

	it('uses a bounded form-level validation message when no field can be highlighted', async () => {
		const setupResult = setup({
			repository: {
				updateStaffCatalogueRecord: vi.fn(async () => {
					throw new StaffCatalogueValidationError({ _form: 'There are no changes to save.' });
				})
			}
		});
		const response = await setupResult.handlers.actions.update(event('teachers'));
		expect(response.status).toBe(400);
		expect(response.data).toMatchObject({ errorSummary: 'There are no changes to save.' });
	});

	it.each([
		[new StaffCatalogueConflictError(), 409, 'This entry changed. Reload it before saving again.'],
		[new StaffCatalogueUnavailableError(), 503, 'Catalogue changes are unavailable. Try again.'],
		[new StaffActionRequestError(429, 30), 429, 'Too many changes. Wait a moment and try again.'],
		[
			new StaffActionRequestError(403),
			403,
			'This request could not be verified. Reload and try again.'
		],
		[new StaffActionRequestError(413), 413, 'This entry is too large. Shorten it and try again.'],
		[new StaffActionRequestError(415), 415, 'This form could not be read. Reload and try again.'],
		[new StaffActionRequestError(503), 503, 'Catalogue changes are unavailable. Try again.'],
		[new StaffActionRequestError(400), 400, 'Check the form and try again.']
	])('maps a bounded mutation failure to status %s', async (failure, status, errorSummary) => {
		const setupResult =
			failure instanceof StaffActionRequestError
				? setup({
						guardMutation: vi.fn(async () => {
							throw failure;
						})
					})
				: setup({
						repository: {
							createStaffCatalogueRecord: vi.fn(async () => {
								throw failure;
							})
						}
					});
		const response = await setupResult.handlers.actions.create(event('teachers'));
		expect(response.status).toBe(status);
		expect(response.data).toMatchObject({ errorSummary });
		expect(JSON.stringify(response.data)).not.toMatch(/database|secret|session/i);
	});

	it('does not misclassify an unexpected repository failure as a catalogue error', async () => {
		const unexpected = new TypeError('programming error');
		const setupResult = setup({
			repository: {
				setStaffCatalogueRecordActive: vi.fn(async () => {
					throw unexpected;
				})
			}
		});
		await expect(setupResult.handlers.actions.deactivate(event('teachers'))).rejects.toBe(
			unexpected
		);
	});

	it.each([
		['activate', 409],
		['activate', 429],
		['activate', 503],
		['deactivate', 409],
		['deactivate', 429],
		['deactivate', 503]
	])('keeps bounded record context for a failed %s action at %i', async (action, status) => {
		const failure =
			status === 409
				? new StaffCatalogueConflictError()
				: new StaffActionRequestError(status, status === 429 ? 30 : 0, { recordId: ID });
		const setupResult =
			status === 409
				? setup({
						repository: {
							setStaffCatalogueRecordActive: vi.fn(async () => {
								throw failure;
							})
						}
					})
				: setup({
						guardMutation: vi.fn(async () => {
							throw failure;
						})
					});
		const response = await setupResult.handlers.actions[action](event('teachers'));
		expect(response.status).toBe(status);
		expect(response.data).toMatchObject({ action, selectedId: ID });
		expect(JSON.stringify(response.data)).not.toMatch(/database|secret|session/i);
	});

	it('fails malformed id and version values without calling the repository', async () => {
		const guardMutation = vi.fn(async () => ({
			staff: STAFF,
			form: { id: 'not-a-uuid', version: '1.5', slug: 'ada', name: 'Ada' },
			requestId: REQUEST_ID,
			runtime: {
				databaseUrl: 'postgresql://staff:secret@db.example.com/club',
				approvedHostnames: ['shop.example.com']
			}
		}));
		const setupResult = setup({ guardMutation });
		const response = await setupResult.handlers.actions.update(event('teachers'));
		expect(response.status).toBe(400);
		expect(setupResult.staffRepository.updateStaffCatalogueRecord).not.toHaveBeenCalled();
	});
});
