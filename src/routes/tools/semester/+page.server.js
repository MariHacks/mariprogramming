import { fail } from '@sveltejs/kit';
import { createOutlineExtractionProvider, needsTextPdf } from '$lib/maritools/extract/provider.js';
import { semesterPageView } from '$lib/server/maritools/community.js';
import { extractPdfText, isPdfHeader } from '$lib/server/maritools/pdf-text.js';
import {
	MaritoolsInputError,
	MaritoolsUnavailableError,
	openStudentStore
} from '$lib/server/maritools/student-store.js';

export const prerender = false;

const MAX_PDF_BYTES = 8_000_000;

/** @param {Record<string, any>} [dependencies] */
export function _createHandlers(dependencies = {}) {
	const createRepository = dependencies.createRepository ?? openStudentStore;
	const extractPdf = dependencies.extractPdf ?? extractPdfText;
	const isPdf = dependencies.isPdf ?? isPdfHeader;
	const getNimKey = dependencies.getNimKey ?? (() => String(process.env.NVIDIA_NIM_API_KEY ?? '').trim());
	const getNimModel =
		dependencies.getNimModel ??
		(() => process.env.NVIDIA_NIM_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b');
	const createProvider =
		dependencies.createProvider ??
		(() => createOutlineExtractionProvider({ getKey: getNimKey, getModel: getNimModel }));

	/** @param {any} event */
	async function load(event) {
		const session = event.locals.maritools ?? null;
		let profile = null;
		if (session) {
			try {
				const repository = createRepository();
				profile = await repository.getProfile(session.userId);
			} catch {
				profile = null;
			}
		}
		return { view: semesterPageView(session, profile) };
	}

	/** @param {any} event @param {{ kind: string }} view */
	function rejectView(view) {
		if (view.kind === 'need-sign-in') return fail(401, { error: 'Sign in with Google first.' });
		if (view.kind === 'need-profile') {
			return fail(400, { error: 'Finish your account before uploading an outline.' });
		}
		return fail(400, { error: 'Confirm the NVIDIA disclosure on your account page first.' });
	}

	/** @param {any} event */
	async function requireReady(event) {
		const session = event.locals.maritools;
		if (!session) return { error: rejectView({ kind: 'need-sign-in' }) };
		let profile;
		try {
			profile = await createRepository().getProfile(session.userId);
		} catch (error) {
			if (error instanceof MaritoolsUnavailableError) {
				return { error: fail(503, { error: 'Semester tools are unavailable. Try again.' }) };
			}
			throw error;
		}
		const view = semesterPageView(session, profile);
		if (view.kind !== 'ready') return { error: rejectView(view) };
		return { session };
	}

	/** @param {any} event */
	async function extract(event) {
		const ready = await requireReady(event);
		if (ready.error) return ready.error;
		const data = await event.request.formData();
		const file = data.get('outline');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: 'Choose a PDF to upload.' });
		}
		if (file.size > MAX_PDF_BYTES) {
			return fail(400, { error: 'That PDF is too large. Try one under 8 MB.' });
		}
		const bytes = new Uint8Array(await file.arrayBuffer());
		if (!isPdf(bytes)) {
			return fail(400, { error: 'Upload a PDF file.' });
		}
		const extracted = extractPdf(bytes);
		const text = String(extracted.text ?? '').trim();
		if (needsTextPdf(text, extracted.byteLength)) {
			return fail(400, {
				error: 'This looks like a scanned PDF. Export a text PDF from the original document and upload that.'
			});
		}
		try {
			const repository = createRepository();
			await repository.saveOutlineDocument({
				userId: ready.session.userId,
				sha256: extracted.sha256,
				byteLength: extracted.byteLength,
				extractedText: text
			});
			const cached = await repository.getExtraction(extracted.sha256);
			if (cached) {
				return {
					extraction: {
						ok: true,
						reason: null,
						proposals: cached.proposals,
						inferenceCount: cached.inferenceCount,
						cacheHit: true,
						sha256: extracted.sha256
					}
				};
			}
			const provider = createProvider();
			const result = await provider.extract({
				text,
				sha256: extracted.sha256,
				byteLength: extracted.byteLength
			});
			if (result.ok && result.proposals) {
				await repository.saveExtraction({
					documentSha256: extracted.sha256,
					offeringId: null,
					proposals: result.proposals,
					model: getNimModel(),
					inferenceCount: result.inferenceCount
				});
			}
			return {
				extraction: {
					...result,
					sha256: extracted.sha256
				}
			};
		} catch (error) {
			if (error instanceof MaritoolsInputError) {
				return fail(400, {
					error: 'Could not save that outline. Try another PDF or enter the details manually.'
				});
			}
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { error: 'Semester tools are unavailable. Try again.' });
			}
			throw error;
		}
	}

	/** @param {any} event */
	async function contribute(event) {
		const ready = await requireReady(event);
		if (ready.error) return ready.error;
		const data = await event.request.formData();
		let structured;
		try {
			structured = JSON.parse(String(data.get('structured') ?? ''));
		} catch {
			return fail(400, { error: 'Review the assessments and books before sharing.' });
		}
		if (!structured || typeof structured !== 'object') {
			return fail(400, { error: 'Review the assessments and books before sharing.' });
		}
		try {
			await createRepository().contribute({
				contributorUserId: ready.session.userId,
				documentSha256: String(data.get('sha256') ?? ''),
				termId: String(data.get('termId') ?? ''),
				courseCode: String(data.get('courseCode') ?? ''),
				title: String(data.get('title') ?? ''),
				section: String(data.get('section') ?? ''),
				teacherName: String(data.get('teacherName') ?? ''),
				structured
			});
			return { contributed: true };
		} catch (error) {
			if (error instanceof MaritoolsInputError) {
				return fail(400, { error: 'Add the course code, section, teacher, and term before sharing.' });
			}
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { error: 'Sharing to the catalog is unavailable. Try again.' });
			}
			throw error;
		}
	}

	return { load, actions: { extract, contribute } };
}

const handlers = _createHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
