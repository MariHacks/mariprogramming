import { error, fail } from '@sveltejs/kit';
import {
	MIOS_CATALOGUE_BOOKSTORES,
	MIOS_CATALOGUE_CONTACT,
	MIOS_CATALOGUE_ENTRIES,
	MIOS_CATALOGUE_NOTICES,
	MIOS_CATALOGUE_SKIPPED,
	MIOS_CATALOGUE_SOURCE,
	miosEntryFormValues,
	miosEntryKey
} from '$lib/books/mios-catalogue.js';
import { requireStaff } from '$lib/server/auth/authorization.js';
import {
	StaffCatalogueConflictError,
	StaffCatalogueUnavailableError,
	StaffCatalogueValidationError,
	createStaffCatalogueRepository
} from '$lib/server/catalogue/staff-repository.js';
import { readStaffCatalogueEnvironment } from '$lib/server/config/environment.js';
import { StaffActionRequestError, guardStaffMutation } from '$lib/server/staff/request.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const VERSION_PATTERN = /^[1-9]\d{0,8}$/u;
const MIOS_IMPORT_INTENT = 'mios-2026-08-20';
const RESOURCE_CONFIGURATION = Object.freeze({
	entries: Object.freeze({
		type: 'course_book',
		label: 'Catalogue entry',
		createFields: [
			'courseCode',
			'section',
			'title',
			'instructor',
			'author',
			'bookTitle',
			'edition',
			'isbn',
			'bookstore',
			'notes',
			'sourceDate'
		],
		updateFields: [
			'courseCode',
			'section',
			'title',
			'instructor',
			'author',
			'bookTitle',
			'edition',
			'isbn',
			'bookstore',
			'notes',
			'sourceDate'
		],
		options: []
	}),
	teachers: Object.freeze({
		type: 'teacher',
		label: 'Teacher',
		createFields: ['slug', 'name'],
		updateFields: ['slug', 'name'],
		options: []
	}),
	courses: Object.freeze({
		type: 'course',
		label: 'Course',
		createFields: ['teacherId', 'code', 'title'],
		updateFields: ['teacherId', 'code', 'title'],
		options: ['teachers']
	}),
	bookstores: Object.freeze({
		type: 'bookstore',
		label: 'Bookstore',
		createFields: ['name', 'serviceFee'],
		updateFields: ['name', 'serviceFee'],
		options: []
	}),
	books: Object.freeze({
		type: 'book',
		label: 'Book',
		createFields: ['bookstoreId', 'title', 'author', 'isbn', 'retailerUrl', 'coverUrl', 'price'],
		updateFields: ['bookstoreId', 'title', 'author', 'isbn', 'retailerUrl', 'coverUrl', 'price'],
		options: ['bookstores']
	}),
	assignments: Object.freeze({
		type: 'course_book',
		label: 'Assignment',
		createFields: ['courseId', 'bookId', 'position'],
		updateFields: ['position'],
		options: ['courses', 'books']
	})
});

/** @param {unknown} resource */
function findConfiguration(resource) {
	return typeof resource === 'string'
		? /** @type {Record<string, any>} */ (RESOURCE_CONFIGURATION)[resource]
		: null;
}

/** @param {unknown} resource */
function configurationFor(resource) {
	const configuration = findConfiguration(resource);
	if (!configuration) error(404, 'Catalogue view not found');
	return configuration;
}

/** @param {string} resource @param {{ databaseUrl: string, approvedHostnames: string[] }} runtime @param {Function} createRepository */
function openRepository(resource, runtime, createRepository) {
	configurationFor(resource);
	return createRepository({
		databaseUrl: runtime.databaseUrl,
		approvedHostnames: [...runtime.approvedHostnames]
	});
}

/** @param {StaffActionRequestError} failure */
function requestErrorSummary(failure) {
	if (failure.status === 429) return 'Too many changes. Wait a moment and try again.';
	if (failure.status === 403) return 'This request could not be verified. Reload and try again.';
	if (failure.status === 413) return 'This entry is too large. Shorten it and try again.';
	if (failure.status === 415) return 'This form could not be read. Reload and try again.';
	if (failure.status === 503) return 'Catalogue changes are unavailable. Try again.';
	return 'Check the form and try again.';
}

/** @param {unknown} value */
function parseVersion(value) {
	if (typeof value !== 'string' || !VERSION_PATTERN.test(value)) return null;
	return Number(value);
}

/** @param {unknown} value */
function parseId(value) {
	return typeof value === 'string' && UUID_PATTERN.test(value) ? value : null;
}

/** @param {Record<string, string>} form @param {string[]} fields */
function selectFields(form, fields) {
	return Object.fromEntries(fields.map((field) => [field, form[field]]));
}

/**
 * @param {Record<string, any>} [dependencies]
 */
export function _createStaffCatalogueHandlers(dependencies = {}) {
	const authorize = dependencies.authorize ?? requireStaff;
	const readEnvironment = dependencies.readEnvironment ?? readStaffCatalogueEnvironment;
	const createRepository = dependencies.createRepository ?? createStaffCatalogueRepository;
	const guardMutation = dependencies.guardMutation ?? guardStaffMutation;

	/** @param {any} event */
	async function load(event) {
		authorize(event.locals);
		const resource = event.params.resource;
		const configuration = configurationFor(resource);
		let runtime;
		try {
			runtime = readEnvironment();
		} catch {
			return {
				resource,
				search: '',
				records: [],
				totalCount: 0,
				selected: null,
				mode: null,
				options: {},
				unavailable: true
			};
		}
		const search = event.url.searchParams.get('q') ?? '';
		const editId = event.url.searchParams.get('edit');
		const add = event.url.searchParams.get('add') === '1';
		try {
			const repository = openRepository(resource, runtime, createRepository);
			const listing = await repository.listStaffCatalogue(resource, search);
			/** @type {Record<string, any[]>} */
			const options = {};
			for (const optionResource of configuration.options) {
				options[optionResource] = (await repository.listStaffCatalogue(optionResource, '')).records;
			}
			const selected = editId ? await repository.getStaffCatalogueRecord(resource, editId) : null;
			if (editId && !selected) error(404, 'Catalogue entry not found');
			return {
				resource,
				search,
				records: listing.records,
				totalCount: listing.totalCount,
				selected,
				mode: editId ? 'edit' : add ? 'add' : null,
				options,
				unavailable: false,
				...(resource === 'entries'
					? {
							sourceEntries: MIOS_CATALOGUE_ENTRIES,
							skippedPacks: MIOS_CATALOGUE_SKIPPED,
							source: MIOS_CATALOGUE_SOURCE,
							contact: MIOS_CATALOGUE_CONTACT,
							bookstores: MIOS_CATALOGUE_BOOKSTORES,
							notices: MIOS_CATALOGUE_NOTICES
						}
					: {})
			};
		} catch (failure) {
			if (failure instanceof StaffCatalogueUnavailableError) {
				return {
					resource,
					search,
					records: [],
					totalCount: 0,
					selected: null,
					mode: null,
					options: {},
					unavailable: true
				};
			}
			if (failure instanceof StaffCatalogueValidationError) {
				error(400, 'Catalogue request is invalid');
			}
			throw failure;
		}
	}

	/** @param {any} event @param {'create' | 'update' | 'activate' | 'deactivate'} action */
	async function mutate(event, action) {
		const resource = event.params.resource;
		const configuration = findConfiguration(resource);
		if (!configuration) {
			authorize(event.locals);
			error(404, 'Catalogue view not found');
		}
		const actionFields =
			action === 'create'
				? configuration.createFields
				: action === 'update'
					? ['id', 'version', ...configuration.updateFields]
					: ['id', 'version'];
		let guarded;
		try {
			/** @type {{ action: string, fields: string[], contextField?: 'id' }} */
			const guardOptions = {
				action: `catalogue_${action}_${configuration.type}`,
				fields: actionFields
			};
			if (action !== 'create') guardOptions.contextField = 'id';
			guarded = await guardMutation(event, guardOptions);
		} catch (failure) {
			if (failure instanceof StaffActionRequestError) {
				const selectedId = parseId(failure.context?.recordId);
				return fail(failure.status, {
					errorSummary: requestErrorSummary(failure),
					fieldErrors: {},
					values: {},
					action,
					...(selectedId ? { selectedId } : {})
				});
			}
			throw failure;
		}

		const values =
			action === 'create'
				? selectFields(guarded.form, configuration.createFields)
				: action === 'update'
					? selectFields(guarded.form, configuration.updateFields)
					: {};
		const actor = {
			userId: guarded.staff.userId,
			email: guarded.staff.email,
			requestId: guarded.requestId
		};
		let selectedId = null;
		try {
			const repository = openRepository(resource, guarded.runtime, createRepository);
			let result;
			if (action === 'create') {
				result = await repository.createStaffCatalogueRecord(resource, values, actor);
			} else {
				const id = parseId(guarded.form.id);
				const version = parseVersion(guarded.form.version);
				if (!id || !version) {
					return fail(400, {
						errorSummary: 'Reload this entry and try again.',
						fieldErrors: {},
						values,
						action
					});
				}
				selectedId = id;
				result =
					action === 'update'
						? await repository.updateStaffCatalogueRecord(resource, id, version, values, actor)
						: await repository.setStaffCatalogueRecordActive(
								resource,
								id,
								version,
								action === 'activate',
								actor
							);
			}
			const verb =
				action === 'create'
					? 'added'
					: action === 'update'
						? 'saved'
						: action === 'activate'
							? 'activated'
							: 'deactivated';
			return {
				success: true,
				message: `${configuration.label} ${verb}.`,
				selectedId: result.id
			};
		} catch (failure) {
			const recordContext = selectedId ? { selectedId } : {};
			if (failure instanceof StaffCatalogueValidationError) {
				const formError = failure.fieldErrors._form;
				const fieldErrors = Object.fromEntries(
					Object.entries(failure.fieldErrors).filter(([field]) => field !== '_form')
				);
				return fail(400, {
					errorSummary: formError ?? 'Check the highlighted fields.',
					fieldErrors,
					values,
					action,
					...recordContext
				});
			}
			if (failure instanceof StaffCatalogueConflictError) {
				return fail(409, {
					errorSummary: 'This entry changed. Reload it before saving again.',
					fieldErrors: {},
					values,
					action,
					...recordContext
				});
			}
			if (failure instanceof StaffCatalogueUnavailableError) {
				return fail(503, {
					errorSummary: 'Catalogue changes are unavailable. Try again.',
					fieldErrors: {},
					values,
					action,
					...recordContext
				});
			}
			throw failure;
		}
	}

	/** @param {any} event */
	async function importSource(event) {
		const resource = event.params.resource;
		if (resource !== 'entries') {
			authorize(event.locals);
			error(404, 'Catalogue view not found');
		}
		configurationFor(resource);
		let guarded;
		try {
			guarded = await guardMutation(event, {
				action: 'catalogue_import_course_book',
				fields: ['intent']
			});
		} catch (failure) {
			if (failure instanceof StaffActionRequestError) {
				return fail(failure.status, {
					errorSummary: requestErrorSummary(failure),
					fieldErrors: {},
					values: {},
					action: 'importSource'
				});
			}
			throw failure;
		}
		if (guarded.form.intent !== MIOS_IMPORT_INTENT) {
			return fail(400, {
				errorSummary: 'Reload this page and try again.',
				fieldErrors: {},
				values: { intent: guarded.form.intent },
				action: 'importSource'
			});
		}
		const actor = {
			userId: guarded.staff.userId,
			email: guarded.staff.email,
			requestId: guarded.requestId
		};
		try {
			const repository = openRepository(resource, guarded.runtime, createRepository);
			const listing = await repository.listStaffCatalogue('entries', '');
			const keys = new Set(listing.records.map((row) => miosEntryKey(row)));
			let imported = 0;
			for (const entry of MIOS_CATALOGUE_ENTRIES) {
				if (keys.has(miosEntryKey(entry))) continue;
				await repository.createStaffCatalogueRecord('entries', miosEntryFormValues(entry), actor);
				imported += 1;
			}
			return {
				success: true,
				message:
					imported === 0
						? 'Teacher list already loaded.'
						: `Loaded ${imported} catalogue ${imported === 1 ? 'entry' : 'entries'}.`
			};
		} catch (failure) {
			if (failure instanceof StaffCatalogueValidationError) {
				const formError = failure.fieldErrors._form;
				const fieldErrors = Object.fromEntries(
					Object.entries(failure.fieldErrors).filter(([field]) => field !== '_form')
				);
				return fail(400, {
					errorSummary: formError ?? 'Check the highlighted fields.',
					fieldErrors,
					values: { intent: guarded.form.intent },
					action: 'importSource'
				});
			}
			if (failure instanceof StaffCatalogueConflictError) {
				return fail(409, {
					errorSummary: 'This entry changed. Reload it before saving again.',
					fieldErrors: {},
					values: { intent: guarded.form.intent },
					action: 'importSource'
				});
			}
			if (failure instanceof StaffCatalogueUnavailableError) {
				return fail(503, {
					errorSummary: 'Catalogue changes are unavailable. Try again.',
					fieldErrors: {},
					values: { intent: guarded.form.intent },
					action: 'importSource'
				});
			}
			throw failure;
		}
	}

	return Object.freeze({
		load,
		actions: Object.freeze({
			create: (/** @type {any} */ event) => mutate(event, 'create'),
			update: (/** @type {any} */ event) => mutate(event, 'update'),
			activate: (/** @type {any} */ event) => mutate(event, 'activate'),
			deactivate: (/** @type {any} */ event) => mutate(event, 'deactivate'),
			importSource
		})
	});
}

const handlers = _createStaffCatalogueHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
